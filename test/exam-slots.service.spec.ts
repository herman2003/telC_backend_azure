/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  EXAM_SLOT_PRICE_XAF,
  EXAM_SLOT_PRICE_XAF_AI,
  ExamSlotsService,
  MAX_EXAM_SLOTS_PER_ORDER,
} from '../src/modules/centers/exam-slots.service';

/**
 * Buying the right to run an exam.
 *
 * Deliberately thin beside the seat path: a quantity times a constant, no
 * floor, no pricing context, no grandfathering. A center buying three slots
 * for three candidates is an ordinary school, which is why the ten-seat rule
 * has no business here.
 */
describe('ExamSlotsService', () => {
  const identity = { centerUserId: 'owner-1', centerId: 'center-1' } as never;

  /** What the shared profile gate reads: the signed manager, and the center
   *  through them. */
  const completeManager = {
    phone: '+237600000000',
    center: { country_code: 'CM', city_id: 'douala', city_other: null },
  };

  let prisma: any;
  let service: ExamSlotsService;

  beforeEach(() => {
    prisma = {
      center: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          exam_slots_remaining: 7,
          exam_ai_slots_remaining: 0,
        }),
      },
      centerUser: { findFirst: jest.fn().mockResolvedValue(completeManager) },
      payment: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'payment-1',
          created_at: new Date(),
          ...data,
          // The column default, which is what `status: undefined` asks for.
          status: data.status ?? 'PENDING',
        })),
        findUnique: jest.fn(),
      },
    };
    service = new ExamSlotsService(prisma);
  });

  describe('what a slot costs', () => {
    it('prices one thousand each, with no minimum order', () => {
      // The rule that separates slots from seats. A sitting for three
      // candidates is a real thing a school does.
      expect(EXAM_SLOT_PRICE_XAF).toBe(1_000);
      expect(service.quote(1, 'MANUAL')).toEqual({
        quantity: 1,
        tier: 'MANUAL',
        unitPriceXaf: 1_000,
        totalXaf: 1_000,
      });
    });

    it('multiplies rather than negotiating', () => {
      expect(service.quote(37, 'MANUAL').totalXaf).toBe(37_000);
    });

    it.each([
      ['zero', 0],
      ['a negative count', -5],
      ['a fraction', 2.5],
    ])('refuses %s', (_case, quantity) => {
      expect(() => service.quote(quantity, 'MANUAL')).toThrow(
        'EXAM_SLOTS_INVALID',
      );
    });

    it('refuses an order larger than one school could ever sit', () => {
      // Without a ceiling a typo turns into an amount the column cannot hold,
      // and the refusal becomes "integer out of range" from Postgres.
      expect(() =>
        service.quote(MAX_EXAM_SLOTS_PER_ORDER + 1, 'MANUAL'),
      ).toThrow('EXAM_SLOTS_ABOVE_MAXIMUM');
    });
  });

  describe('the AI tier', () => {
    it('costs five hundred more a candidate', async () => {
      expect(EXAM_SLOT_PRICE_XAF_AI).toBe(1_500);
      expect(service.quote(10, 'AI')).toMatchObject({
        unitPriceXaf: 1_500,
        totalXaf: 15_000,
      });
    });

    it('buys into its own pool, not the same one', async () => {
      // A center holding ten cheap slots must not be able to run ten AI
      // exams. The two are different products at different prices.
      await service.purchase(identity, 5, 'key-1', 'AI');

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kind: 'EXAM_SLOTS_AI',
            unit_price_xaf: 1_500,
            amount_xaf: 7_500,
          }),
        }),
      );
    });

    it('reports both balances, because a center may hold both', async () => {
      prisma.center.findUniqueOrThrow.mockResolvedValue({
        exam_slots_remaining: 7,
        exam_ai_slots_remaining: 3,
      });

      await expect(service.balance(identity)).resolves.toEqual({
        slotsRemaining: 7,
        aiSlotsRemaining: 3,
      });
    });

    it('does not let one key mean both tiers', async () => {
      // Ten manual slots is 10,000 XAF and ten AI slots is 15,000. One
      // idempotency key matching both would bill a center for the wrong
      // product.
      expect(service.fingerprintFor('center-1', 10, 'MANUAL')).not.toEqual(
        service.fingerprintFor('center-1', 10, 'AI'),
      );
    });
  });

  describe('buying them', () => {
    it('writes the purchase against the signed center, marked as slots', async () => {
      const payment = await service.purchase(identity, 5, 'key-1');

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            center_id: 'center-1',
            kind: 'EXAM_SLOTS',
            quantity: 5,
            unit_price_xaf: 1_000,
            amount_xaf: 5_000,
          }),
        }),
      );
      expect(payment).toMatchObject({
        kind: 'EXAM_SLOTS',
        quantity: 5,
        amountXaf: 5_000,
        status: 'PENDING',
      });
    });

    it('grants nothing on its own', async () => {
      // A pending payment is an intention. Only a verified provider event
      // credits the balance.
      await service.purchase(identity, 5, 'key-1');

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: undefined }),
        }),
      );
    });

    it('refuses a center that has not finished its profile', async () => {
      // Same gate as seats: taking money needs a country for the currency, a
      // city for support and a phone to chase an unpaid invoice.
      prisma.centerUser.findFirst.mockResolvedValue({
        phone: null,
        center: { country_code: null, city_id: null, city_other: null },
      });

      await expect(service.purchase(identity, 5, 'key-1')).rejects.toThrow(
        'CENTER_PROFILE_INCOMPLETE',
      );
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('refuses before pricing when the quantity is unusable', async () => {
      await expect(service.purchase(identity, 0, 'key-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.centerUser.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('the same key twice', () => {
    // The columns, as Prisma names them — not the constraint. Getting this
    // wrong is exactly what the shared reader exists to survive.
    const duplicate = Object.assign(new Error('unique'), {
      code: 'P2002',
      meta: { target: ['center_id', 'idempotency_key'] },
    });

    it('hands back the original when the intent matches', async () => {
      prisma.payment.create.mockRejectedValue(duplicate);
      prisma.payment.findUnique.mockImplementation(async () => ({
        id: 'payment-1',
        kind: 'EXAM_SLOTS',
        quantity: 5,
        unit_price_xaf: 1_000,
        amount_xaf: 5_000,
        status: 'PENDING',
        created_at: new Date(),
        request_hash: service.fingerprintFor('center-1', 5, 'MANUAL'),
      }));

      await expect(
        service.purchase(identity, 5, 'key-1'),
      ).resolves.toMatchObject({
        id: 'payment-1',
      });
    });

    it('refuses a different quantity wearing the same key', async () => {
      prisma.payment.create.mockRejectedValue(duplicate);
      prisma.payment.findUnique.mockResolvedValue({
        id: 'payment-1',
        request_hash: service.fingerprintFor('center-1', 5, 'MANUAL'),
      });

      await expect(service.purchase(identity, 9, 'key-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('refuses a seat payment wearing a slot key, even at the same number', async () => {
      // The reason the fingerprint carries the kind. Ten seats and ten slots
      // are 45,000 XAF and 10,000 XAF; handing back either for the other
      // would bill a center for the wrong product.
      prisma.payment.create.mockRejectedValue(duplicate);
      prisma.payment.findUnique.mockResolvedValue({
        id: 'payment-1',
        // What the seat path would have hashed for the same number.
        request_hash: 'a-seat-fingerprint-for-ten',
      });

      await expect(service.purchase(identity, 10, 'key-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
