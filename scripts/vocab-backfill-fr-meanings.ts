/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
/**
 * Backfill meaning_fr / example_fr for weekly-pack senses.
 * Source: French Wiktionary (preferred) → MyMemory EN→FR fallback.
 *
 *   npx ts-node -r dotenv/config scripts/vocab-backfill-fr-meanings.ts
 *   npx ts-node -r dotenv/config scripts/vocab-backfill-fr-meanings.ts --mt=3
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  sensesFromFrWiktionaryParse,
  type FrWiktionaryApiParse,
  type FrWiktionarySense,
} from '../src/modules/vocab/vocab-wiktionary-fr';

config({ path: resolve(process.cwd(), '.env.test') });
config({ path: resolve(process.cwd(), '.env') });

const USER_AGENT = 'LerniqoVocabImport/1.0 (educational; FR gloss backfill)';
const mtArg = process.argv.find((a) => a.startsWith('--mt='));
const mtFilter = mtArg ? Number(mtArg.split('=')[1]) : null;
const FORCE = process.argv.includes('--force');

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function needsFr(meaningFr: string | null, meaningEn: string | null): boolean {
  if (FORCE) return true;
  if (!meaningFr?.trim()) return true;
  if (meaningEn && meaningFr.trim() === meaningEn.trim()) return true;
  // Still English gloss sitting in FR field
  if (/^(to|the|a|an)\s/i.test(meaningFr.trim())) return true;
  return false;
}

async function fetchFrWiki(
  lemma: string,
  pos: string,
): Promise<FrWiktionarySense[]> {
  const variants = [
    lemma,
    lemma.toLowerCase(),
    lemma.charAt(0).toUpperCase() + lemma.slice(1).toLowerCase(),
  ];
  const seen = new Set<string>();
  for (const v of variants) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    const title = encodeURIComponent(v);
    const url = `https://fr.wiktionary.org/w/api.php?action=parse&page=${title}&prop=wikitext&format=json&redirects=1`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      const text = await res.text();
      if (res.status === 429 || text.startsWith('You are')) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      let json: FrWiktionaryApiParse;
      try {
        json = JSON.parse(text) as FrWiktionaryApiParse;
      } catch {
        await sleep(800);
        continue;
      }
      if (json.error) break;
      const senses = sensesFromFrWiktionaryParse(json, pos);
      if (senses.length > 0) return senses;
      break;
    }
    await sleep(400);
  }
  return [];
}

async function translateEnToFr(text: string): Promise<string | null> {
  const q = text.trim();
  if (!q) return null;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q.slice(0, 450))}&langpair=en|fr`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number;
    };
    if (json.responseStatus !== 200) return null;
    const t = json.responseData?.translatedText?.trim();
    if (!t || t.toLowerCase() === q.toLowerCase()) return null;
    if (/invalid|query length|my?memory/i.test(t)) return null;
    return t;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const prisma: any = new PrismaClient({
    adapter: new PrismaPg(pool),
  } as never);

  let entriesDone = 0;
  let sensesUpdated = 0;
  let fromWiki = 0;
  let fromMt = 0;
  let skipped = 0;

  try {
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
    const entries = await prisma.vocabEntry.findMany({
      where: { id: { in: ids } },
      include: { senses: { orderBy: { sort_order: 'asc' } } },
    });

    for (const entry of entries) {
      const senses = entry.senses ?? [];
      if (senses.length === 0) {
        skipped += 1;
        continue;
      }
      const todo = senses.filter((s: any) =>
        needsFr(s.meaning_fr, s.meaning_en),
      );
      if (todo.length === 0) {
        skipped += 1;
        continue;
      }

      const frWiki = await fetchFrWiki(entry.lemma, entry.pos);
      let usedWiki = false;

      for (let i = 0; i < senses.length; i += 1) {
        const s = senses[i];
        if (!needsFr(s.meaning_fr, s.meaning_en)) continue;

        let meaningFr: string | null = null;
        let exampleFr: string | null = s.example_fr;

        if (frWiki[i]) {
          meaningFr = frWiki[i].meaningFr;
          if (frWiki[i].exampleFr) exampleFr = frWiki[i].exampleFr;
          usedWiki = true;
        } else if (frWiki.length === 1 && i === 0) {
          meaningFr = frWiki[0]!.meaningFr;
          if (frWiki[0]!.exampleFr) exampleFr = frWiki[0]!.exampleFr;
          usedWiki = true;
        } else if (s.meaning_en) {
          meaningFr = await translateEnToFr(s.meaning_en);
          if (meaningFr) fromMt += 1;
          await sleep(120);
        }

        if (!meaningFr) continue;

        await prisma.vocabSense.update({
          where: { id: s.id },
          data: {
            meaning_fr: meaningFr,
            example_fr: exampleFr,
          },
        });
        sensesUpdated += 1;
      }

      if (usedWiki) fromWiki += 1;
      entriesDone += 1;
      console.log(
        `  ${entry.lemma}  wiki=${frWiki.length}  senses=${senses.length}`,
      );
      await sleep(280);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          entriesDone,
          sensesUpdated,
          entriesSkipped: skipped,
          fromFrWiki: fromWiki,
          fromMyMemory: fromMt,
          scope: mtFilter != null ? `mt=${mtFilter}` : 'weekly-pack',
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
