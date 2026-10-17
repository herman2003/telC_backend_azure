/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
/**
 * Generate realistic easy/medium/hard QCMs from imported grammar examples.
 *
 *   DATABASE_URL=... npx ts-node -r dotenv/config scripts/generate-grammar-exercises.ts
 *   ... --force  to replace existing exercises
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  generateExercisesFromExamples,
  generateMinimalExercises,
} from '../src/modules/grammar/grammar-exercise-templates';

config({ path: resolve(process.cwd(), '.env.test') });
config({ path: resolve(process.cwd(), '.env') });

const force = process.argv.includes('--force');

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL or DIRECT_URL required');
  }

  const pool = new Pool({ connectionString });
  const prisma: any = new PrismaClient({
    adapter: new PrismaPg(pool),
  } as never);

  let topicsDone = 0;
  let exercisesCreated = 0;
  let skipped = 0;

  try {
    const topics = await prisma.grammarTopic.findMany({
      include: { examples: true, exercises: true },
      orderBy: [{ sort_order: 'asc' }, { slug: 'asc' }],
    });
    const allTitlesDe = topics.map((t: { title_de: string }) => t.title_de);

    for (const topic of topics) {
      if (topic.exercises.length > 0 && !force) {
        skipped += 1;
        continue;
      }
      if (force && topic.exercises.length > 0) {
        await prisma.grammarExercise.deleteMany({
          where: { topic_id: topic.id },
        });
      }

      const otherTitlesDe = allTitlesDe.filter(
        (t: string) => t !== topic.title_de,
      );
      const examples = (topic.examples as Array<{
        de: string;
        fr: string | null;
        en: string | null;
      }>).map((e) => ({ de: e.de, fr: e.fr, en: e.en }));

      const generated =
        examples.length > 0
          ? generateExercisesFromExamples({
              titleFr: topic.title_fr,
              titleEn: topic.title_en,
              titleDe: topic.title_de,
              ruleFr: topic.rule_fr,
              ruleEn: topic.rule_en,
              ruleDe: topic.rule_de,
              examples,
              otherTitlesDe,
            })
          : generateMinimalExercises({
              titleFr: topic.title_fr,
              titleEn: topic.title_en,
              titleDe: topic.title_de,
              ruleFr: topic.rule_fr,
              ruleEn: topic.rule_en,
              ruleDe: topic.rule_de,
              otherTitlesDe,
            });

      for (const exo of generated) {
        await prisma.grammarExercise.create({
          data: {
            topic_id: topic.id,
            kind: exo.kind,
            difficulty: exo.difficulty,
            sort_order: exo.sort_order,
            prompt_de: exo.prompt_de,
            prompt_fr: exo.prompt_fr,
            prompt_en: exo.prompt_en,
            options_json: exo.options_json ?? undefined,
            answer: exo.answer,
            explanation_fr: exo.explanation_fr,
            explanation_en: exo.explanation_en,
            explanation_de: exo.explanation_de,
          },
        });
        exercisesCreated += 1;
      }
      topicsDone += 1;
    }

    console.log(
      JSON.stringify(
        { ok: true, topicsDone, exercisesCreated, skipped },
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
