/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
/**
 * Link ≥7 published grammar topics to each training Modelltest (weekly pool).
 * Deterministic round-robin — editorial override can replace later.
 *
 *   npx ts-node -r dotenv/config scripts/grammar-link-modelltests.ts
 *   npx ts-node -r dotenv/config scripts/grammar-link-modelltests.ts --per-mt=7
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

config({ path: resolve(process.cwd(), '.env.test') });
config({ path: resolve(process.cwd(), '.env') });

const perMtArg = process.argv.find((a) => a.startsWith('--per-mt='));
const TOPICS_PER_MT = Math.max(
  7,
  perMtArg ? Number(perMtArg.split('=')[1]) || 7 : 7,
);

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL or DIRECT_URL required');

  const pool = new Pool({ connectionString });
  const prisma: any = new PrismaClient({
    adapter: new PrismaPg(pool),
  } as never);

  try {
    const topics = await prisma.grammarTopic.findMany({
      where: { published: true },
      orderBy: [{ sort_order: 'asc' }, { slug: 'asc' }],
      select: { id: true, slug: true },
    });
    const modelltests = await prisma.modelltest.findMany({
      where: { exam_only: false },
      orderBy: { number: 'asc' },
      select: { id: true, number: true },
    });

    if (topics.length === 0) {
      throw new Error('No published grammar topics — import grammar first');
    }
    if (modelltests.length === 0) {
      throw new Error('No training Modelltests');
    }

    let linksCreated = 0;
    let linksUpdated = 0;

    for (let mi = 0; mi < modelltests.length; mi += 1) {
      const mt = modelltests[mi];
      const start = (mi * TOPICS_PER_MT) % topics.length;

      await prisma.grammarTopicModelltest.deleteMany({
        where: { modelltest_id: mt.id },
      });

      for (let j = 0; j < TOPICS_PER_MT; j += 1) {
        const topic = topics[(start + j) % topics.length];
        await prisma.grammarTopicModelltest.create({
          data: {
            topic_id: topic.id,
            modelltest_id: mt.id,
            sort_order: j,
          },
        });
        linksCreated += 1;
      }
      linksUpdated += 1;
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          topicsPerMt: TOPICS_PER_MT,
          modelltests: modelltests.length,
          publishedTopics: topics.length,
          linksCreated,
          modelltestsLinked: linksUpdated,
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
