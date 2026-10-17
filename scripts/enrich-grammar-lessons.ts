/**
 * Upsert long-form grammar lessons (FR + EN + DE) from JSON files.
 *
 *   npm run grammar:enrich
 *   npm run grammar:enrich -- content/grammar-lessons/batch-01
 *
 * Each file: { slug, titleFr?, titleEn?, titleDe?, ruleFr, ruleEn, ruleDe,
 *   notesFr?, notesEn?, notesDe?, examples: [{ de, fr?, en? }] }
 *
 * Does not overwrite existing title_de / example.de; merges example glosses.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, join, extname } from 'path';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  buildTopicEnrichUpdate,
  mergeGrammarExamples,
  type GrammarEnrichLesson,
} from '../src/modules/grammar/grammar-enrich.merge';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.test') });

function collectJsonFiles(root: string): string[] {
  const st = statSync(root);
  if (st.isFile()) {
    return extname(root) === '.json' ? [root] : [];
  }
  const out: string[] = [];
  for (const name of readdirSync(root)) {
    if (name.startsWith('_') || name.startsWith('.')) continue;
    const full = join(root, name);
    const child = statSync(full);
    if (child.isDirectory()) out.push(...collectJsonFiles(full));
    else if (extname(name) === '.json') out.push(full);
  }
  return out.sort();
}

function loadLesson(path: string): GrammarEnrichLesson {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as GrammarEnrichLesson;
  if (!raw.slug?.trim()) throw new Error(`${path}: missing slug`);
  if (!raw.ruleFr?.trim() || !raw.ruleEn?.trim() || !raw.ruleDe?.trim()) {
    throw new Error(`${path}: ruleFr, ruleEn, and ruleDe are required`);
  }
  if (!Array.isArray(raw.examples) || raw.examples.length < 1) {
    throw new Error(`${path}: at least one example required`);
  }
  for (const ex of raw.examples) {
    if (!ex.de?.trim()) throw new Error(`${path}: example.de required`);
  }
  return raw;
}

async function main() {
  const argPath =
    process.argv[2] ?? resolve(process.cwd(), 'content/grammar-lessons');
  const root = resolve(process.cwd(), argPath);
  const files = collectJsonFiles(root);
  if (files.length === 0) {
    console.error(`No lesson JSON files under ${root}`);
    process.exit(1);
  }

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL or DIRECT_URL required');
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as never);

  let updated = 0;
  let missing = 0;
  let examplesUpdated = 0;
  let examplesCreated = 0;

  try {
    for (const file of files) {
      const lesson = loadLesson(file);
      const topic = (await prisma.grammarTopic.findUnique({
        where: { slug: lesson.slug },
        include: { examples: true },
      })) as {
        id: string;
        slug: string;
        title_de: string;
        title_fr: string;
        title_en: string | null;
        rule_de: string;
        rule_fr: string;
        rule_en: string | null;
        notes_fr: string | null;
        notes_en: string | null;
        notes_de: string | null;
        examples: Array<{
          id: string;
          de: string;
          fr: string | null;
          en: string | null;
        }>;
      } | null;
      if (!topic) {
        console.warn(`SKIP missing slug: ${lesson.slug} (${file})`);
        missing += 1;
        continue;
      }

      const payload = buildTopicEnrichUpdate(
        {
          slug: topic.slug,
          title_de: topic.title_de,
          title_fr: topic.title_fr,
          title_en: topic.title_en,
          rule_de: topic.rule_de,
          rule_fr: topic.rule_fr,
          rule_en: topic.rule_en,
          notes_fr: topic.notes_fr,
          notes_en: topic.notes_en,
          notes_de: topic.notes_de,
          examples: topic.examples,
        },
        lesson,
      );

      await prisma.grammarTopic.update({
        where: { id: topic.id },
        data: payload,
      });
      updated += 1;

      const plan = mergeGrammarExamples(topic.examples, lesson.examples);
      for (const u of plan.updates) {
        await prisma.grammarExample.update({
          where: { id: u.id },
          data: { fr: u.fr, en: u.en },
        });
        examplesUpdated += 1;
      }
      for (const c of plan.creates) {
        await prisma.grammarExample.create({
          data: {
            topic_id: topic.id,
            de: c.de,
            fr: c.fr ?? null,
            en: c.en ?? null,
          },
        });
        examplesCreated += 1;
      }

      console.log(`OK ${lesson.slug}`);
    }

    console.log(
      JSON.stringify(
        {
          files: files.length,
          topicsUpdated: updated,
          missingSlugs: missing,
          examplesUpdated,
          examplesCreated,
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
