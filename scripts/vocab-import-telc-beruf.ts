/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
/**
 * Import ALL public telc Deutsch Wortschatzlisten (A1–B2) from telc Verlag PDFs.
 * Goethe has no B2 list; ÖSD publishes no open word lists — telc PDFs fill that gap.
 *
 *   npx ts-node -r dotenv/config scripts/vocab-import-telc-beruf.ts
 *
 * © telc gGmbH — offline learning catalogue seed only (see VOCAB_GRAMMAR_SPEC).
 */
import { execFile } from 'child_process';
import { unlink, writeFile } from 'fs/promises';
import { promisify } from 'util';
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { parseTelcVocabText } from '../src/modules/vocab/vocab-telc-pdf.parse';

config({ path: resolve(process.cwd(), '.env.test') });
config({ path: resolve(process.cwd(), '.env') });

const BASE =
  'https://www.telc.net/fileadmin/user_upload/Downloads_Verlag';

/** Every Deutsch Wortschatzliste currently published on telc free-downloads. */
const LISTS: ReadonlyArray<{ cefrLevel: string; url: string; label: string }> = [
  {
    label: 'Einfach gut A1.1',
    cefrLevel: 'A1',
    url: `${BASE}/Einfach_gut/Wortschatzlisten/Einfach_gut_A1.1_Wortschatzliste_Deutsch.pdf`,
  },
  {
    label: 'Einfach gut A1.2',
    cefrLevel: 'A1',
    url: `${BASE}/Einfach_gut/Wortschatzlisten/Einfach_gut_A1.2_Wortschatzliste_Deutsch.pdf`,
  },
  {
    label: 'Einfach gut A2.1',
    cefrLevel: 'A2',
    url: `${BASE}/Einfach_gut/Wortschatzlisten/Einfach_gut_A2.1_Wortschatzliste_Deutsch.pdf`,
  },
  {
    label: 'Einfach gut A2.2',
    cefrLevel: 'A2',
    url: `${BASE}/Einfach_gut/Wortschatzlisten/Einfach_gut_A2.2_Wortschatzliste_Deutsch.pdf`,
  },
  {
    label: 'Einfach gut B1.1',
    cefrLevel: 'B1',
    url: `${BASE}/Einfach_gut/Wortschatzlisten/Einfach_gut_B1.1_Wortschatzliste_Deutsch.pdf`,
  },
  {
    label: 'Einfach gut B1.2',
    cefrLevel: 'B1',
    url: `${BASE}/Einfach_gut/Wortschatzlisten/Einfach_gut_B1.2_Wortschatzliste_Deutsch.pdf`,
  },
  {
    label: 'Einfach gut B1 alphabetisch',
    cefrLevel: 'B1',
    url: `${BASE}/Einfach_gut/Wortschatzlisten/Einfach_gut_B1_Wortschatzliste_alphabetisch.pdf`,
  },
  {
    label: 'Auf jeden Fall A2.1',
    cefrLevel: 'A2',
    url: `${BASE}/Auf_jeden_Fall/Wortschatzlisten/Auf_jeden_Fall_A2.1_Wortschatzliste_Deutsch.pdf`,
  },
  {
    label: 'Auf jeden Fall A2.2',
    cefrLevel: 'A2',
    url: `${BASE}/Auf_jeden_Fall/Wortschatzlisten/Auf_jeden_Fall_A2.2_Wortschatzliste_Deutsch.pdf`,
  },
  {
    label: 'Einfach besser B1 Beruf',
    cefrLevel: 'B1',
    url: `${BASE}/Einfach_besser_B1/Wortschatzlisten/Einfach_besser_B1_Wortschatzliste_Deutsch.pdf`,
  },
  {
    label: 'Einfach besser 400 Beruf',
    cefrLevel: 'B1',
    url: `${BASE}/Einfach_besser_100_400_500/Wortschatzlisten/Einfach_besser_400_Wortschatzliste_Deutsch.pdf`,
  },
  {
    label: 'Einfach besser 500 Beruf B2',
    cefrLevel: 'B2',
    url: `${BASE}/Einfach_besser_100_400_500/Wortschatzlisten/Einfach_besser_500_Wortschatzliste_Deutsch.pdf`,
  },
  {
    label: 'Einfach gut Alpha',
    cefrLevel: 'A1',
    url: `${BASE}/Einfach_gut_Alpha/Wortschatzlisten/Wortschatz_Alpha_deutsch.pdf`,
  },
];

