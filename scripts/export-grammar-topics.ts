/**
 * Export published grammar topics for lesson enrichment.
 *
 *   npm run grammar:export
 *
 * Writes content/grammar-lessons/_export/topics-index.json
 */
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.test') });

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL or DIRECT_URL required');
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as never);

  try {
    const topics = (await prisma.grammarTopic.findMany({
      where: { published: true },
      orderBy: { sort_order: 'asc' },
      include: { examples: true },
    })) as Array<{
      slug: string;
      sort_order: number;
      category: string;
      title_de: string;
      title_fr: string;
      title_en: string | null;
      rule_de: string;
      rule_fr: string;
      rule_en: string | null;
      notes_fr: string | null;
      notes_en: string | null;
      notes_de: string | null;
      cefr_levels: string[];
      examples: Array<{ de: string; fr: string | null; en: string | null }>;
    }>;

    const outDir = resolve(process.cwd(), 'content/grammar-lessons/_export');
    mkdirSync(outDir, { recursive: true });

    const index = topics.map((t) => ({
      slug: t.slug,
      sortOrder: t.sort_order,
      category: t.category,
      titleDe: t.title_de,
      titleFr: t.title_fr,
      titleEn: t.title_en,
      ruleDe: t.rule_de,
      ruleFr: t.rule_fr,
      ruleEn: t.rule_en,
      notesFr: t.notes_fr,
      notesEn: t.notes_en,
      notesDe: t.notes_de,
      cefrLevels: t.cefr_levels,
      examples: t.examples.map((e) => ({
        de: e.de,
        fr: e.fr,
        en: e.en,
      })),
    }));

    const outPath = resolve(outDir, 'topics-index.json');
    writeFileSync(outPath, JSON.stringify(index, null, 2), 'utf8');
    console.log(`Exported ${index.length} topics → ${outPath}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
