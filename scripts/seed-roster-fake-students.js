/**
 * One-off: seed 8 fake roster students + varied training progress for dashboard QA.
 * Usage: node scripts/seed-roster-fake-students.js
 */
require('dotenv').config();
const { Client } = require('pg');
const crypto = require('crypto');

const PASSWORD_HASH_PLACEHOLDER =
  // bcrypt of "Test1234!" — login may still need email_verified; roster only needs rows
  '$2b$10$rQZ8K8Y5Y5Y5Y5Y5Y5Y5YuGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('No DATABASE_URL / DIRECT_URL');

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const centers = await client.query(`
    SELECT c.id, c.name, c.exam_slots_remaining,
           (SELECT count(*)::int FROM students s WHERE s.center_id = c.id) AS student_count,
           (SELECT count(*)::int FROM activation_codes ac WHERE ac.center_id = c.id) AS code_count,
           (SELECT cu.email FROM center_users cu WHERE cu.center_id = c.id ORDER BY cu.created_at ASC LIMIT 1) AS owner_email
    FROM centers c
    ORDER BY c.created_at DESC
    LIMIT 15
  `);

  console.log('Centers (newest first):');
  for (const row of centers.rows) {
    console.log(
      `- ${row.id.slice(0, 8)}… name=${JSON.stringify(row.name)} students=${row.student_count} codes=${row.code_count} owner=${row.owner_email}`,
    );
  }

  if (centers.rows.length === 0) {
    throw new Error('No centers in DB');
  }

  // Prefer the real school (hermanniqo / most codes), not ephemeral trial fixtures
  const center =
    centers.rows.find((c) =>
      String(c.name || '')
        .toLowerCase()
        .includes('hermanniqo'),
    ) ||
    centers.rows.find((c) => c.code_count >= 5) ||
    centers.rows.find((c) => c.code_count > 0 || c.student_count > 0) ||
    centers.rows[0];

  console.log('\nUsing center:', center.id, center.name, center.owner_email);

  const profiles = [
    { first: 'Anna', last: 'Ready', email: 'anna.ready.roster@lerniqo.test', level: 'B1', kind: 'ready' },
    { first: 'Ben', last: 'Weak', email: 'ben.weak.roster@lerniqo.test', level: 'A2', kind: 'weak' },
    { first: 'Clara', last: 'Idle', email: 'clara.idle.roster@lerniqo.test', level: 'B1', kind: 'idle' },
    { first: 'Dana', last: 'Lesen', email: 'dana.lesen.roster@lerniqo.test', level: 'B1', kind: 'lesen' },
    { first: 'Erik', last: 'Hoeren', email: 'erik.hoeren.roster@lerniqo.test', level: 'B1', kind: 'hoeren' },
    { first: 'Fay', last: 'Mixed', email: 'fay.mixed.roster@lerniqo.test', level: 'A2', kind: 'mixed' },
    { first: 'Gio', last: 'New', email: 'gio.new.roster@lerniqo.test', level: null, kind: 'new' },
    { first: 'Hana', last: 'Almost', email: 'hana.almost.roster@lerniqo.test', level: 'B1', kind: 'almost' },
  ];

  // Real bcrypt hash for Test1234! via a quick require if bcrypt exists
  let passwordHash = null;
  try {
    const bcrypt = require('bcrypt');
    passwordHash = await bcrypt.hash('Test1234!', 10);
  } catch {
    passwordHash = null;
  }

  await client.query('BEGIN');

  const created = [];

  for (const p of profiles) {
    const id = crypto.randomUUID();
    const existing = await client.query(
      `SELECT id FROM students WHERE email = $1`,
      [p.email],
    );

    let studentId;
    if (existing.rows.length) {
      studentId = existing.rows[0].id;
      await client.query(
        `UPDATE students SET
           center_id = $1,
           first_name = $2,
           last_name = $3,
           level = $4::"CefrLevel",
           email_verified = true,
           last_seen_at = now(),
           updated_at = now()
         WHERE id = $5`,
        [center.id, p.first, p.last, p.level, studentId],
      );
      // wipe old fake activities for clean profiles
      await client.query(
        `DELETE FROM student_activities WHERE student_id = $1 AND attempt_id LIKE 'seed-roster-%'`,
        [studentId],
      );
      console.log('updated', p.email);
    } else {
      studentId = id;
      await client.query(
        `INSERT INTO students (
           id, first_name, last_name, email, password_hash, email_verified,
           center_id, level, created_at, updated_at, last_seen_at, grandfathered_access
         ) VALUES (
           $1, $2, $3, $4, $5, true,
           $6, $7::"CefrLevel", now(), now(), now(), false
         )`,
        [
          studentId,
          p.first,
          p.last,
          p.email,
          passwordHash ||
            '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // "password" placeholder if bcrypt missing
          center.id,
          p.level,
        ],
      );
      console.log('created', p.email);
    }

    created.push({ ...p, studentId });
    await seedActivity(client, studentId, p.kind);
  }

  await client.query('COMMIT');

  const check = await client.query(
    `SELECT first_name, last_name, email, level,
            (SELECT count(*)::int FROM student_activities a WHERE a.student_id = s.id) AS attempts
     FROM students s
     WHERE s.center_id = $1
       AND s.email LIKE '%.roster@lerniqo.test'
     ORDER BY first_name`,
    [center.id],
  );

  console.log('\nRoster seed result:');
  console.table(check.rows);
  console.log(
    `\nDone. Refresh dashboard Students for center "${center.name}" (${center.owner_email}).`,
  );
  console.log(
    'Note: these students are on the roster for UI QA. App login may need a real activation code if entitlements require one.',
  );

  await client.end();
}

