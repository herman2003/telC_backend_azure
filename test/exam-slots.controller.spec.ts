/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException } from '@nestjs/common';
import { ExamSlotsController } from '../src/modules/centers/exam-slots.controller';
import { CenterAuthGuard } from '../src/modules/centers/guards/center-auth.guard';

/**
 * The two routes a dashboard calls to buy exams.
 *
 * What is worth asserting here rather than in the service: that the center
 * comes from the token, that a purchase cannot be made without an idempotency
 * key, and that the guard is actually on the class — a route that forgot it
 * would let anyone read anyone's balance.
 */
describe('ExamSlotsController', () => {
  const user = { centerUserId: 'owner-1', centerId: 'center-1' } as never;

  let slots: any;
  let rateLimit: any;
  let controller: ExamSlotsController;

  beforeEach(() => {
    slots = {
      balance: jest
        .fn()
        .mockResolvedValue({ slotsRemaining: 7, aiSlotsRemaining: 3 }),
      purchase: jest.fn().mockResolvedValue({ id: 'payment-1' }),
    };
    rateLimit = {
      checkPaymentCreateLimit: jest.fn().mockResolvedValue(undefined),
    };
    controller = new ExamSlotsController(slots, rateLimit);
  });

  it('is behind the center guard, so a balance is never public', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      ExamSlotsController,
    ) as unknown[];

    expect(guards).toContain(CenterAuthGuard);
  });

  describe('reading the balance', () => {
    it('asks about the signed center, never one the caller names', async () => {
      await expect(controller.balance(user)).resolves.toEqual({
        slotsRemaining: 7,
        aiSlotsRemaining: 3,
      });
      expect(slots.balance).toHaveBeenCalledWith(user);
    });
  });

  describe('buying', () => {
    it('passes the quantity and the key through, under the rate limit', async () => {
      await controller.purchase(user, { quantity: 10 }, 'key-1');

      expect(rateLimit.checkPaymentCreateLimit).toHaveBeenCalledWith(
        'center-1',
      );
      expect(slots.purchase).toHaveBeenCalledWith(user, 10, 'key-1', 'MANUAL');
    });

    it('trims the key, because a header often arrives padded', async () => {
      await controller.purchase(user, { quantity: 10 }, '  key-1  ');

      expect(slots.purchase).toHaveBeenCalledWith(user, 10, 'key-1', 'MANUAL');
    });

    it.each([
      ['no key at all', undefined],
      ['an empty one', '   '],
      ['one absurdly long', 'x'.repeat(201)],
    ])('refuses %s rather than creating a payment', async (_case, key) => {
      // Without a key there is nothing to make a retry safe, and a
      // double-clicked purchase would become two payments.
      await expect(
        controller.purchase(user, { quantity: 10 }, key),
      ).rejects.toThrow(BadRequestException);
      expect(slots.purchase).not.toHaveBeenCalled();
    });

    it('checks the limit before it checks the key', async () => {
      // Order matters: a caller hammering the route without a key should
      // still be throttled rather than answered as fast as it can ask.
      await expect(
        controller.purchase(user, { quantity: 10 }, undefined),
      ).rejects.toThrow(BadRequestException);

      expect(rateLimit.checkPaymentCreateLimit).toHaveBeenCalled();
    });
  });
});
