/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
/**
 * Backfill prompt_en / explanation_en / explanation_de (and refresh prompt_de
 * as German UI instruction) for existing grammar exercises via templates.
 *
 * Matches by topic + difficulty. Does not delete rows or change answers/options
 * unless --regen-all is passed (then recreates like generate --force).
 *
 *   npx ts-node -r dotenv/config scripts/backfill-grammar-exercise-locales.ts
 *   ... --regen-all
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  generateExercisesFromExample,
  generateMinimalExercises,
  type GeneratedExercise,
} from '../src/modules/grammar/grammar-exercise-templates';

config({ path: resolve(process.cwd(), '.env.test') });
config({ path: resolve(process.cwd(), '.env') });

const regenAll = process.argv.includes('--regen-all');

function generatedByDifficulty(list: GeneratedExercise[]) {
  return new Map(list.map((exo) => [exo.difficulty, exo]));
}

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL or DIRECT_URL required');
  }

  const pool = new Pool({ connectionString });
  // Adapter typing erases Prisma delegates; use a loose client like other grammar scripts.
  const prisma: any = new PrismaClient({
    adapter: new PrismaPg(pool),
  } as never);

  let topicsDone = 0;
  let exercisesUpdated = 0;
  let exercisesCreated = 0;
  let unmatched = 0;

  try {
    const topics = await prisma.grammarTopic.findMany({
      include: { examples: true, exercises: true },
      orderBy: [{ sort_order: 'asc' }, { slug: 'asc' }],
    });

    for (const topic of topics) {
      const example = topic.examples[0];
      const generated = example
        ? generateExercisesFromExample({
            titleFr: topic.title_fr,
            titleEn: topic.title_en,
            titleDe: topic.title_de,
            ruleFr: topic.rule_fr,
            ruleEn: topic.rule_en,
            ruleDe: topic.rule_de,
            exampleDe: example.de,
            exampleEn: example.en,
          })
        : generateMinimalExercises({
            titleFr: topic.title_fr,
            titleEn: topic.title_en,
            titleDe: topic.title_de,
            ruleFr: topic.rule_fr,
            ruleEn: topic.rule_en,
            ruleDe: topic.rule_de,
          });

      if (regenAll) {
        await prisma.grammarExercise.deleteMany({
          where: { topic_id: topic.id },
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
        continue;
      }

      const byDiff = generatedByDifficulty(generated);
      for (const existing of topic.exercises) {
        const template = byDiff.get(
          existing.difficulty as 'easy' | 'medium' | 'hard',
        );
        if (!template) {
          unmatched += 1;
          continue;
        }
        await prisma.grammarExercise.update({
          where: { id: existing.id },
          data: {
            prompt_de: template.prompt_de,
            prompt_fr: template.prompt_fr,
            prompt_en: template.prompt_en,
            explanation_fr: template.explanation_fr,
            explanation_en: template.explanation_en,
            explanation_de: template.explanation_de,
          },
        });
        exercisesUpdated += 1;
      }
      topicsDone += 1;
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          regenAll,
          topicsDone,
          exercisesUpdated,
          exercisesCreated,
          unmatched,
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
