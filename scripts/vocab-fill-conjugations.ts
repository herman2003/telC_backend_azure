/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
/**
 * Fill VocabVerbForm for weekly-pack verbs (all persons × V1 tenses).
 *
 *   npx ts-node -r dotenv/config scripts/vocab-fill-conjugations.ts
 *   npx ts-node -r dotenv/config scripts/vocab-fill-conjugations.ts --mt=3 --force
 *   npx ts-node -r dotenv/config scripts/vocab-fill-conjugations.ts --all-verbs
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { buildConjugation } from '../src/modules/vocab/vocab-conjugation';

config({ path: resolve(process.cwd(), '.env.test') });
config({ path: resolve(process.cwd(), '.env') });

const mtArg = process.argv.find((a) => a.startsWith('--mt='));
const FORCE = process.argv.includes('--force');
const ALL_VERBS = process.argv.includes('--all-verbs');
const mtFilter = mtArg ? Number(mtArg.split('=')[1]) : null;

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const prisma: any = new PrismaClient({
    adapter: new PrismaPg(pool),
  } as never);

  try {
    let entries: Array<{
      id: string;
      lemma: string;
      auxiliary: string | null;
      _count?: { verb_forms: number };
    }>;

    if (ALL_VERBS) {
      entries = await prisma.vocabEntry.findMany({
        where: { pos: 'verb' },
        select: {
          id: true,
          lemma: true,
          auxiliary: true,
          _count: { select: { verb_forms: true } },
        },
      });
    } else {
      const occWhere: Record<string, unknown> = { in_weekly_pack: true };
      if (mtFilter != null && Number.isFinite(mtFilter)) {
        occWhere.modelltest = { number: mtFilter };
      }
      const occs = await prisma.vocabOccurrence.findMany({
        where: occWhere,
        select: { vocab_entry_id: true },
        distinct: ['vocab_entry_id'],
      });
      const ids = occs.map((o: { vocab_entry_id: string }) => o.vocab_entry_id);
      entries = await prisma.vocabEntry.findMany({
        where: { id: { in: ids }, pos: 'verb' },
        select: {
          id: true,
          lemma: true,
          auxiliary: true,
          _count: { select: { verb_forms: true } },
        },
      });
    }

    let filled = 0;
    let skipped = 0;
    let missing = 0;

    for (const entry of entries) {
      const existing = entry._count?.verb_forms ?? 0;
      if (!FORCE && existing > 0) {
        skipped += 1;
        continue;
      }

      const conj = buildConjugation(entry.lemma, {
        auxiliary: entry.auxiliary,
      });
      if (!conj) {
        missing += 1;
        console.log(`  miss  ${entry.lemma}`);
        continue;
      }

      await prisma.$transaction(async (tx: any) => {
        await tx.vocabVerbForm.deleteMany({ where: { entry_id: entry.id } });
        await tx.vocabVerbForm.createMany({
          data: conj.rows.map((r) => ({
            entry_id: entry.id,
            tense: r.tense,
            person: r.person,
            form_de: r.form_de,
          })),
        });
        await tx.vocabEntry.update({
          where: { id: entry.id },
          data: {
            auxiliary: conj.auxiliary,
            partizip_ii: conj.partizipIi,
            separable: conj.separable,
          },
        });
      });

      filled += 1;
      console.log(
        `  ok    ${entry.lemma} (${conj.rows.length} forms, aux=${conj.auxiliary})`,
      );
    }

    console.log(
      JSON.stringify(
        {
          candidates: entries.length,
          filled,
          skipped,
          missingDict: missing,
          scope: ALL_VERBS ? 'all-verbs' : mtFilter != null ? `mt=${mtFilter}` : 'weekly-pack',
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
