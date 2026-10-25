/**
 * Load content/a1-modelltest-1-corrections.json onto exam_items (test only).
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
    path.resolve(import.meta.dirname, '../content/a1-modelltest-1-corrections.json'),
    'utf8',
  ),
);

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log(JSON.stringify({ host: hostOf(url), isProduction: false }));

const updateSection = async (revision, items) => {
  for (const [num, correction] of Object.entries(items)) {
    const r = await client.query(
      `UPDATE exam_items AS i
       SET correction = $1::jsonb
       FROM exam_sections AS s
       WHERE i.section_id = s.id
         AND s.content_revision = $2
         AND i.item_number = $3`,
      [JSON.stringify(correction), revision, Number(num)],
    );
    if (r.rowCount !== 1) {
      console.warn(`${revision} item ${num}: updated ${r.rowCount}`);
    }
  }
};

await updateSection('a1-modelltest-1-hoeren-teil-1-v1', pack.hoeren.teil1);
await updateSection('a1-modelltest-1-hoeren-teil-2-v1', pack.hoeren.teil2);
await updateSection('a1-modelltest-1-hoeren-teil-3-v1', pack.hoeren.teil3);
await updateSection('a1-modelltest-1-lesen-teil-1-v1', pack.lesen.teil1);
await updateSection('a1-modelltest-1-lesen-teil-2-v1', pack.lesen.teil2);
await updateSection('a1-modelltest-1-lesen-teil-3-v1', pack.lesen.teil3);
await updateSection('a1-modelltest-1-schreiben-teil-1-v1', pack.schreiben.teil1);

const check = await client.query(`
  SELECT s.skill, s.teil, count(*)::int AS n
  FROM exam_items i
  JOIN exam_sections s ON s.id = i.section_id
  WHERE s.content_revision LIKE 'a1-modelltest-1-%'
    AND i.correction IS NOT NULL
  GROUP BY s.skill, s.teil
  ORDER BY s.skill, s.teil
`);
console.log(JSON.stringify(check.rows, null, 2));
const total = check.rows.reduce((a, r) => a + r.n, 0);
console.log(JSON.stringify({ total }));
await client.end();
