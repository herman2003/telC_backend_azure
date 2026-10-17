/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
/**
 * Mark in_weekly_pack via selectWeeklyPack for each training Modelltest.
 *
 *   npx ts-node -r dotenv/config scripts/vocab-curate-weekly-pack.ts
 *   npx ts-node -r dotenv/config scripts/vocab-curate-weekly-pack.ts --mt=2
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  selectWeeklyPack,
  type PackCandidate,
  type VocabPackPos,
  VOCAB_PACK_QUOTAS,
  outsideMtCount,
} from '../src/modules/vocab/vocab-pack-score';

config({ path: resolve(process.cwd(), '.env.test') });
config({ path: resolve(process.cwd(), '.env') });

const mtArg = process.argv.find((a) => a.startsWith('--mt='));
const mtFilter = mtArg ? Number(mtArg.split('=')[1]) : null;

const PACK_POS = new Set(Object.keys(VOCAB_PACK_QUOTAS));

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL or DIRECT_URL required');

  const pool = new Pool({ connectionString });
  const prisma: any = new PrismaClient({
    adapter: new PrismaPg(pool),
  } as never);

  try {
    const modelltests = await prisma.modelltest.findMany({
      where: {
        exam_only: false,
        ...(mtFilter != null && !Number.isNaN(mtFilter)
          ? { number: mtFilter }
          : {}),
      },
      orderBy: { number: 'asc' },
    });

    const reports: unknown[] = [];

    for (const mt of modelltests) {
      await prisma.vocabOccurrence.updateMany({
        where: { modelltest_id: mt.id },
        data: { in_weekly_pack: false },
      });

      const occ = await prisma.vocabOccurrence.findMany({
        where: { modelltest_id: mt.id },
        include: { entry: true },
      });

      const byEntry = new Map<
        string,
        { entry: any; skills: Set<string> }
      >();
      for (const o of occ) {
        if (!PACK_POS.has(o.entry.pos)) continue;
        const cur = byEntry.get(o.vocab_entry_id);
        if (cur) {
          cur.skills.add(o.skill);
        } else {
          byEntry.set(o.vocab_entry_id, {
            entry: o.entry,
            skills: new Set([o.skill]),
          });
        }
      }

      // Catalogue hors MT : listes officielles Goethe + CEFR réputés uniquement.
      const outside = await prisma.vocabEntry.findMany({
        where: {
          pos: { in: [...PACK_POS] },
          source: { in: ['goethe', 'telc', 'cefr_list', 'manual'] },
          NOT: {
            occurrences: { some: { modelltest_id: mt.id } },
          },
        },
        take: 4000,
      });

      const candidates: PackCandidate[] = [];
      for (const [entryId, { entry, skills }] of byEntry) {
        candidates.push({
          entryId,
          lemma: entry.lemma,
          pos: entry.pos as VocabPackPos,
          inModelltest: true,
          skillCount: skills.size,
          frequencyRank: entry.frequency_rank,
          dwdsFrequency: entry.dwds_frequency,
          inCefrList:
            entry.source === 'cefr_list' ||
            entry.source === 'goethe' ||
            entry.source === 'telc' ||
            !!entry.cefr_level,
          inGoetheList: entry.source === 'goethe',
          inTelcList: entry.source === 'telc',
          isNoise: entry.lemma.length < 2,
        });
      }
      for (const entry of outside) {
        if (byEntry.has(entry.id)) continue;
        candidates.push({
          entryId: entry.id,
          lemma: entry.lemma,
          pos: entry.pos as VocabPackPos,
          inModelltest: false,
          skillCount: 0,
          frequencyRank: entry.frequency_rank,
          dwdsFrequency: entry.dwds_frequency,
          inCefrList:
            entry.source === 'cefr_list' ||
            entry.source === 'goethe' ||
            entry.source === 'telc' ||
            !!entry.cefr_level,
          inGoetheList: entry.source === 'goethe',
          inTelcList: entry.source === 'telc',
          isNoise: entry.lemma.length < 2,
        });
      }

      const selected = selectWeeklyPack(candidates);

      for (const sel of selected) {
        if (sel.inModelltest) {
          await prisma.vocabOccurrence.updateMany({
            where: {
              modelltest_id: mt.id,
              vocab_entry_id: sel.entryId,
            },
            data: { in_weekly_pack: true },
          });
        } else {
          // Attach reputable lemma to this MT pack via a synthetic occurrence.
          await prisma.vocabOccurrence.upsert({
            where: {
              vocab_entry_id_modelltest_id_skill_content_revision: {
                vocab_entry_id: sel.entryId,
                modelltest_id: mt.id,
                skill: 'catalogue',
                content_revision: 'pack',
              },
            },
            create: {
              vocab_entry_id: sel.entryId,
              modelltest_id: mt.id,
              skill: 'catalogue',
              content_revision: 'pack',
              context_snippet: null,
              in_weekly_pack: true,
            },
            update: { in_weekly_pack: true },
          });
        }
      }

      reports.push({
        modelltestNumber: mt.number,
        selected: selected.length,
        outsideMt: outsideMtCount(selected),
        byPos: Object.fromEntries(
          (Object.keys(VOCAB_PACK_QUOTAS) as VocabPackPos[]).map((pos) => [
            pos,
            selected.filter((s) => s.pos === pos).length,
          ]),
        ),
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
