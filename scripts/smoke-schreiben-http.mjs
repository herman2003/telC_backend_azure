/**
 * Live HTTP proof for AI_SCHREIBEN_CREDIT:
 * centre buy → fake activate → assign → student redeem → 3 writing submits
 * → 3rd burns one credit; AI correction reaches completed (or pending→wait).
 *
 * Requires: API on :3001 (npm run start:testdb), .env.test, seeded fixture.
 *
 *   node scripts/seed-b2-bruno-fixture.mjs
 *   node scripts/smoke-schreiben-http.mjs
 */
import dotenv from 'dotenv';
import { createHmac, randomUUID } from 'crypto';
import pg from 'pg';
import { createRequire } from 'module';

dotenv.config({ path: '.env.test' });
const require = createRequire(import.meta.url);
const { isProduction } = require('./production-endpoint.cjs');

const unquote = (v) => {
  if (!v) return v;
  const t = v.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  )
    return t.slice(1, -1);
  return t;
};

const BASE = process.env.BRUNO_BASE_URL || 'http://localhost:3001';
const CENTER_EMAIL = 'ngeukeualain@gmail.com';
const CENTER_PASSWORD = 'A-strong-password1';
const STUDENT_EMAIL = 'ngeukeualain+b2student@gmail.com';
const STUDENT_PASSWORD = 'Student-Pass1!';
const CODE_ID = '0b2f1000-0000-4000-8000-00000000c005';
const ACTIVATION_KEY = 'LQ-BBTT-WXYZ';
const CENTER_ID = '0b2f1000-0000-4000-8000-00000000c001';

const dbUrl = unquote(process.env.DIRECT_URL || process.env.DATABASE_URL);
const fakeSecret = unquote(process.env.FAKE_PAYMENT_WEBHOOK_SECRET);
if (!dbUrl || isProduction(dbUrl)) {
  console.error('REFUSING: bad DATABASE');
  process.exit(1);
}
if (!fakeSecret || fakeSecret.length < 32) {
  console.error('Need FAKE_PAYMENT_WEBHOOK_SECRET ≥32 in .env.test');
  process.exit(1);
}