async function seedActivity(client, studentId, kind) {
  const rows = activitiesFor(kind);
  for (const [i, row] of rows.entries()) {
    const attemptId = `seed-roster-${studentId.slice(0, 8)}-${kind}-${i}`;
    await client.query(
      `INSERT INTO student_activities (
         id, student_id, skill, teil, score, max_score, duration_seconds,
         modelltest_id, attempt_id, created_at, erasure_id
       ) VALUES (
         $1, $2, $3::"Skill", $4, $5, 100, 120,
         NULL, $6, now() - ($7 || ' days')::interval, NULL
       )
       ON CONFLICT (skill, attempt_id) DO NOTHING`,
      [
        crypto.randomUUID(),
        studentId,
        row.skill,
        row.teil,
        row.score,
        attemptId,
        String(row.daysAgo ?? 0),
      ],
    );
  }
}

function activitiesFor(kind) {
  switch (kind) {
    case 'idle':
      return [];
    case 'new':
      return [
        { skill: 'LESEN', teil: 1, score: 70, daysAgo: 1 },
        { skill: 'LESEN', teil: 1, score: 60, daysAgo: 1 },
      ];
    case 'lesen':
      return many('LESEN', [80, 75, 70, 85, 78, 72], 1);
    case 'hoeren':
      return many('HOEREN', [65, 70, 68, 72, 60, 74], 2);
    case 'weak':
      return [
        ...many('LESEN', [30, 35, 28, 40, 32], 3),
        ...many('HOEREN', [25, 30, 20, 35, 28], 3),
        ...many('SPRACHBAUSTEINE', [20, 25, 22], 4),
        ...many('SCHREIBEN', [30, 28, 32], 4),
        ...many('SPRECHEN', [20, 25, 18], 5),
      ];
    case 'mixed':
      return [
        ...many('LESEN', [55, 60, 58], 2),
        ...many('HOEREN', [50, 52, 48], 2),
        ...many('SCHREIBEN', [62, 65], 3),
      ];
    case 'almost':
      return [
        ...many('LESEN', [70, 72, 68, 75], 1),
        ...many('HOEREN', [65, 68, 70], 1),
        ...many('SPRACHBAUSTEINE', [60, 62, 58], 2),
        ...many('SCHREIBEN', [70, 72], 2),
        ...many('SPRECHEN', [55, 58, 52], 2), // oral < 60 → not ready
      ];
    case 'ready':
      return [
        ...many('LESEN', [85, 88, 82, 90], 0),
        ...many('HOEREN', [80, 78, 85], 0),
        ...many('SPRACHBAUSTEINE', [75, 80, 78], 1),
        ...many('SCHREIBEN', [82, 85], 1),
        ...many('SPRECHEN', [70, 72, 75], 1),
      ];
    default:
      return [];
  }
}

function many(skill, scores, daysAgo) {
  // Spread across teils 1..n for the skill
  const teilCount =
    skill === 'SPRACHBAUSTEINE' ? 2 : skill === 'SCHREIBEN' ? 1 : 3;
  return scores.map((score, i) => ({
    skill,
    teil: (i % teilCount) + 1,
    score,
    daysAgo,
  }));
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
