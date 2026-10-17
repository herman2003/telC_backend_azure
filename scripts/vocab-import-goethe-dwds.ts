/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
/**
 * Import official Goethe-Zertifikat word lists (A1/A2/B1) published via DWDS.
 * Source for pack scoring: source=goethe (mots utiles recommandés pour l’examen).
 *
 *   npx ts-node -r dotenv/config scripts/vocab-import-goethe-dwds.ts
 *   npx ts-node -r dotenv/config scripts/vocab-import-goethe-dwds.ts --with-frequency
 *
 * Lists: https://www.dwds.de/api/lemma/goethe/{A1|A2|B1}.json
 * Copyright Goethe-Institut — used offline as learning catalogue seed (see VOCAB_GRAMMAR_SPEC).
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  mapGoetheDwdsRow,
  type GoetheDwdsRow,
} from '../src/modules/vocab/vocab-import.map';

config({ path: resolve(process.cwd(), '.env.test') });
config({ path: resolve(process.cwd(), '.env') });

const LEVELS = ['A1', 'A2', 'B1'] as const;
const WITH_FREQUENCY = process.argv.includes('--with-frequency');
const USER_AGENT = 'LerniqoVocabImport/1.0 (offline catalogue; educational)';

async function fetchGoetheLevel(level: string): Promise<GoetheDwdsRow[]> {
  const url = `https://www.dwds.de/api/lemma/goethe/${level}.json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`DWDS Goethe ${level} ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as GoetheDwdsRow[];
}

async function fetchDwdsFrequency(lemma: string): Promise<number | null> {
  const url = `https://www.dwds.de/api/frequency/?q=${encodeURIComponent(lemma)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { frequency?: number };
  return typeof body.frequency === 'number' ? body.frequency : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Prefer lower CEFR when merging (A1 wins over B1). */
function preferLowerCefr(a: string | null | undefined, b: string): string {
  const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  if (!a) return b;
  const ia = order.indexOf(a.toUpperCase());
  const ib = order.indexOf(b.toUpperCase());
  if (ia < 0) return b;
  if (ib < 0) return a;
  return ia <= ib ? a.toUpperCase() : b.toUpperCase();
}

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL or DIRECT_URL required');

  const pool = new Pool({ connectionString });
  const prisma: any = new PrismaClient({
    adapter: new PrismaPg(pool),
  } as never);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let freqUpdated = 0;

  try {
    for (const level of LEVELS) {
      const rows = await fetchGoetheLevel(level);
      for (const row of rows) {
        const mapped = mapGoetheDwdsRow(row, level);
        if (!mapped) {
          skipped += 1;
          continue;
        }

        const existing = await prisma.vocabEntry.findUnique({
          where: {
            lemma_article_pos: {
              lemma: mapped.lemma,
              article: mapped.article,
              pos: mapped.pos,
            },
          },
        });

        const nextCefr = preferLowerCefr(existing?.cefr_level, mapped.cefrLevel);
        // Keep modelltest anchorage; otherwise mark as official Goethe list.
        const nextSource =
          existing?.source === 'modelltest' ? 'modelltest' : 'goethe';

        let dwdsFrequency: number | null = existing?.dwds_frequency ?? null;
        if (WITH_FREQUENCY && dwdsFrequency == null) {
          dwdsFrequency = await fetchDwdsFrequency(mapped.lemma);
          if (dwdsFrequency != null) freqUpdated += 1;
          await sleep(80);
        }

        const entry = await prisma.vocabEntry.upsert({
          where: {
            lemma_article_pos: {
              lemma: mapped.lemma,
              article: mapped.article,
              pos: mapped.pos,
            },
          },
          create: {
            lemma: mapped.lemma,
            article: mapped.article,
            gender: mapped.gender,
            pos: mapped.pos,
            cefr_level: mapped.cefrLevel,
            source: 'goethe',
            dwds_frequency: dwdsFrequency,
          },
          update: {
            cefr_level: nextCefr,
            gender: mapped.gender ?? undefined,
            source: nextSource,
            ...(dwdsFrequency != null ? { dwds_frequency: dwdsFrequency } : {}),
          },
        });

        const senseCount = await prisma.vocabSense.count({
          where: { entry_id: entry.id },
        });
        if (senseCount === 0) {
          await prisma.vocabSense.create({
            data: {
              entry_id: entry.id,
              sort_order: 0,
              meaning_fr: '(à enrichir)',
              meaning_en: null,
              example_de: mapped.lemma,
              example_fr: null,
              example_en: null,
            },
          });
        }

        if (existing) updated += 1;
        else created += 1;
      }
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          created,
          updated,
          skipped,
          freqUpdated,
          withFrequency: WITH_FREQUENCY,
          levels: LEVELS,
          source: 'dwds.goethe',
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
