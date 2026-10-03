/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Idempotency is a claim about a unique index, and a mock has no unique index.
 *
 * The double-click case is the reason this file exists: two requests carrying
 * one key, in flight at once, must leave exactly one row. A mocked Prisma will
 * happily "create" twice and report success both times.
 *
 * It also carries a claim a mock cannot check: the price a center agreed to
 * is stamped on its seat row, and a payment copies it rather than looking it
 * up again.
 *
 * Runs against the disposable branch in `.env.test`, over the direct endpoint.
 */
import { PrismaService } from '../src/shared/services/prisma.service';
import { PricingService } from '../src/modules/centers/pricing.service';
import { PaymentsService } from '../src/modules/centers/payments.service';
import { CenterSeatsService } from '../src/modules/centers/center-seats.service';

const prisma = new PrismaService();
const payments = new PaymentsService(
  prisma,
  new PricingService(),
  new CenterSeatsService(prisma),
);

/**
 * The signed identity now carries the manager too, because the profile gate
 * asks about the signed-in manager's phone.
 */
const identity = (centerId: string, centerUserId = `${centerId}-owner`) =>
  ({ centerId, centerUserId }) as never;

async function wipe() {
  await prisma.centerUser.deleteMany({
    where: { email: { startsWith: 'payments-test-' } },
  });
  // Students first. `center_id` is ON DELETE SET NULL, so deleting the center
  // would leave them behind with no center — harmless here, but
  // they would pile up in the branch across runs.
  await prisma.student.deleteMany({
    where: { email: { startsWith: 'payments-test-' } },
  });
  await prisma.center.deleteMany({
    where: { name: { startsWith: 'Payments Test' } },
  });
}

/**
 * A center whose profile is complete: country, city and a manager with a
 * phone. That is what it takes to be charged, and the default here because
 * most tests are about pricing rather than about onboarding.
 */
async function makeCenter(over: Record<string, unknown> = {}) {
  const center = await prisma.center.create({
    data: {
      name: `Payments Test ${Date.now()}-${Math.random()}`,
      country_code: 'CM',
      city_id: 'douala',
      subscription: { create: { plan: 'TRIAL' } },
      ...over,
    },
  });

  await prisma.centerUser.create({
    data: {
      id: `${center.id}-owner`,
      center_id: center.id,
      role: 'OWNER',
      first_name: 'Alain',
      last_name: 'Ngeukeu',
      email: `payments-test-owner-${center.id}@example.com`,
      password_hash: 'x',
      email_verified: true,
      phone: '+237690000000',
    },
  });

  return center;
}

/** A center that registered and stopped: no country, city or manager phone. */
async function makeDraftCenter(managerPhone: string | null = null) {
  const center = await prisma.center.create({
    data: {
      name: `Payments Test Draft ${Date.now()}-${Math.random()}`,
      subscription: { create: { plan: 'TRIAL' } },
    },
  });

  await prisma.centerUser.create({
    data: {
      id: `${center.id}-owner`,
      center_id: center.id,
      role: 'OWNER',
      first_name: 'Alain',
      last_name: 'Ngeukeu',
      email: `payments-test-draft-${center.id}@example.com`,
      password_hash: 'x',
      email_verified: true,
      phone: managerPhone,
    },
  });

  return center;
}

/** A seat row is what stamps a price, and therefore what grandfathers it. */
async function holdSeats(
  centerId: string,
  quantity: number,
  unitPriceXaf: number,
) {
  await prisma.centerSeat.create({
    data: { center_id: centerId, quantity, unit_price_xaf: unitPriceXaf },
  });
}

/** Students occupy seats, so they set the floor a payment cannot go under. */
async function makeStudents(centerId: string, count: number) {
  for (let i = 0; i < count; i++) {
    await prisma.student.create({
      data: {
        email: `payments-test-${i}-${Date.now()}-${Math.random()}@example.com`,
        center_id: centerId,
      },
    });
  }
}

