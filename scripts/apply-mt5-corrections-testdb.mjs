/**
 * Load content/modelltest-5-corrections.json onto the connected DB (test only).
 * Refuses production.
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { isProduction, hostOf } = require('./production-endpoint.cjs');

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error('No DATABASE_URL');
if (isProduction(url)) {
  throw new Error(`REFUSING production (${hostOf(url)})`);
}

const pack = JSON.parse(
  fs.readFileSync(
    path.resolve(import.meta.dirname, '../content/modelltest-5-corrections.json'),
    'utf8',
  ),
);

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log(JSON.stringify({ host: hostOf(url), isProduction: false }));

const updateHoeren = async (revision, items) => {
  for (const [num, correction] of Object.entries(items)) {
    const r = await client.query(
      `UPDATE listening_questions AS q
       SET correction = $1::jsonb
       FROM listening_exercises AS e
       WHERE q.exercise_id = e.id
         AND e.content_revision = $2
         AND q.question_number = $3`,
      [JSON.stringify(correction), revision, Number(num)],
    );
    if (r.rowCount !== 1) {
      console.warn(`hoeren ${revision} q${num}: updated ${r.rowCount}`);
    }
  }
};

await updateHoeren('modelltest-5-hoeren-teil1-v1', pack.hoeren.teil1);
await updateHoeren('modelltest-5-hoeren-teil2-v1', pack.hoeren.teil2);
await updateHoeren('modelltest-5-hoeren-teil3-v1', pack.hoeren.teil3);

for (const [num, correction] of Object.entries(pack.lesen.teil1)) {
  const r = await client.query(
    `UPDATE lesen_teil1_texts AS t
     SET correction = $1::jsonb
     FROM lesen_teil1_exercises AS e
     WHERE t."exerciseId" = e.id
       AND e."contentRevision" = 'modelltest-5-lesen-teil1-v1'
       AND t."textNumber" = $2`,
    [JSON.stringify(correction), Number(num)],
  );
  if (r.rowCount !== 1) console.warn(`lesen T1 ${num}: ${r.rowCount}`);
}

for (const [num, correction] of Object.entries(pack.lesen.teil2)) {
  const r = await client.query(
    `UPDATE lesen_teil2_questions AS q
     SET correction = $1::jsonb
     FROM lesen_teil2_exercises AS e
     WHERE q."exerciseId" = e.id
       AND e."contentRevision" = 'modelltest-5-lesen-teil2-v1'
       AND q."questionNumber" = $2`,
    [JSON.stringify(correction), Number(num)],
  );
  if (r.rowCount !== 1) console.warn(`lesen T2 ${num}: ${r.rowCount}`);
}

for (const [num, correction] of Object.entries(pack.lesen.teil3)) {
  const r = await client.query(
    `UPDATE lesen_teil3_situations AS s
     SET correction = $1::jsonb
     FROM lesen_teil3_exercises AS e
     WHERE s."exerciseId" = e.id
       AND e."contentRevision" = 'modelltest-5-lesen-teil3-v1'
       AND s."situationNumber" = $2`,
    [JSON.stringify(correction), Number(num)],
  );
  if (r.rowCount !== 1) console.warn(`lesen T3 ${num}: ${r.rowCount}`);
}

for (const [num, correction] of Object.entries(pack.sprachbausteine.teil1)) {
  const r = await client.query(
    `UPDATE sprachbausteine_gaps AS g
     SET correction = $1::jsonb
     FROM sprachbausteine_exercises AS e
     WHERE g.exercise_id = e.id
       AND e.content_revision = 'modelltest-5-sprachbausteine-teil1-v1'
       AND g.gap_number = $2`,
    [JSON.stringify(correction), Number(num)],
  );
  if (r.rowCount !== 1) console.warn(`sb T1 ${num}: ${r.rowCount}`);
}

for (const [num, correction] of Object.entries(pack.sprachbausteine.teil2)) {
  const r = await client.query(
    `UPDATE sprachbausteine_teil2_gaps AS g
     SET correction = $1::jsonb
     FROM sprachbausteine_teil2_exercises AS e
     WHERE g."exerciseId" = e.id
       AND e."contentRevision" = 'modelltest-5-sprachbausteine-teil2-v1'
       AND g."gapNumber" = $2`,
    [JSON.stringify(correction), Number(num)],
  );
  if (r.rowCount !== 1) console.warn(`sb T2 ${num}: ${r.rowCount}`);
}

const check = await client.query(`
  SELECT 'hoeren' AS kind, count(*)::int AS n FROM listening_questions q
    JOIN listening_exercises e ON e.id = q.exercise_id
   WHERE e.content_revision LIKE 'modelltest-5-hoeren%' AND q.correction IS NOT NULL
  UNION ALL
  SELECT 'lesen1', count(*)::int FROM lesen_teil1_texts t
    JOIN lesen_teil1_exercises e ON e.id = t."exerciseId"
   WHERE e."contentRevision" = 'modelltest-5-lesen-teil1-v1' AND t.correction IS NOT NULL
  UNION ALL
  SELECT 'lesen2', count(*)::int FROM lesen_teil2_questions q
    JOIN lesen_teil2_exercises e ON e.id = q."exerciseId"
   WHERE e."contentRevision" = 'modelltest-5-lesen-teil2-v1' AND q.correction IS NOT NULL
  UNION ALL
  SELECT 'lesen3', count(*)::int FROM lesen_teil3_situations s
    JOIN lesen_teil3_exercises e ON e.id = s."exerciseId"
   WHERE e."contentRevision" = 'modelltest-5-lesen-teil3-v1' AND s.correction IS NOT NULL
  UNION ALL
  SELECT 'sb1', count(*)::int FROM sprachbausteine_gaps g
    JOIN sprachbausteine_exercises e ON e.id = g.exercise_id
   WHERE e.content_revision = 'modelltest-5-sprachbausteine-teil1-v1' AND g.correction IS NOT NULL
  UNION ALL
  SELECT 'sb2', count(*)::int FROM sprachbausteine_teil2_gaps g
    JOIN sprachbausteine_teil2_exercises e ON e.id = g."exerciseId"
   WHERE e."contentRevision" = 'modelltest-5-sprachbausteine-teil2-v1' AND g.correction IS NOT NULL
`);
console.log(JSON.stringify(check.rows, null, 2));
await client.end();