const USER_AGENT = 'LerniqoVocabImport/1.0 (offline catalogue; educational)';
const execFileAsync = promisify(execFile);

async function extractPdfText(buf: Buffer): Promise<string> {
  const tmp = `/tmp/telc-import-${process.pid}-${Date.now()}.pdf`;
  await writeFile(tmp, buf);
  try {
    const { stdout } = await execFileAsync(
      'python3',
      [
        '-c',
        `from pypdf import PdfReader; r=PdfReader(${JSON.stringify(tmp)}); print("\\n".join((p.extract_text() or "") for p in r.pages))`,
      ],
      { maxBuffer: 20 * 1024 * 1024 },
    );
    return stdout;
  } finally {
    await unlink(tmp).catch(() => undefined);
  }
}

function preferLowerCefr(a: string | null | undefined, b: string): string {
  const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  if (!a) return b;
  const ia = order.indexOf(a.toUpperCase());
  const ib = order.indexOf(b.toUpperCase());
  if (ia < 0) return b;
  if (ib < 0) return a;
  return ia <= ib ? a.toUpperCase() : b.toUpperCase();
}

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL or DIRECT_URL required');

  const pool = new Pool({ connectionString });
  const prisma: any = new PrismaClient({
    adapter: new PrismaPg(pool),
  } as never);

  let created = 0;
  let updated = 0;
  const perList: Array<{ label: string; lemmas: number; status: string }> = [];

  try {
    for (const list of LISTS) {
      const res = await fetch(list.url, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!res.ok) {
        perList.push({ label: list.label, lemmas: 0, status: `HTTP ${res.status}` });
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const text = await extractPdfText(buf);
      const lemmas = parseTelcVocabText(text);
      perList.push({
        label: list.label,
        lemmas: lemmas.length,
        status: 'ok',
      });

      for (const mapped of lemmas) {
        const existing = await prisma.vocabEntry.findUnique({
          where: {
            lemma_article_pos: {
              lemma: mapped.lemma,
              article: mapped.article,
              pos: mapped.pos,
            },
          },
        });

        let nextSource = 'telc';
        if (existing?.source === 'modelltest') nextSource = 'modelltest';
        else if (existing?.source === 'goethe') nextSource = 'goethe';
        else if (existing?.source === 'telc') nextSource = 'telc';

        const nextCefr = preferLowerCefr(existing?.cefr_level, list.cefrLevel);

        const entry = await prisma.vocabEntry.upsert({
          where: {
            lemma_article_pos: {
              lemma: mapped.lemma,
              article: mapped.article,
              pos: mapped.pos,
            },
          },
          create: {
            lemma: mapped.lemma,
            article: mapped.article,
            gender: mapped.gender,
            pos: mapped.pos,
            cefr_level: list.cefrLevel,
            source: 'telc',
          },
          update: {
            cefr_level: nextCefr,
            gender: mapped.gender ?? undefined,
            source: nextSource,
          },
        });

        const senseCount = await prisma.vocabSense.count({
          where: { entry_id: entry.id },
        });
        if (senseCount === 0) {
          await prisma.vocabSense.create({
            data: {
              entry_id: entry.id,
              sort_order: 0,
              meaning_fr: '(à enrichir)',
              meaning_en: null,
              example_de: mapped.lemma,
            },
          });
        }

        if (existing) updated += 1;
        else created += 1;
      }
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          created,
          updated,
          lists: perList,
          totalLists: LISTS.length,
          source: 'telc.all-deutsch-pdfs',
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