describe('payments against real Postgres', () => {
  beforeEach(wipe);

  afterAll(async () => {
    await wipe();
    await prisma.onModuleDestroy();
  });

  describe('creating one', () => {
    it('records what the server priced, not what anyone asked for', async () => {
      const center = await makeCenter();

      const payment = await payments.create(identity(center.id), 10, 'key-1');

      expect(payment).toMatchObject({
        seats: 10,
        unitPriceXaf: 4_500,
        amountXaf: 53_100,
        status: 'PENDING',
      });
    });

    it('stamps the price onto the payment row itself', async () => {
      // The claim the response cannot make on its own: the price is really
      // stored, so an invoice read back after a price rise still says what
      // the center agreed to.
      const center = await makeCenter();

      const payment = await payments.create(identity(center.id), 10, 'key-1');

      const row = await prisma.payment.findUniqueOrThrow({
        where: { id: payment.id },
      });
      expect(row.unit_price_xaf).toBe(4_500);
      expect(row.quantity).toBe(10);
      expect(row.amount_xaf).toBe(53_100);
    });

    it('keeps the price a center already agreed to when adding seats', async () => {
      // Grandfathering, end to end. The list price is 4,500 today and will
      // rise; this center bought at 4,000 and keeps it. Only the two added
      // seats are charged (TTC).
      const center = await makeCenter();
      await holdSeats(center.id, 10, 4_000);

      const payment = await payments.create(identity(center.id), 12, 'key-1');

      expect(payment.seats).toBe(12);
      expect(payment.unitPriceXaf).toBe(4_000);
      expect(payment.amountXaf).toBe(9_440); // 2 × 4_000 HT + 18% VAT
    });

    it('charges only seats added above an already-paid pool', async () => {
      // Dashboard shows the delta; Fapshi must receive the same amount — not
      // a full re-bill of seats already paid.
      const center = await makeCenter();
      await holdSeats(center.id, 10, 4_500);

      const payment = await payments.create(identity(center.id), 12, 'key-1');

      expect(payment.seats).toBe(12);
      expect(payment.amountXaf).toBe(10_620); // 2 × 4_500 HT + 18% VAT
    });

    it('refuses a payment that adds no seats', async () => {
      const center = await makeCenter();
      await holdSeats(center.id, 10, 4_500);

      await expect(
        payments.create(identity(center.id), 10, 'key-1'),
      ).rejects.toThrow('NOTHING_TO_PAY');
    });

    it('grants nothing', async () => {
      // The whole point of the phase boundary. A pending payment must leave
      // the subscription exactly as it found it; only Phase 7 may move it.
      const center = await makeCenter();
      const before = await prisma.centerSubscription.findUniqueOrThrow({
        where: { center_id: center.id },
      });

      await payments.create(identity(center.id), 10, 'key-1');

      const after = await prisma.centerSubscription.findUniqueOrThrow({
        where: { center_id: center.id },
      });
      expect(after.paid_until).toBeNull();
      expect(after.plan).toBe(before.plan);
      // No seat row either. Holding seats is what a successful payment buys,
      // and it is now the only place a seat count lives.
      expect(
        await prisma.centerSeat.count({ where: { center_id: center.id } }),
      ).toBe(0);
    });

    it('leaves an existing seat row untouched, price included', async () => {
      // The stronger half of "grants nothing", and the one a center with a
      // seat row would actually notice. Counting rows on a center that holds
      // none would pass even if paying repriced or resized what it holds.
      const center = await makeCenter();
      await holdSeats(center.id, 4, 4_000);
      const before = await prisma.centerSeat.findFirstOrThrow({
        where: { center_id: center.id },
      });

      await payments.create(identity(center.id), 12, 'key-1');

      const after = await prisma.centerSeat.findFirstOrThrow({
        where: { center_id: center.id },
      });
      expect(after.quantity).toBe(4);
      expect(after.unit_price_xaf).toBe(4_000);
      expect(after.updated_at).toEqual(before.updated_at);
    });

    it('records an amount that is the billable seats times the price with VAT', async () => {
      // Nothing else checks that the stored total and its parts agree.
      const center = await makeCenter();

      const payment = await payments.create(identity(center.id), 10, 'key-1');

      const row = await prisma.payment.findUniqueOrThrow({
        where: { id: payment.id },
      });

      expect(row.amount_xaf).toBe(
        Math.round((row.quantity * row.unit_price_xaf * 118) / 100),
      );
    });

    /**
     * A trial seat is a seat row priced at zero, so a converting center
     * arrives here holding a seat at 0. Honouring that as an agreed price
     * would quote it nothing: converting from a trial means starting to pay.
     */
    it('lets a trial center on a zero-priced seat actually pay', async () => {
      const center = await makeCenter();
      await holdSeats(center.id, 1, 0);
      await makeStudents(center.id, 1);

      const payment = await payments.create(identity(center.id), 10, 'key-1');

      expect(payment.unitPriceXaf).toBe(4_500);
      expect(payment.amountXaf).toBe(53_100);
    });

    it('refuses an order the minimum rejects', async () => {
      const center = await makeCenter();

      await expect(
        payments.create(identity(center.id), 9, 'key-1'),
      ).rejects.toThrow('SEATS_BELOW_MINIMUM');

      const rows = await prisma.payment.count({
        where: { center_id: center.id },
      });
      // Nothing recorded. A refused quote must not leave a payment behind.
      expect(rows).toBe(0);
    });

    /**
     * The floor that matters: every student the center governs needs a seat.
     * This is the case a mocked Prisma cannot judge, because the count comes
     * from the rows.
     */
    it('refuses ten seats to a center with twelve students', async () => {
      const center = await makeCenter();
      await makeStudents(center.id, 12);

      await expect(
        payments.create(identity(center.id), 10, 'key-1'),
      ).rejects.toThrow('SEATS_BELOW_STUDENT_COUNT');

      expect(
        await prisma.payment.count({ where: { center_id: center.id } }),
      ).toBe(0);
    });

    it('accepts an order that seats every student', async () => {
      const center = await makeCenter();
      await makeStudents(center.id, 12);

      const payment = await payments.create(identity(center.id), 12, 'key-1');

      expect(payment.seats).toBe(12);
    });

    it('refuses a token whose center no longer exists', async () => {
      // A center token outlives its center: the guard caches the identity and
      // never rechecks the row. Without the existence read this is a
      // foreign-key error at insert, which reaches the center as a 500.
      const center = await makeCenter();
      // The manager goes first: center_users has no cascade, so a center
      // cannot be deleted while one exists.
      await prisma.centerUser.deleteMany({ where: { center_id: center.id } });
      await prisma.center.delete({ where: { id: center.id } });

      await expect(
        payments.create(identity(center.id), 10, 'key-1'),
      ).rejects.toThrow('CENTER_NOT_FOUND');
    });
  });

  /**
   * The gate sits at payment, not at provisioning.
   *
   * None of country, city or the manager's phone is needed to run a trial — a
   * center can try the product on the strength of an email address. All three
   * are needed to take money: the phone is how an unpaid invoice gets chased,
   * and country decides currency and tax.
   */
  describe('a center must finish its profile before it can pay', () => {
    it('refuses a draft center, naming every field it still owes', async () => {
      const center = await makeDraftCenter();

      await expect(
        payments.create(identity(center.id), 10, 'key-1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          message: 'CENTER_PROFILE_INCOMPLETE',
          missing: ['country', 'city', 'phone'],
        }),
      });
    });

    it('records nothing when it refuses', async () => {
      const center = await makeDraftCenter();

      await expect(
        payments.create(identity(center.id), 10, 'key-1'),
      ).rejects.toThrow('CENTER_PROFILE_INCOMPLETE');

      expect(
        await prisma.payment.count({ where: { center_id: center.id } }),
      ).toBe(0);
    });

    it('still refuses when only the manager phone is missing', async () => {
      // Two of three is not complete. The phone is the one that matters most
      // for chasing money, so it cannot be the one that gets waived.
      const center = await prisma.center.create({
        data: {
          name: `Payments Test Draft No Phone ${Date.now()}`,
          country_code: 'CM',
          city_id: 'douala',
          subscription: { create: { plan: 'TRIAL' } },
        },
      });
      await prisma.centerUser.create({
        data: {
          id: `${center.id}-owner`,
          center_id: center.id,
          role: 'OWNER',
          first_name: 'Alain',
          last_name: 'Ngeukeu',
          email: `payments-test-nophone-${center.id}@example.com`,
          password_hash: 'x',
          email_verified: true,
          phone: null,
        },
      });

      await expect(
        payments.create(identity(center.id), 10, 'key-1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ missing: ['phone'] }),
      });
    });

    it('treats whitespace as unanswered', async () => {
      const center = await makeDraftCenter('   ');

      await expect(
        payments.create(identity(center.id), 10, 'key-1'),
      ).rejects.toThrow('CENTER_PROFILE_INCOMPLETE');
    });

    it('accepts a center that has finished its profile', async () => {
      const center = await makeCenter();

      await expect(
        payments.create(identity(center.id), 10, 'key-1'),
      ).resolves.toMatchObject({ status: 'PENDING' });
    });
  });

  describe('the same key twice', () => {
    it('creates exactly one row when two requests race', async () => {
      const center = await makeCenter();

      const results = await Promise.allSettled([
        payments.create(identity(center.id), 10, 'same-key'),
        payments.create(identity(center.id), 10, 'same-key'),
      ]);

      // Both succeed: the loser of the insert race is answered from the row
      // that won, because a double-click is one intent, not a failure.
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

      const rows = await prisma.payment.findMany({
        where: { center_id: center.id },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].amount_xaf).toBe(53_100);
    });

    it('returns the original record rather than a second one', async () => {
      const center = await makeCenter();

      const first = await payments.create(identity(center.id), 10, 'same-key');
      const replay = await payments.create(identity(center.id), 10, 'same-key');

      expect(replay.id).toBe(first.id);
      expect(replay.createdAt).toEqual(first.createdAt);
      expect(replay.amountXaf).toBe(first.amountXaf);
    });

    /**
     * The retry that used to be refused.
     *
     * The fingerprint covered the priced order, so a stamped price changing
     * between an attempt and its retry made a byte-identical request look like
     * a different purchase. The client's documented answer to
     * IDEMPOTENCY_KEY_REUSED is a fresh key — which produces a second payment
     * for one intent, the exact failure the unique index exists to prevent.
     *
     * A fingerprint identifies what the caller asked for. The price is the
     * server's answer, and the original row stays the authority on it.
     */
    it('answers a retry from the original row after the price moved', async () => {
      const center = await makeCenter();
      const first = await payments.create(identity(center.id), 10, 'same-key');
      expect(first.unitPriceXaf).toBe(4_500);

      // The by-hand stamping workflow, or the planned move to 4,800.
      await holdSeats(center.id, 10, 4_000);

      const replay = await payments.create(identity(center.id), 10, 'same-key');

      expect(replay.id).toBe(first.id);
      // Still the price it was actually charged, not a reprice.
      expect(replay.unitPriceXaf).toBe(4_500);
      expect(
        await prisma.payment.count({ where: { center_id: center.id } }),
      ).toBe(1);
    });

    it('refuses the same key carrying a different seat count', async () => {
      const center = await makeCenter();
      const first = await payments.create(identity(center.id), 10, 'same-key');

      // A different intent wearing the same name. Handing back the original
      // would tell a client it had bought twenty seats when it bought ten.
      await expect(
        payments.create(identity(center.id), 20, 'same-key'),
      ).rejects.toThrow('IDEMPOTENCY_KEY_REUSED');

      const rows = await prisma.payment.findMany({
        where: { center_id: center.id },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].quantity).toBe(first.seats);
    });

    it('lets two different centers use the same key text', async () => {
      // The key is unique per center, not globally. Two centers picking the
      // same uuid must not collide with each other.
      const a = await makeCenter();
      const b = await makeCenter();

      await payments.create(identity(a.id), 10, 'shared-text');
      await expect(
        payments.create(identity(b.id), 10, 'shared-text'),
      ).resolves.toBeDefined();
    });
  });

  describe('reading them back', () => {
    it('refuses to show another center a payment', async () => {
      const mine = await makeCenter();
      const theirs = await makeCenter();
      const payment = await payments.create(identity(theirs.id), 10, 'key-1');

      // 404, never 403. A 403 would confirm the id exists.
      await expect(payments.get(identity(mine.id), payment.id)).rejects.toThrow(
        'PAYMENT_NOT_FOUND',
      );
    });

    it('lists newest first, scoped to one center', async () => {
      const center = await makeCenter();
      await payments.create(identity(center.id), 10, 'key-1');
      await payments.create(identity(center.id), 11, 'key-2');

      const history = await payments.list(identity(center.id), {
        page: 1,
        pageSize: 20,
      });

      expect(history.total).toBe(2);
      expect(history.payments[0]).toMatchObject({
        seats: 11,
        unitPriceXaf: 4_500,
        amountXaf: 58_410,
      });
    });

    it('reads a payment back the way it was created', async () => {
      // A payment and the quote that produced it have to read the same way.
      const center = await makeCenter();
      const created = await payments.create(identity(center.id), 10, 'key-1');

      const read = await payments.get(identity(center.id), created.id);

      expect(read).toEqual(created);
    });
  });
});
