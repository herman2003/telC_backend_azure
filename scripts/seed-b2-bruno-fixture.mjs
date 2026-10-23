/**
 * Rebuilds everything the `bruno/B2 Level` and `bruno/A2 Level` collections
 * need, on the test database.
 *
 * WHY THIS EXISTS
 * The integration suites delete shared center and student rows — their own
 * setup file says so — so a full `npm run test:integration` leaves the scratch
 * database with no center, no subscription and no activation codes. Walking
 * Center Auth, Center Subscription and Center Activation Codes by hand after
 * every test run is a lot of clicking to arrive back where you were.
 *
 * WHAT IT DOES NOT DO
 * It does not replace those collections. It skips the flows they test so you
 * can test a different one. If you want to prove registration, verification,
 * trial or code minting still work, run those collections — this script writes
 * rows directly and would hide a break in any of them.
 *
 * IDS ARE FIXED ON PURPOSE
 * Re-running it reproduces the same center id, code ids and codes, so the
 * Bruno environment stays valid and you never paste ids again.
 *
 *   node scripts/seed-b2-bruno-fixture.mjs
 */
import { config } from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { isProduction, hostOf } = require('./production-endpoint.cjs');

config({ path: '.env.test' });

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('No DIRECT_URL in .env.test.');
  process.exit(1);
}
if (isProduction(url)) {
  console.error('REFUSING: that connection string is the production database.');
  process.exit(1);
}

/** Stable across runs so the Bruno environment never goes stale. */
const CENTER_ID = '0b2f1000-0000-4000-8000-00000000c001';
const OWNER_ID = '0b2f1000-0000-4000-8000-00000000c002';
const SUB_ID = '0b2f1000-0000-4000-8000-00000000c003';
const SEATS_ID = '0b2f1000-0000-4000-8000-00000000c004';
const CODE_B2_ID = '0b2f1000-0000-4000-8000-00000000c005';
const CODE_B1_ID = '0b2f1000-0000-4000-8000-00000000c006';
const CODE_A2_ID = '0b2f1000-0000-4000-8000-00000000c007';

/**
 * Only characters from ACTIVATION_CODE_ALPHABET — no 0/O, 1/I/L or U. A code
 * outside it would be stored happily and then rejected at redemption.
 */
const CODE_B2 = 'LQ-BBTT-WXYZ';
const CODE_B1 = 'LQ-CCTT-WXYZ';
const CODE_A2 = 'LQ-DDTT-WXYZ';

const CENTER_EMAIL = 'ngeukeualain@gmail.com';
const CENTER_PASSWORD = 'A-strong-password1';
const STUDENT_PASSWORD = 'Student-Pass1!';
const STUDENT_B2_EMAIL = 'ngeukeualain+b2student@gmail.com';
const STUDENT_B1_EMAIL = 'ngeukeualain+b1student@gmail.com';
const STUDENT_A2_EMAIL = 'ngeukeualain+a2student@gmail.com';

const client = new pg.Client({ connectionString: url });

