/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
/**
 * Enrich weekly-pack entries with MULTIPLE senses from Wiktionary (+ Gemini FR).
 *
 * Pipeline:
 *   1) English Wiktionary (DE lemma) → N lexical senses + examples
 *   2) Gemini → translate glosses/examples to FR
 *   3) Order sense #0 by Modelltest context snippet
 *
 *   npx ts-node -r dotenv/config scripts/vocab-enrich-pack-senses.ts --force
 *   npx ts-node -r dotenv/config scripts/vocab-enrich-pack-senses.ts --mt=3 --force
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { GoogleGenAI } from '@google/genai';
import {
  needsMultiSenseEnrich,
  orderSensesByContext,
  parseMultiSenseJson,
  type MultiSenseDraft,
} from '../src/modules/vocab/vocab-multi-sense';
import {
  sensesFromWiktionaryParse,
  type WiktionaryApiParse,
  type WiktionarySense,
} from '../src/modules/vocab/vocab-wiktionary';
import {
  sensesFromFrWiktionaryParse,
  type FrWiktionaryApiParse,
} from '../src/modules/vocab/vocab-wiktionary-fr';

config({ path: resolve(process.cwd(), '.env.test') });
config({ path: resolve(process.cwd(), '.env') });

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_TEXT_MODEL ?? 'gemini-2.0-flash';
const USER_AGENT = 'LerniqoVocabImport/1.0 (educational; offline catalogue)';

const mtArg = process.argv.find((a) => a.startsWith('--mt='));
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const FORCE = process.argv.includes('--force');
const mtFilter = mtArg ? Number(mtArg.split('=')[1]) : null;
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) || 120 : 120;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchEnWiktionaryPage(
  lemma: string,
  pos?: string,
): Promise<WiktionarySense[]> {
  const title = encodeURIComponent(lemma);
  const url = `https://en.wiktionary.org/w/api.php?action=parse&page=${title}&prop=wikitext&format=json&redirects=1`;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    const text = await res.text();
    if (res.status === 429 || text.startsWith('You are')) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    let json: WiktionaryApiParse & { error?: { code?: string } };
    try {
      json = JSON.parse(text) as WiktionaryApiParse & {
        error?: { code?: string };
      };
    } catch {
      await sleep(1500);
      continue;
    }
    if (json.error) return [];
    let senses = sensesFromWiktionaryParse(json, pos);
    if (senses.length === 0 && pos) {
      senses = sensesFromWiktionaryParse(json, undefined);
    }
    return senses;
  }
  return [];
}

/** Try lemma casing variants; fall back without POS filter. */
async function fetchWikiSenses(
  lemma: string,
  pos: string,
): Promise<WiktionarySense[]> {
  const variants = [
    lemma,
    lemma.toLowerCase(),
    lemma.charAt(0).toUpperCase() + lemma.slice(1).toLowerCase(),
  ];
  const seen = new Set<string>();
  for (const v of variants) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    const senses = await fetchEnWiktionaryPage(v, pos);
    if (senses.length > 0) return senses;
    await sleep(600);
  }
  return [];
}

async function fetchFrWikiSenses(
  lemma: string,
  pos?: string,
): Promise<
  Array<{ meaningFr: string; exampleFr: string | null; exampleDe: string | null }>
> {
  const variants = [
    lemma,
    lemma.toLowerCase(),
    lemma.charAt(0).toUpperCase() + lemma.slice(1).toLowerCase(),
  ];
  const seen = new Set<string>();
  for (const v of variants) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    const url = `https://fr.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(v)}&prop=wikitext&format=json&redirects=1`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      const json = (await res.json()) as FrWiktionaryApiParse;
      if (json.error) continue;
      const senses = sensesFromFrWiktionaryParse(json, pos);
      if (senses.length > 0) return senses;
    } catch {
      /* try next variant */
    }
    await sleep(400);
  }
  return [];
}

