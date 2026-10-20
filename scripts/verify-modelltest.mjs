/**
 * Check that an imported Modelltest is actually complete in the database.
 *
 * Parameterised by level and number, so it works on the next paper without
 * being edited — the point the per-paper verify scripts kept missing.
 *
 * Usage:
 *   node scripts/verify-modelltest.mjs --level B2 --number 7
 *   node scripts/verify-modelltest.mjs --level B1 --number 3
 *
 * Reads `.env.test` by default and refuses the production endpoint outright.
 * Pass --env .env.other to point it elsewhere; it will still refuse
 * production.
 *
 * Exits non-zero on the first structural problem, so it can gate a migration.
 */
import { config } from 'dotenv';
import path from 'node:path';
import pg from 'pg';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : args[at + 1];
};

const level = flag('level');
const number = Number(flag('number'));
const envFile = flag('env', '.env.test');

if (!level || !Number.isInteger(number)) {
  throw new Error(
    'Usage: node scripts/verify-modelltest.mjs --level B2 --number 7 [--env .env.test]',
  );
}

config({ path: path.resolve(process.cwd(), envFile) });
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error(`No DIRECT_URL or DATABASE_URL in ${envFile}`);
if (/ep-wandering-hall/.test(url)) {
  throw new Error('REFUSING: that is the live database.');
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const problems = [];
const notes = [];
const one = async (sql, params) => (await client.query(sql, params)).rows[0];
const all = async (sql, params) => (await client.query(sql, params)).rows;

const mt = await one(
  'SELECT id, number, title, level, exam_only FROM modelltests WHERE number = $1',
  [number],
);
if (!mt) {
  console.error(`Modelltest ${number} does not exist.`);
  await client.end();
  process.exit(1);
}
if (mt.level !== level) {
  problems.push(`level is ${mt.level}, expected ${level}`);
}
notes.push(`${mt.title} — level ${mt.level}, exam_only ${mt.exam_only}`);

/** One parent row per Modelltest, with however many children it should hold. */
const singles = [
  ['lesen_teil1_exercises', 'lesen_teil1_texts', 'lesen_teil1_titles'],
  ['lesen_teil2_exercises', 'lesen_teil2_questions', null],
  ['lesen_teil3_exercises', 'lesen_teil3_situations', 'lesen_teil3_announcements'],
  ['sprachbausteine_exercises', 'sprachbausteine_gaps', null],
  ['sprachbausteine_teil2_exercises', 'sprachbausteine_teil2_gaps', 'sprachbausteine_teil2_words'],
];

for (const [parent, childA, childB] of singles) {
  const rows = await all(
    `SELECT id FROM "${parent}" WHERE "modelltest_id" = $1`,
    [mt.id],
  );
  if (rows.length !== 1) {
    problems.push(`${parent}: ${rows.length} rows, expected 1`);
    continue;
  }
  const idColumn = parent.includes('sprachbausteine_exercises')
    ? 'exercise_id'
    : parent.startsWith('sprachbausteine_teil2') || parent.startsWith('lesen')
      ? '"exerciseId"'
      : 'exercise_id';
  const counts = [];
  for (const child of [childA, childB]) {
    if (!child) continue;
    const column = child.startsWith('sprachbausteine_gaps')
      ? 'exercise_id'
      : idColumn;
    const row = await one(
      `SELECT COUNT(*)::int AS n FROM "${child}" WHERE ${column} = $1`,
      [rows[0].id],
    );
    if (row.n === 0) problems.push(`${child}: empty`);
    counts.push(`${child.split('_').pop()} ${row.n}`);
  }
  notes.push(`${parent}: ok (${counts.join(', ')})`);
}

// Hören — every part needs audio and questions. A recording that imported as
// an empty string plays as a 404 on the student's device.
const hoeren = await all(
  `SELECT e.part, e.audio_url, e.content_revision, e.exam_plays_allowed,
          COUNT(q.id)::int AS questions
     FROM listening_exercises e
     LEFT JOIN listening_questions q ON q.exercise_id = e.id
    WHERE e.modelltest_id = $1
    GROUP BY e.id, e.part, e.audio_url, e.content_revision, e.exam_plays_allowed
    ORDER BY e.part`,
  [mt.id],
);
if (hoeren.length === 0) problems.push('listening_exercises: none');
for (const part of hoeren) {
  if (!part.audio_url) problems.push(`Hören Teil ${part.part}: no audio_url`);
  if (part.questions === 0) {
    problems.push(`Hören Teil ${part.part}: no questions`);
  }
  notes.push(
    `Hören Teil ${part.part}: ${part.questions} questions, ` +
      `${part.exam_plays_allowed} play(s), ` +
      `audio ${part.audio_url ? 'ok' : 'MISSING'}`,
  );
}

// Schreiben — one row per task, and a choice must agree about being one.
const schreiben = await all(
  `SELECT part, title, choice_group_id, cardinality(bullet_points) AS bullets
     FROM writing_exercises WHERE modelltest_id = $1 ORDER BY part`,
  [mt.id],
);
if (schreiben.length === 0) problems.push('writing_exercises: none');
const groups = new Set(schreiben.map((row) => row.choice_group_id));
if (schreiben.length > 1 && (groups.size !== 1 || groups.has(null))) {
  problems.push(
    `writing_exercises: ${schreiben.length} tasks but choice_group_id is not one shared value`,
  );
}
for (const task of schreiben) {
  notes.push(
    `Schreiben part ${task.part}: ${task.bullets ?? 0} Leitpunkte${task.choice_group_id ? ' (choice)' : ''}`,
  );
}

// Sprechen — part 0 is an unscored introduction where the level has one.
const sprechen = await all(
  `SELECT part, title, content_revision FROM speaking_exercises
    WHERE modelltest_id = $1 ORDER BY part`,
  [mt.id],
);
if (sprechen.length === 0) problems.push('speaking_exercises: none');
for (const part of sprechen) {
  notes.push(`Sprechen part ${part.part}: ${part.title}`);
}

// Revisions must name this level, or they will collide with another level's
// in the two columns that are globally unique.
const revisions = [
  ...hoeren.map((row) => row.content_revision),
  ...sprechen.map((row) => row.content_revision),
];
const prefix = `${level.toLowerCase()}-`;
const otherPrefixes = ['a1-', 'a2-', 'b1-', 'b2-'].filter(
  (candidate) => candidate !== prefix,
);
for (const rev of revisions) {
  if (!rev) continue;
  if (otherPrefixes.some((candidate) => rev.startsWith(candidate))) {
    // The failure that matters: two levels' content fighting over one value in
    // a column that is unique across the whole table.
    problems.push(`content_revision ${rev} is claimed by another level`);
  } else if (!rev.startsWith(prefix)) {
    // B1's six papers were imported before revisions named their level, and
    // nothing is gained by rewriting them: an unprefixed value collides with
    // nothing. New content must carry the prefix, so only a legacy level is
    // allowed to go without.
    if (level === 'B1') {
      notes.push(`content_revision ${rev}: unprefixed, predates the convention`);
    } else {
      problems.push(`content_revision ${rev} does not name level ${level}`);
    }
  }
}
if (new Set(revisions).size !== revisions.length) {
  problems.push('content_revision repeats within this Modelltest');
}

// The exam picker only offers a Modelltest whose every block has content.
const examReady =
  schreiben.length > 0 &&
  hoeren.length >= 3 &&
  sprechen.filter((row) => row.part >= 1).length >= 3;
notes.push(`exam-ready: ${examReady ? 'yes' : 'no'}`);

await client.end();

for (const note of notes) console.log(`  ${note}`);
if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`\nModelltest ${number} (${level}) verified.`);
