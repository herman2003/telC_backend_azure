/**
 * The seat row, against real Postgres.
 *
 * One plan since 2026-09-23, so a center holds exactly one seat row. The
 * claims here are all about constraints — one row per center, a free trial
 * seat, a price that cannot go negative — and constraints are the one thing a
 * mock cannot have.
 *
 * Runs against the disposable branch in `.env.test`, over the direct endpoint.
 */
import { PrismaService } from '../src/shared/services/prisma.service';

const prisma = new PrismaService();

async function wipe() {
  await prisma.student.deleteMany({
    where: { email: { endsWith: '@seats.integration.test' } },
  });
  await prisma.centerSeat.deleteMany({
    where: { center: { name: { startsWith: 'Seats Test' } } },
  });
  await prisma.center.deleteMany({
    where: { name: { startsWith: 'Seats Test' } },
  });
}

const makeCenter = () =>
  prisma.center.create({
    data: { name: `Seats Test ${Date.now()}-${Math.random()}` },
  });

describe('center seats against real Postgres', () => {
  beforeEach(wipe);

  afterAll(async () => {
    await wipe();
    await prisma.onModuleDestroy();
  });

  describe('holding seats', () => {
    it('holds a centers whole allowance in one row', async () => {
      const center = await makeCenter();

      const seat = await prisma.centerSeat.create({
        data: { center_id: center.id, quantity: 10, unit_price_xaf: 4500 },
      });

      expect(seat).toMatchObject({ quantity: 10, unit_price_xaf: 4500 });
    });

    it('refuses a second row for the same center', async () => {
      // Quantity belongs in one row. Two rows would mean the seat count
      // depends on remembering to sum them.
      const center = await makeCenter();
      await prisma.centerSeat.create({
        data: { center_id: center.id, quantity: 5, unit_price_xaf: 4500 },
      });

      await expect(
        prisma.centerSeat.create({
          data: { center_id: center.id, quantity: 1, unit_price_xaf: 4500 },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('lets two centers hold seats independently', async () => {
      const a = await makeCenter();
      const b = await makeCenter();

      await prisma.centerSeat.create({
        data: { center_id: a.id, quantity: 5, unit_price_xaf: 4500 },
      });

      await expect(
        prisma.centerSeat.create({
          data: { center_id: b.id, quantity: 5, unit_price_xaf: 4800 },
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('the stamped price', () => {
    it('keeps a partner price that differs from the list price', async () => {
      // The whole point of stamping: raising the list price later must not
      // rewrite what this center agreed to.
      const center = await makeCenter();

      const seat = await prisma.centerSeat.create({
        data: { center_id: center.id, quantity: 10, unit_price_xaf: 4000 },
      });

      expect(seat.unit_price_xaf).toBe(4000);
    });

    it('allows a free seat, which is how a trial is held', async () => {
      // A trial is an ordinary seat priced at zero, so the check must be "not
      // negative" rather than "positive".
      const center = await makeCenter();

      const seat = await prisma.centerSeat.create({
        data: { center_id: center.id, quantity: 1, unit_price_xaf: 0 },
      });

      expect(seat.unit_price_xaf).toBe(0);
    });

    it('refuses a negative price', async () => {
      const center = await makeCenter();

      await expect(
        prisma.$executeRaw`
          INSERT INTO center_seats (id, center_id, quantity, unit_price_xaf, created_at, updated_at)
          VALUES (${`neg-${Date.now()}`}, ${center.id}, 1, -1, now(), now())
        `,
      ).rejects.toThrow();
    });

    it('refuses a seat count of zero', async () => {
      // A row saying "no seats" is not the same as no row, and would make
      // every count ambiguous.
      const center = await makeCenter();

      await expect(
        prisma.$executeRaw`
          INSERT INTO center_seats (id, center_id, quantity, unit_price_xaf, created_at, updated_at)
          VALUES (${`zero-${Date.now()}`}, ${center.id}, 0, 4500, now(), now())
        `,
      ).rejects.toThrow();
    });
  });

  it('removes a centers seats when the center goes', async () => {
    // Seats belong to the center and mean nothing without it, so they cascade
    // rather than being left as orphans.
    const center = await makeCenter();
    await prisma.centerSeat.create({
      data: { center_id: center.id, quantity: 5, unit_price_xaf: 4500 },
    });

    await prisma.center.delete({ where: { id: center.id } });

    const orphans = await prisma.centerSeat.count({
      where: { center_id: center.id },
    });
    expect(orphans).toBe(0);
  });
});
