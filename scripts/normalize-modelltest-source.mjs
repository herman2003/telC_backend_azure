/**
 * Normalize a ChatGPT / extraction JSON before seeding.
 *
 * Usage:
 *   node scripts/normalize-modelltest-source.mjs <raw.json> <out.json>
 *
 * Fixes:
 * - title → "Modelltest N" (keeps origin in extractionWarnings)
 * - lesenTeil2 null strings → ""
 * - injects R2 audioUrl for Hören Teil 1/2/3 when missing
 */
import fs from 'node:fs';
import path from 'node:path';

const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
  throw new Error(
    'Usage: node scripts/normalize-modelltest-source.mjs <raw.json> <out.json>',
  );
}

const R2_PUBLIC =
  process.env.LERNIQO_R2_PUBLIC_BASE?.replace(/\/$/, '') ||
  'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev';

const source = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const n = source.modelltest?.number;
if (!Number.isInteger(n) || n < 1) {
  throw new Error('modelltest.number must be a positive integer');
}

const originTitle = source.modelltest.title;
source.modelltest.title = `Modelltest ${n}`;

const warnings = Array.isArray(source.extractionWarnings)
  ? [...source.extractionWarnings]
  : [];
if (originTitle && originTitle !== source.modelltest.title) {
  warnings.push(`Origin booklet title kept for reference: ${originTitle}`);
}

const l2 = source.sections?.lesenTeil2;
if (l2) {
  for (const key of [
    'cautionNote',
    'topSender',
    'topReceiver',
    'quotedThread',
    'topBody',
  ]) {
    if (l2[key] == null) l2[key] = '';
  }
}

const hoeren = source.sections?.hoeren ?? {};
for (const [teilKey, partNum] of [
  ['teil1', 1],
  ['teil2', 2],
  ['teil3', 3],
]) {
  const part = hoeren[teilKey];
  if (!part) continue;
  const file = `modelltest-${n}-hoeren-teil${partNum}.mp3`;
  if (!part.audioUrl) {
    part.audioUrl = `${R2_PUBLIC}/${file}`;
  }
  if (part.imageUrl == null) part.imageUrl = '';
  if (!part.durationMinutes) part.durationMinutes = 10;
  if (!part.contentRevision) {
    part.contentRevision = `modelltest-${n}-hoeren-teil${partNum}-v1`;
  }
}

source.extractionWarnings = warnings;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(source, null, 2)}\n`, 'utf8');

console.log(
  JSON.stringify(
    {
      outPath,
      number: n,
      title: source.modelltest.title,
      audioUrls: {
        teil1: hoeren.teil1?.audioUrl,
        teil2: hoeren.teil2?.audioUrl,
        teil3: hoeren.teil3?.audioUrl,
      },
      warnings,
    },
    null,
    2,
  ),
);
