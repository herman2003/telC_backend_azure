/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
/**
 * Copy grammar + vocab catalogue data from local DB → remote (prod).
 * Remaps modelltest_id by MT number (UUIDs differ across envs).
 *
 *   LOCAL_DATABASE_URL=... REMOTE_DATABASE_URL=... \
 *   npx ts-node -r dotenv/config scripts/sync-vocab-grammar-local-to-remote.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

config({ path: resolve(process.cwd(), '.env') });

const LOCAL =
  process.env.LOCAL_DATABASE_URL ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL;
const REMOTE =
  process.env.REMOTE_DATABASE_URL || process.env.REMOTE_DIRECT_URL;

if (!LOCAL || !REMOTE) {
  throw new Error('LOCAL_DATABASE_URL and REMOTE_DATABASE_URL required');
}

function client(url: string): { prisma: any; pool: Pool } {
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes('localhost')
      ? undefined
      : { rejectUnauthorized: false },
  });
  const prisma: any = new PrismaClient({
    adapter: new PrismaPg(pool),
  } as never);
  return { prisma, pool };
}

async function loadMtMap(prisma: any): Promise<Map<number, string>> {
  const rows = await prisma.modelltest.findMany({
    select: { number: true, id: true },
    orderBy: { number: 'asc' },
  });
  return new Map(rows.map((r: { number: number; id: string }) => [r.number, r.id]));
}

async function copyBatched(
  label: string,
  rows: unknown[],
  insert: (batch: any[]) => Promise<unknown>,
  batchSize = 200,
): Promise<number> {
  let n = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await insert(batch);
    n += batch.length;
    if (n % 1000 === 0 || n === rows.length) {
      console.log(`  ${label}: ${n}/${rows.length}`);
    }
  }
  return n;
}

async function main(): Promise<void> {
  console.log('Connecting…');
  const local = client(LOCAL!);
  const remote = client(REMOTE!);

  try {
    const localMt = await loadMtMap(local.prisma);
    const remoteMt = await loadMtMap(remote.prisma);
    console.log('local MT numbers', [...localMt.keys()]);
    console.log('remote MT numbers', [...remoteMt.keys()]);

    const idByLocalMt = new Map<string, string>();
    for (const [num, localId] of localMt) {
      const remoteId = remoteMt.get(num);
      if (!remoteId) {
        console.warn(`  skip MT#${num}: missing on remote`);
        continue;
      }
      idByLocalMt.set(localId, remoteId);
    }

    // —— Grammar topics ——
    const topics = await local.prisma.grammarTopic.findMany();
    console.log(`grammar_topics ${topics.length}`);
    await remote.prisma.grammarTopic.deleteMany({});
    await copyBatched('grammar_topics', topics, (batch) =>
      remote.prisma.grammarTopic.createMany({ data: batch, skipDuplicates: true }),
    );

    const examples = await local.prisma.grammarExample.findMany();
    console.log(`grammar_examples ${examples.length}`);
    await remote.prisma.grammarExample.deleteMany({});
    await copyBatched('grammar_examples', examples, (batch) =>
      remote.prisma.grammarExample.createMany({ data: batch, skipDuplicates: true }),
    );

    const exercises = await local.prisma.grammarExercise.findMany();
    console.log(`grammar_exercises ${exercises.length}`);
    await remote.prisma.grammarExercise.deleteMany({});
    await copyBatched(
      'grammar_exercises',
      exercises,
      (batch) =>
        remote.prisma.grammarExercise.createMany({
          data: batch,
          skipDuplicates: true,
        }),
      100,
    );

    const links = await local.prisma.grammarTopicModelltest.findMany();
    const remappedLinks = links
      .map((l: any) => {
        const mt = idByLocalMt.get(l.modelltest_id);
        if (!mt) return null;
        return { ...l, modelltest_id: mt };
      })
      .filter(Boolean);
    console.log(
      `grammar_topic_modelltests ${remappedLinks.length}/${links.length}`,
    );
    await remote.prisma.grammarTopicModelltest.deleteMany({});
    await copyBatched('grammar_topic_modelltests', remappedLinks, (batch) =>
      remote.prisma.grammarTopicModelltest.createMany({
        data: batch,
        skipDuplicates: true,
      }),
    );

    // —— Vocab ——
    const entries = await local.prisma.vocabEntry.findMany();
    console.log(`vocab_entries ${entries.length}`);
    await remote.prisma.vocabOccurrence.deleteMany({});
    await remote.prisma.vocabVerbForm.deleteMany({});
    await remote.prisma.vocabSense.deleteMany({});
    await remote.prisma.vocabProgress.deleteMany({});
    await remote.prisma.vocabExercise.deleteMany({});
    await remote.prisma.vocabEntry.deleteMany({});
    await copyBatched('vocab_entries', entries, (batch) =>
      remote.prisma.vocabEntry.createMany({ data: batch, skipDuplicates: true }),
    );

    const senses = await local.prisma.vocabSense.findMany();
    console.log(`vocab_senses ${senses.length}`);
    await copyBatched('vocab_senses', senses, (batch) =>
      remote.prisma.vocabSense.createMany({ data: batch, skipDuplicates: true }),
    );

    const forms = await local.prisma.vocabVerbForm.findMany();
    console.log(`vocab_verb_forms ${forms.length}`);
    await copyBatched('vocab_verb_forms', forms, (batch) =>
      remote.prisma.vocabVerbForm.createMany({
        data: batch,
        skipDuplicates: true,
      }),
    );

    const occs = await local.prisma.vocabOccurrence.findMany();
    const remappedOccs = occs
      .map((o: any) => {
        const mt = idByLocalMt.get(o.modelltest_id);
        if (!mt) return null;
        return { ...o, modelltest_id: mt };
      })
      .filter(Boolean);
    console.log(`vocab_occurrences ${remappedOccs.length}/${occs.length}`);
    await copyBatched('vocab_occurrences', remappedOccs, (batch) =>
      remote.prisma.vocabOccurrence.createMany({
        data: batch,
        skipDuplicates: true,
      }),
    );

    const summary = {
      grammar_topics: await remote.prisma.grammarTopic.count(),
      grammar_examples: await remote.prisma.grammarExample.count(),
      grammar_exercises: await remote.prisma.grammarExercise.count(),
      grammar_topic_modelltests:
        await remote.prisma.grammarTopicModelltest.count(),
      vocab_entries: await remote.prisma.vocabEntry.count(),
      vocab_senses: await remote.prisma.vocabSense.count(),
      vocab_verb_forms: await remote.prisma.vocabVerbForm.count(),
      vocab_occurrences: await remote.prisma.vocabOccurrence.count(),
      pack: await remote.prisma.vocabOccurrence.count({
        where: { in_weekly_pack: true },
      }),
    };
    console.log(JSON.stringify({ ok: true, remote: summary }, null, 2));
  } finally {
    await local.prisma.$disconnect();
    await local.pool.end();
    await remote.prisma.$disconnect();
    await remote.pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
