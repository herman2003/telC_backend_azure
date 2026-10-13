/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Offline import: German Language API grammar → Postgres.
 *
 *   GERMAN_LANGUAGE_API_BASE_URL=https://german-language.onrender.com \
 *   GERMAN_LANGUAGE_API_KEY=... \
 *   DATABASE_URL=... \
 *   npx ts-node -r dotenv/config scripts/import-grammar-from-rep12.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  mapRep12GrammarRule,
  type Rep12GrammarRule,
} from '../src/modules/grammar/grammar-import.map';

config({ path: resolve(process.cwd(), '.env.test') });
config({ path: resolve(process.cwd(), '.env') });

const BASE =
  process.env.GERMAN_LANGUAGE_API_BASE_URL ??
  'https://german-language.onrender.com';
const API_KEY = process.env.GERMAN_LANGUAGE_API_KEY ?? 'demo-key-12345';
const PAGE = 100;

interface GrammarPage {
  total: number;
  returned: number;
  offset: number;
  data: Rep12GrammarRule[];
}

async function fetchPage(offset: number): Promise<GrammarPage> {
  const url = `${BASE.replace(/\/$/, '')}/grammar?limit=${PAGE}&offset=${offset}`;
  const res = await fetch(url, {
    headers: { 'X-API-Key': API_KEY },
  });
  if (!res.ok) {
    throw new Error(`rep12 grammar ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as GrammarPage;
}

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL or DIRECT_URL required');
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as never);

  let offset = 0;
  let created = 0;
  let updated = 0;
  let sortOrder = 0;

  try {
    for (;;) {
      const page = await fetchPage(offset);
      if (!page.data?.length) break;

      for (const row of page.data) {
        const mapped = mapRep12GrammarRule(row, sortOrder++);
        const existing = await prisma.grammarTopic.findUnique({
          where: { external_id: mapped.externalId },
        });

        const topic = await prisma.grammarTopic.upsert({
          where: { external_id: mapped.externalId },
          create: {
            slug: mapped.slug,
            category: mapped.category,
            title_de: mapped.titleDe,
            title_fr: mapped.titleFr,
            title_en: mapped.titleEn,
            cefr_levels: mapped.cefrLevels,
            rule_de: mapped.ruleDe,
            rule_fr: mapped.ruleFr,
            rule_en: mapped.ruleEn,
            notes_fr: mapped.notesFr,
            external_id: mapped.externalId,
            sort_order: mapped.sortOrder,
            published: true,
          },
          update: {
            category: mapped.category,
            title_de: mapped.titleDe,
            title_fr: mapped.titleFr,
            title_en: mapped.titleEn,
            cefr_levels: mapped.cefrLevels,
            rule_de: mapped.ruleDe,
            rule_fr: mapped.ruleFr,
            rule_en: mapped.ruleEn,
            notes_fr: mapped.notesFr,
            sort_order: mapped.sortOrder,
            published: true,
          },
        });

        if (existing) updated += 1;
        else created += 1;

        if (mapped.example) {
          const examples = await prisma.grammarExample.findMany({
            where: { topic_id: topic.id },
          });
          if (examples.length === 0) {
            await prisma.grammarExample.create({
              data: {
                topic_id: topic.id,
                de: mapped.example.de,
                en: mapped.example.en,
                fr: mapped.example.fr,
              },
            });
          }
        }
      }

      offset += page.returned || page.data.length;
      console.log(
        `imported offset=${offset} total≈${page.total} created=${created} updated=${updated}`,
      );
      if (offset >= page.total || page.returned === 0) break;
    }

    console.log(
      JSON.stringify({ ok: true, created, updated, sortOrder }, null, 2),
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