async function translateSensesToFr(
  lemma: string,
  wiki: WiktionarySense[],
  pos?: string,
): Promise<MultiSenseDraft[]> {
  const frWiki = await fetchFrWikiSenses(lemma, pos);
  const base: MultiSenseDraft[] = wiki.map((s, i) => ({
    meaningFr: frWiki[i]?.meaningFr || s.meaningEn,
    meaningEn: s.meaningEn,
    exampleDe: s.exampleDe || frWiki[i]?.exampleDe || lemma,
    exampleFr: frWiki[i]?.exampleFr ?? null,
    exampleEn: s.exampleEn,
    noteFr: null,
  }));

  // Prefer FR Wiktionary; skip Gemini when all senses already have real FR
  const allFr =
    frWiki.length > 0 &&
    base.every((b, i) => frWiki[i] && b.meaningFr !== b.meaningEn);
  if (allFr || !GEMINI_KEY || wiki.length === 0) return base;

  const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
  const payload = wiki.map((s, i) => ({
    i,
    meaningEn: s.meaningEn,
    exampleDe: s.exampleDe,
    exampleEn: s.exampleEn,
  }));
  const prompt = `Traduis en français pour une fiche vocabulaire allemand TELC B1.
Lemme: ${lemma}
Pour CHAQUE sens, fournis meaningFr et exampleFr (traduction de exampleDe si présent).
Ne change pas le nombre ni l'ordre des sens.
JSON strict:
{"senses":[{"i":0,"meaningFr":"...","exampleFr":"..."}]}

Entrée:
${JSON.stringify(payload)}`;

  try {
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });
    const frByIndex = new Map<
      number,
      { meaningFr: string; exampleFr: string | null }
    >();
    const rawMatch = (result.text ?? '').match(/\{[\s\S]*\}/);
    if (rawMatch) {
      try {
        const obj = JSON.parse(rawMatch[0]) as {
          senses?: Array<{
            i?: number;
            meaningFr?: string;
            exampleFr?: string;
          }>;
        };
        for (const row of obj.senses ?? []) {
          if (typeof row.i === 'number' && row.meaningFr?.trim()) {
            frByIndex.set(row.i, {
              meaningFr: row.meaningFr.trim(),
              exampleFr: row.exampleFr?.trim() || null,
            });
          }
        }
      } catch {
        /* fall through to full-sense parse */
      }
    }

    // Fallback: model returned full sense objects without `i`
    if (frByIndex.size === 0) {
      const parsed = parseMultiSenseJson(result.text ?? '');
      if (parsed) {
        parsed.forEach((s, i) => {
          frByIndex.set(i, {
            meaningFr: s.meaningFr,
            exampleFr: s.exampleFr,
          });
        });
      }
    }

    if (frByIndex.size === 0) {
      console.warn(`[fr] no parse for ${lemma}`);
      return base;
    }

    return base.map((b, i) => {
      const fr = frByIndex.get(i);
      if (!fr) return b;
      return {
        ...b,
        meaningFr: fr.meaningFr,
        exampleFr: fr.exampleFr,
      };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[fr] Gemini failed for ${lemma}: ${msg.slice(0, 180)}`);
    return base;
  }
}

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL or DIRECT_URL required');

  const pool = new Pool({ connectionString });
  const prisma: any = new PrismaClient({
    adapter: new PrismaPg(pool),
  } as never);

  let enriched = 0;
  let skipped = 0;
  let failed = 0;
  let senseRows = 0;
  let fromWiki = 0;
  let wikiMiss = 0;

  try {
    const mts = await prisma.modelltest.findMany({
      where: {
        exam_only: false,
        ...(mtFilter != null && !Number.isNaN(mtFilter)
          ? { number: mtFilter }
          : {}),
      },
      orderBy: { number: 'asc' },
    });

    for (const mt of mts) {
      const occ = await prisma.vocabOccurrence.findMany({
        where: { modelltest_id: mt.id, in_weekly_pack: true },
        include: {
          entry: { include: { senses: { orderBy: { sort_order: 'asc' } } } },
        },
      });

      const byEntry = new Map<string, { entry: any; contexts: string[] }>();
      for (const o of occ) {
        const cur = byEntry.get(o.vocab_entry_id);
        if (cur) {
          if (o.context_snippet) cur.contexts.push(o.context_snippet);
        } else {
          byEntry.set(o.vocab_entry_id, {
            entry: o.entry,
            contexts: o.context_snippet ? [o.context_snippet] : [],
          });
        }
      }

      let processed = 0;
      for (const [, { entry, contexts }] of byEntry) {
        if (processed >= LIMIT) break;
        if (!FORCE && !needsMultiSenseEnrich(entry.senses ?? [])) {
          skipped += 1;
          continue;
        }
        processed += 1;

        try {
          const contextSnippet = contexts[0] ?? null;
          const wiki = await fetchWikiSenses(entry.lemma, entry.pos);

          let senses: MultiSenseDraft[];
          if (wiki.length > 0) {
            fromWiki += 1;
            senses = await translateSensesToFr(entry.lemma, wiki, entry.pos);
          } else {
            wikiMiss += 1;
            senses = [
              {
                meaningFr: entry.senses?.[0]?.meaning_fr || entry.lemma,
                meaningEn: entry.senses?.[0]?.meaning_en || entry.lemma,
                exampleDe: entry.senses?.[0]?.example_de || entry.lemma,
                exampleFr: entry.senses?.[0]?.example_fr ?? null,
                exampleEn: entry.senses?.[0]?.example_en ?? null,
                noteFr: null,
              },
            ];
          }

          senses = orderSensesByContext(senses, contextSnippet);

          await prisma.vocabSense.deleteMany({
            where: { entry_id: entry.id },
          });
          for (let i = 0; i < senses.length; i += 1) {
            const s = senses[i];
            await prisma.vocabSense.create({
              data: {
                entry_id: entry.id,
                sort_order: i,
                meaning_fr: s.meaningFr,
                meaning_en: s.meaningEn,
                example_de: s.exampleDe,
                example_fr: s.exampleFr,
                example_en: s.exampleEn,
                note_fr: s.noteFr,
              },
            });
            senseRows += 1;
          }

          enriched += 1;
          // Wiktionary rate-limits aggressive clients — stay polite.
          await sleep(900);
        } catch {
          failed += 1;
        }
      }
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          enriched,
          skipped,
          failed,
          senseRows,
          fromWiki,
          wikiMiss,
          force: FORCE,
          source: 'en.wiktionary + gemini-fr',
          usedGemini: !!GEMINI_KEY,
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
