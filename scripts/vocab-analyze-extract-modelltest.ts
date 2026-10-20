/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
/**
 * Phase A — Analyse un (ou tous les) Modelltest(s) et extrait des candidats vocab.
 *
 *   npx ts-node -r dotenv/config scripts/vocab-analyze-extract-modelltest.ts
 *   npx ts-node -r dotenv/config scripts/vocab-analyze-extract-modelltest.ts --mt=2
 *   npx ts-node -r dotenv/config scripts/vocab-analyze-extract-modelltest.ts --dry-run
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  extractCandidatesFromText,
  mergeCandidates,
  type TokenCandidate,
} from '../src/modules/vocab/vocab-tokenize-de';

config({ path: resolve(process.cwd(), '.env.test') });
config({ path: resolve(process.cwd(), '.env') });

const dryRun = process.argv.includes('--dry-run');
const mtArg = process.argv.find((a) => a.startsWith('--mt='));
const mtFilter = mtArg ? Number(mtArg.split('=')[1]) : null;

type TextChunk = { skill: string; revision: string; text: string };

function snippet(text: string, surface: string): string {
  const idx = text.toLowerCase().indexOf(surface.toLowerCase());
  if (idx < 0) return text.slice(0, 120);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + surface.length + 40);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

async function collectChunks(prisma: any, modelltestId: string): Promise<TextChunk[]> {
  const chunks: TextChunk[] = [];

  const lesen1 = await prisma.lesenTeil1Exercise.findUnique({
    where: { modelltest_id: modelltestId },
    include: { texts: true, titles: true },
  });
  if (lesen1) {
    const rev = lesen1.contentRevision ?? '';
    for (const t of lesen1.texts) {
      chunks.push({ skill: 'lesen', revision: rev, text: t.body });
    }
    for (const t of lesen1.titles) {
      chunks.push({ skill: 'lesen', revision: rev, text: t.content });
    }
  }

  const lesen2 = await prisma.lesenTeil2Exercise.findUnique({
    where: { modelltest_id: modelltestId },
  });
  if (lesen2) {
    const rev = lesen2.contentRevision ?? '';
    chunks.push({
      skill: 'lesen',
      revision: rev,
      text: [lesen2.topBody, lesen2.quotedThread, lesen2.instruction].join('\n'),
    });
  }

  const lesen3 = await prisma.lesenTeil3Exercise.findUnique({
    where: { modelltest_id: modelltestId },
    include: { situations: true, announcements: true },
  });
  if (lesen3) {
    const rev = lesen3.contentRevision ?? '';
    for (const t of lesen3.situations ?? []) {
      if (t.content) chunks.push({ skill: 'lesen', revision: rev, text: t.content });
    }
    for (const t of lesen3.announcements ?? []) {
      chunks.push({
        skill: 'lesen',
        revision: rev,
        text: [t.title, t.content].filter(Boolean).join('\n'),
      });
    }
  }

  const sb = await prisma.sprachbausteineExercise.findUnique({
    where: { modelltest_id: modelltestId },
  });
  if (sb) {
    chunks.push({
      skill: 'sprachbausteine',
      revision: sb.content_revision ?? '',
      text: sb.body,
    });
  }

  const sb2 = await prisma.sprachbausteineTeil2Exercise.findUnique({
    where: { modelltest_id: modelltestId },
    include: { words: true },
  });
  if (sb2) {
    const rev = sb2.contentRevision ?? '';
    chunks.push({
      skill: 'sprachbausteine',
      revision: rev,
      text: [sb2.body, sb2.instruction].filter(Boolean).join('\n'),
    });
    for (const w of sb2.words ?? []) {
      if (w.content) {
        chunks.push({ skill: 'sprachbausteine', revision: rev, text: w.content });
      }
    }
  }

  const listening = await prisma.listeningExercise.findMany({
    where: { modelltest_id: modelltestId },
  });
  for (const row of listening) {
    if (row.transcript) {
      chunks.push({
        skill: 'hoeren',
        revision: row.content_revision ?? '',
        text: row.transcript,
      });
    }
  }

  // Every Schreiben task, not one. The row used to be unique per Modelltest
  // and `findUnique({ modelltest_id })` was valid; B2 offers a choice of two,
  // so the key is now (modelltest_id, part) and that call would throw. Both
  // tasks carry vocabulary and a candidate sees both before choosing, so both
  // are collected.
  const writingTasks = await prisma.writingExercise.findMany({
    where: { modelltest_id: modelltestId },
    orderBy: { part: 'asc' },
  });
  for (const writing of writingTasks) {
    chunks.push({
      skill: 'schreiben',
      revision: writing.content_revision ?? '',
      text: [
        writing.title,
        writing.intro,
        writing.task_instructions,
        ...(writing.bullet_points ?? []),
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  return chunks;
}

async function upsertCandidate(
  prisma: any,
  modelltestId: string,
  candidate: TokenCandidate & { count: number },
  skillHits: Map<string, { skill: string; revision: string; snippet: string }>,
): Promise<void> {
  const entry = await prisma.vocabEntry.upsert({
    where: {
      lemma_article_pos: {
        lemma: candidate.lemma,
        article: candidate.article,
        pos: candidate.pos,
      },
    },
    create: {
      lemma: candidate.lemma,
      article: candidate.article,
      pos: candidate.pos,
      source: 'modelltest',
    },
    update: {},
  });

  // Ensure at least one sense stub so the row is usable before enrich.
  const senseCount = await prisma.vocabSense.count({
    where: { entry_id: entry.id },
  });
  if (senseCount === 0) {
    await prisma.vocabSense.create({
      data: {
        entry_id: entry.id,
        sort_order: 0,
        meaning_fr: '(à enrichir)',
        meaning_en: '(to enrich)',
        example_de: candidate.surface,
        example_fr: null,
        example_en: null,
      },
    });
  }

  for (const hit of skillHits.values()) {
    await prisma.vocabOccurrence.upsert({
      where: {
        vocab_entry_id_modelltest_id_skill_content_revision: {
          vocab_entry_id: entry.id,
          modelltest_id: modelltestId,
          skill: hit.skill,
          content_revision: hit.revision,
        },
      },
      create: {
        vocab_entry_id: entry.id,
        modelltest_id: modelltestId,
        skill: hit.skill,
        content_revision: hit.revision,
        context_snippet: hit.snippet,
        in_weekly_pack: false,
      },
      update: {
        context_snippet: hit.snippet,
      },
    });
  }
}

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL or DIRECT_URL required');

  const pool = new Pool({ connectionString });
  const prisma: any = new PrismaClient({
    adapter: new PrismaPg(pool),
  } as never);

  try {
    const modelltests = await prisma.modelltest.findMany({
      where: mtFilter != null && !Number.isNaN(mtFilter)
        ? { number: mtFilter }
        : undefined,
      orderBy: { number: 'asc' },
    });

    const reports: unknown[] = [];

    for (const mt of modelltests) {
      const chunks = await collectChunks(prisma, mt.id);
      const batches: TokenCandidate[][] = [];
      const skillByKey = new Map<
        string,
        Map<string, { skill: string; revision: string; snippet: string }>
      >();

      for (const chunk of chunks) {
        const extracted = extractCandidatesFromText(chunk.text);
        batches.push(extracted);
        for (const c of extracted) {
          const key = `${c.pos}|${c.article}|${c.lemma}`;
          if (!skillByKey.has(key)) skillByKey.set(key, new Map());
          const skills = skillByKey.get(key)!;
          const sk = `${chunk.skill}|${chunk.revision}`;
          if (!skills.has(sk)) {
            skills.set(sk, {
              skill: chunk.skill,
              revision: chunk.revision || '',
              snippet: snippet(chunk.text, c.surface),
            });
          }
        }
      }

      const merged = mergeCandidates(batches);
      const byPos: Record<string, number> = {};
      for (const c of merged.values()) {
        byPos[c.pos] = (byPos[c.pos] ?? 0) + 1;
      }

      if (!dryRun) {
        for (const [key, candidate] of merged) {
          await upsertCandidate(
            prisma,
            mt.id,
            candidate,
            skillByKey.get(key) ?? new Map(),
          );
        }
      }

      const topLemmas = [...merged.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
        .map((c) => ({
          lemma: c.lemma,
          pos: c.pos,
          article: c.article || null,
          count: c.count,
        }));

      reports.push({
        modelltestNumber: mt.number,
        chunks: chunks.length,
        candidatesFound: merged.size,
        byPos,
        topLemmas,
        dryRun,
      });
    }

    console.log(JSON.stringify({ ok: true, reports }, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