async function upsertStudent(email, firstName) {
  const hash = await bcrypt.hash(STUDENT_PASSWORD, 12);
  // level and center_id are cleared deliberately: request 02 of the B2
  // collection exists to prove that redeeming a seat is what sets the level.
  // Seeding a student who is already B2 would make that request pass without
  // testing anything.
  const row = await client.query(
    `INSERT INTO students (id, email, first_name, last_name, password_hash,
                           email_verified, level, center_id, created_at, updated_at, last_seen_at)
     VALUES (gen_random_uuid()::text, $1, $2, 'Bruno', $3, true, NULL, NULL,
             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       email_verified = true,
       level = NULL,
       center_id = NULL,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [email, firstName, hash],
  );
  return row.rows[0].id;
}

async function main() {
  await client.connect();
  console.log('database :', hostOf(url));

  const centerPasswordHash = await bcrypt.hash(CENTER_PASSWORD, 12);

  await client.query('BEGIN');

  await client.query(
    `INSERT INTO centers (id, name, exam_slots_remaining, exam_ai_slots_remaining,
                          created_at, updated_at)
     VALUES ($1, 'Goethe Language Center (Bruno fixture)', 5, 5,
             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       exam_slots_remaining = 5,
       exam_ai_slots_remaining = 5,
       updated_at = CURRENT_TIMESTAMP`,
    [CENTER_ID],
  );

  await client.query(
    `INSERT INTO center_users (id, center_id, role, first_name, last_name, email,
                               password_hash, email_verified,
                               created_at, updated_at, last_seen_at)
     VALUES ($1, $2, 'OWNER', 'Alain', 'Ngeukeu', $3, $4, true,
             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       email = EXCLUDED.email,
       email_verified = true,
       updated_at = CURRENT_TIMESTAMP`,
    [OWNER_ID, CENTER_ID, CENTER_EMAIL, centerPasswordHash],
  );

  // PAID rather than TRIAL: a trial is one seat, and the collections need
  // three students — a B2 one, a B1 one for the refusal checks (05 and 07b),
  // and an A2 one for the A2 Level collection.
  await client.query(
    `INSERT INTO center_subscriptions (id, center_id, plan, paid_until, anchor_day,
                                       created_at, updated_at)
     VALUES ($1, $2, 'PAID', CURRENT_TIMESTAMP + INTERVAL '365 days', 1,
             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET
       plan = 'PAID',
       paid_until = CURRENT_TIMESTAMP + INTERVAL '365 days',
       updated_at = CURRENT_TIMESTAMP`,
    [SUB_ID, CENTER_ID],
  );

  await client.query(
    `INSERT INTO center_seats (id, center_id, quantity, unit_price_xaf, created_at, updated_at)
     VALUES ($1, $2, 3, 5000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET
       quantity = 3,
       updated_at = CURRENT_TIMESTAMP`,
    [SEATS_ID, CENTER_ID],
  );

  const studentB2 = await upsertStudent(STUDENT_B2_EMAIL, 'Bea');
  const studentB1 = await upsertStudent(STUDENT_B1_EMAIL, 'Bruno');
  const studentA2 = await upsertStudent(STUDENT_A2_EMAIL, 'Anna');

  // The B2 seat is left with NO level. Request 01 of the collection is the one
  // that sets it to B2, and 02 proves redemption copies it onto the student.
  // The B1 and A2 seats carry their level already, because nothing tests
  // setting those.
  const codes = [
    [CODE_B2_ID, CODE_B2, null],
    [CODE_B1_ID, CODE_B1, 'B1'],
    [CODE_A2_ID, CODE_A2, 'A2'],
  ];
  for (const [id, code, level] of codes) {
    await client.query(
      `INSERT INTO activation_codes (id, center_id, code, status, level, student_id,
                                     linked_name, linked_email, connected_at, connected_ip,
                                     expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'ACTIVATED', $4::"CefrLevel", NULL, NULL, NULL, NULL, NULL,
               CURRENT_TIMESTAMP + INTERVAL '365 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         status = 'ACTIVATED',
         level = $4::"CefrLevel",
         student_id = NULL,
         connected_at = NULL,
         connected_ip = NULL,
         linked_name = NULL,
         linked_email = NULL,
         expires_at = CURRENT_TIMESTAMP + INTERVAL '365 days',
         updated_at = CURRENT_TIMESTAMP`,
      [id, CENTER_ID, code, level],
    );
  }

  await client.query('COMMIT');

  const mt = await client.query(
    `SELECT number, level FROM modelltests WHERE level = 'B2' ORDER BY number`,
  );
  const a2 = await client.query(
    `SELECT number FROM modelltests WHERE level = 'A2' ORDER BY number`,
  );

  console.log('');
  console.log('  center     Goethe Language Center (Bruno fixture)');
  console.log('  login      ' + CENTER_EMAIL + ' / ' + CENTER_PASSWORD);
  console.log('  students   ' + STUDENT_B2_EMAIL + ' (no level yet)');
  console.log('             ' + STUDENT_B1_EMAIL + ' (no level yet)');
  console.log('             ' + STUDENT_A2_EMAIL + ' (no level yet, seat ' + CODE_A2 + ' is A2)');
  console.log('  password   ' + STUDENT_PASSWORD);
  console.log('  seats      3    exam slots 5 manual / 5 AI');
  console.log(
    '  B2 papers  ' +
      (mt.rowCount ? mt.rows.map((r) => r.number).join(', ') : 'NONE — import Modelltest 7 first'),
  );
  console.log(
    '  A2 papers  ' +
      (a2.rowCount ? a2.rows.map((r) => r.number).join(', ') : 'NONE — apply the A2 Modelltest 1 migration first'),
  );
  console.log('');
  console.log('Paste into bruno/environments/local.bru:');
  console.log('');
  console.log('  codeId: ' + CODE_B2_ID);
  console.log('  activationKey: ' + CODE_B2);
  console.log('  b1CodeId: ' + CODE_B1_ID);
  console.log('  b1ActivationKey: ' + CODE_B1);
  console.log('  studentEmail: ' + STUDENT_B2_EMAIL);
  console.log('  studentId: ' + studentB2);
  console.log('  b1StudentEmail: ' + STUDENT_B1_EMAIL);
  console.log('  b1StudentId: ' + studentB1);
  console.log('');
  console.log('  (A2 Level needs nothing pasted: ' + STUDENT_A2_EMAIL + ' / ' + studentA2 + ')');
  console.log('');
  console.log('Then in Bruno: Center Auth / 03 Login, then B2 Level / 01 or A2 Level / 01.');
}

main()
  .catch(async (error) => {
    await client.query('ROLLBACK').catch(() => {});
    console.error('FAILED:', error.message);
    process.exitCode = 1;
  })
  .finally(() => client.end().catch(() => {}));
