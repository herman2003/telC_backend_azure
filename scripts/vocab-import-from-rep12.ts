/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
/**
 * Import CEFR vocab lists from German Language API (rep12) into VocabEntry.
 *
 *   npx ts-node -r dotenv/config scripts/vocab-import-from-rep12.ts
 *   npx ts-node -r dotenv/config scripts/vocab-import-from-rep12.ts --per-level=400
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { mapRep12VocabRow, type Rep12VocabRow } from '../src/modules/vocab/vocab-import.map';

config({ path: resolve(process.cwd(), '.env.test') });
config({ path: resolve(process.cwd(), '.env') });

const BASE =
  process.env.GERMAN_LANGUAGE_API_BASE_URL ??
  'https://german-language.onrender.com';
function requireApiKey(): string {
  const key = process.env.GERMAN_LANGUAGE_API_KEY?.trim();
  if (!key) {
    throw new Error('GERMAN_LANGUAGE_API_KEY is required for vocab:import-rep12');
  }
  return key;
}
const API_KEY = requireApiKey();
const LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1'] as const;
const PAGE = 100;

const perLevelArg = process.argv.find((a) => a.startsWith('--per-level='));
const PER_LEVEL = Math.max(
  50,
  perLevelArg ? Number(perLevelArg.split('=')[1]) || 400 : 400,
);

interface VocabPage {
  total: number;
  returned: number;
  offset: number;
  data: Rep12VocabRow[];
}

async function fetchPage(level: string, offset: number): Promise<VocabPage> {
  const url = `${BASE.replace(/\/$/, '')}/vocab?level=${level}&limit=${PAGE}&offset=${offset}`;
  const res = await fetch(url, { headers: { 'X-API-Key': API_KEY } });
  if (!res.ok) {
    throw new Error(`rep12 vocab ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as VocabPage;
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

  try {
    for (const level of LEVELS) {
      let offset = 0;
      let importedForLevel = 0;
      while (importedForLevel < PER_LEVEL) {
        const page = await fetchPage(level, offset);
        if (!page.data?.length) break;

        for (const row of page.data) {
          if (importedForLevel >= PER_LEVEL) break;
          const mapped = mapRep12VocabRow(row, level);
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
              source: 'cefr_list',
              frequency_rank: mapped.frequencyRank,
            },
            update: {
              cefr_level: mapped.cefrLevel,
              frequency_rank: mapped.frequencyRank ?? undefined,
              gender: mapped.gender ?? undefined,
              source: existing?.source === 'modelltest' ? 'modelltest' : 'cefr_list',
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
                meaning_fr: mapped.meaningEn, // FR enrich later via Gemini
                meaning_en: mapped.meaningEn,
                example_de: mapped.exampleDe,
                example_en: mapped.exampleEn,
                example_fr: null,
              },
            });
          } else {
            // Upgrade stub senses from extract
            await prisma.vocabSense.updateMany({
              where: {
                entry_id: entry.id,
                meaning_fr: '(à enrichir)',
              },
              data: {
                meaning_fr: mapped.meaningEn,
                meaning_en: mapped.meaningEn,
                example_de: mapped.exampleDe,
                example_en: mapped.exampleEn,
              },
            });
          }

          if (existing) updated += 1;
          else created += 1;
          importedForLevel += 1;
        }

        offset += page.returned;
        if (page.returned < PAGE) break;
      }
    }

    console.log(
      JSON.stringify(
        { ok: true, created, updated, skipped, perLevel: PER_LEVEL, levels: LEVELS },
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