async function json(method, path, { token, body, headers } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function activatePayment(paymentId) {
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  const ref = `fake_${paymentId}`;
  await client.query(
    `UPDATE payments
        SET provider_reference = $2,
            checkout_url = COALESCE(checkout_url, $3),
            updated_at = now()
      WHERE id = $1 AND status = 'PENDING'`,
    [paymentId, ref, `https://checkout.fake-payments.invalid/${ref}`],
  );
  await client.end();

  const raw = JSON.stringify({ reference: ref, outcome: 'SUCCEEDED' });
  const signature = createHmac('sha256', fakeSecret).update(raw).digest('hex');
  const res = await fetch(`${BASE}/api/webhooks/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-fake-signature': signature,
    },
    body: raw,
  });
  return { status: res.status, data: await res.json() };
}

async function seatCap() {
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  const r = await client.query(
    `SELECT cap, used FROM code_entitlement_caps
      WHERE code_id = $1 AND product = 'AI_SCHREIBEN_CREDIT'`,
    [CODE_ID],
  );
  await client.end();
  return r.rows[0] || { cap: 0, used: 0 };
}

async function clearTodayWriting(studentId) {
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  await client.query(
    `DELETE FROM writing_attempts
      WHERE student_id = $1 AND exam_attempt_id IS NULL
        AND created_at >= (now() AT TIME ZONE 'utc')::date`,
    [studentId],
  );
  await client.end();
}

async function ensureSeatLevelB2() {
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  await client.query(
    `UPDATE activation_codes SET level = 'B2', updated_at = now() WHERE id = $1`,
    [CODE_ID],
  );
  // Detach any prior student so redeem can claim the seat again.
  await client.query(
    `UPDATE activation_codes
        SET student_id = NULL, status = 'ACTIVATED',
            connected_at = NULL, connected_ip = NULL,
            updated_at = now()
      WHERE id = $1`,
    [CODE_ID],
  );
  await client.query(
    `UPDATE students SET center_id = NULL, level = NULL, updated_at = now()
      WHERE email = $1`,
    [STUDENT_EMAIL],
  );
  await client.end();
}

function letter(n) {
  return (
    `Sehr geehrte Damen und Herren,\n\n` +
    `dies ist ein Testbrief Nummer ${n} für die Korrektur.\n` +
    `Mit freundlichen Grüßen\nSmoke Test`
  );
}

const steps = [];
const ok = (name, pass, detail) => {
  steps.push({ name, pass, detail });
  console.log(pass ? '✓' : '✗', name, detail ?? '');
};

try {
  await ensureSeatLevelB2();

  // --- Centre: buy + activate + assign ---
  const login = await json('POST', '/api/center-auth/login', {
    body: {
      email: CENTER_EMAIL,
      password: CENTER_PASSWORD,
      deviceId: 'smoke-center-1',
      deviceName: 'smoke',
    },
  });
  ok('center login', login.status === 201, login.status);
  const centerToken = login.data?.accessToken;
  if (!centerToken) throw new Error('no center token');

  const purchase = await json('POST', '/api/centers/me/entitlements/purchase', {
    token: centerToken,
    headers: { 'Idempotency-Key': `smoke-schreiben-${Date.now()}` },
    body: { product: 'AI_SCHREIBEN_CREDIT', quantity: 10 },
  });
  ok(
    'purchase AI_SCHREIBEN_CREDIT',
    purchase.status === 201 && purchase.data?.unitPriceXaf === 200,
    `${purchase.status} ${purchase.data?.amountXaf}`,
  );
  const paymentId = purchase.data?.id;
  if (!paymentId) throw new Error('no paymentId');

  // Fake provider path (local). Not live Fapshi/Stripe — those need real keys
  // and would move money. Documented below.
  const activated = await activatePayment(paymentId);
  ok(
    'fake webhook ACTIVATED',
    activated.status === 200 && activated.data?.outcome === 'ACTIVATED',
    JSON.stringify(activated.data),
  );

  const assign = await json(
    'PUT',
    `/api/centers/me/codes/${CODE_ID}/entitlements/AI_SCHREIBEN_CREDIT`,
    { token: centerToken, body: { cap: 5 } },
  );
  ok('assign 5 credits to seat', assign.status === 200, assign.status);

  const before = await seatCap();
  ok('seat has 5 assigned', before.cap === 5, JSON.stringify(before));

  // --- Student: login + redeem ---
  const studentLogin = await json('POST', '/api/auth/login', {
    body: {
      email: STUDENT_EMAIL,
      password: STUDENT_PASSWORD,
      deviceId: 'smoke-student-1',
      deviceName: 'smoke',
    },
  });
  ok('student login', studentLogin.status === 201, studentLogin.status);
  const studentToken = studentLogin.data?.accessToken;
  const studentId = studentLogin.data?.student?.id ?? studentLogin.data?.user?.id;
  if (!studentToken) throw new Error('no student token');

  // Resolve student id from DB if login body shape differs
  let sid = studentId;
  if (!sid) {
    const client = new pg.Client({ connectionString: dbUrl });
    await client.connect();
    const r = await client.query(`SELECT id FROM students WHERE email = $1`, [
      STUDENT_EMAIL,
    ]);
    sid = r.rows[0]?.id;
    await client.end();
  }
  ok('student id known', !!sid, sid);

  const redeem = await json('POST', '/api/auth/redeem-code', {
    token: studentToken,
    body: { code: ACTIVATION_KEY },
  });
  ok(
    'redeem seat',
    redeem.status === 200 || redeem.status === 201,
    `${redeem.status} ${JSON.stringify(redeem.data)?.slice(0, 120)}`,
  );

  await clearTodayWriting(sid);

  const exercise = await json('GET', '/api/writing/exercise?modelltest=7', {
    token: studentToken,
  });
  ok('GET Schreiben exercise', exercise.status === 200, exercise.status);
  const exerciseId = exercise.data?.id || exercise.data?.choices?.[0]?.id;
  ok('exercise id', !!exerciseId, exerciseId);

  // Submit 1 & 2 = free; 3 = credit
  const attemptIds = [];
  for (let n = 1; n <= 3; n++) {
    const attemptId = randomUUID();
    attemptIds.push(attemptId);
    const sub = await json('POST', '/api/writing/submit', {
      token: studentToken,
      body: {
        attemptId,
        exerciseId,
        content: letter(n),
      },
    });
    const capAfter = await seatCap();
    ok(
      `submit #${n}`,
      sub.status === 201 || sub.status === 200,
      `http=${sub.status} status=${sub.data?.status} cap=${capAfter.cap} used=${capAfter.used}`,
    );
    if (n < 3) {
      ok(
        `submit #${n} used free (cap still 5)`,
        capAfter.cap === 5,
        JSON.stringify(capAfter),
      );
    } else {
      ok(
        `submit #3 burned 1 credit (cap 4)`,
        capAfter.cap === 4 && capAfter.used >= 1,
        JSON.stringify(capAfter),
      );
    }
  }

  // Wait briefly for AI correction on last attempt
  let completed = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const client = new pg.Client({ connectionString: dbUrl });
    await client.connect();
    const r = await client.query(
      `SELECT status, score IS NOT NULL AS has_score
         FROM writing_attempts WHERE attempt_id = $1`,
      [attemptIds[2]],
    );
    await client.end();
    if (r.rows[0]?.status === 'completed') {
      completed = true;
      ok(
        'AI correction completed on credit submit',
        true,
        JSON.stringify(r.rows[0]),
      );
      break;
    }
  }
  if (!completed) {
    ok(
      'AI correction completed on credit submit',
      false,
      'still pending after ~30s (model slow or key missing — attempt was accepted)',
    );
  }
} catch (e) {
  console.error('FATAL', e);
  ok('fatal', false, e.message);
}

const failed = steps.filter((s) => !s.pass);
console.log('');
console.log(
  failed.length === 0
    ? 'SMOKE_OK'
    : `SMOKE_FAIL ${failed.length}/${steps.length}`,
);
console.log(
  'Payment note: activation used FAKE webhook (local). Live Fapshi/Stripe checkout is not run here — that would use real provider credentials and can charge money.',
);
process.exit(failed.length === 0 ? 0 : 1);
