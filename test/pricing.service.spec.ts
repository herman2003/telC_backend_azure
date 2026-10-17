import { BadRequestException } from '@nestjs/common';
import {
  MAX_AMOUNT_XAF,
  MAX_SEATS_TOTAL,
  MIN_PAID_SEATS_TOTAL,
  PricingService,
  START_PRICE_XAF,
  type CenterPricingContext,
} from '../src/modules/centers/pricing.service';
import { amountWithVatXaf } from '../src/modules/centers/vat';

/**
 * What a center owes, and the rules it cannot talk its way around.
 *
 * One plan since 2026-09-23, so a quote is a seat count and a price. The price
 * is never an input: the caller says how many seats it wants and the server
 * says what that costs.
 */
describe('PricingService', () => {
  const pricing = new PricingService();

  const context = (over: Partial<CenterPricingContext> = {}) => ({
    stampedPriceXaf: null,
    totalStudents: 0,
    ...over,
  });

  const refusal = (seats: number, ctx = context()) => {
    const error = pricing.explain(seats, ctx);
    expect(error).not.toBeNull();
    return error!;
  };

  describe('what a quote costs', () => {
    it('prices seats at the list price for a center that holds none', () => {
      expect(pricing.quote(10, context())).toEqual({
        seats: 10,
        unitPriceXaf: START_PRICE_XAF,
        // HT 45_000 → TTC with 18% VAT (provider amount).
        totalXaf: amountWithVatXaf(10 * START_PRICE_XAF),
        billableSeats: 10,
        billingKind: 'full_pack',
        daysLeft: null,
        daysInPeriod: null,
        amountHtXaf: 45_000,
      });
    });

    it('honours the price a center already agreed to, high or low', () => {
      const grandfathered = pricing.quote(
        12,
        context({ stampedPriceXaf: 4_000 }),
      );

      expect(grandfathered).toMatchObject({
        unitPriceXaf: 4_000,
        totalXaf: amountWithVatXaf(48_000),
        billingKind: 'full_pack',
        amountHtXaf: 48_000,
      });
    });

    it('quotes a mid-period addition at day prorata, not full delta months', () => {
      const quoted = pricing.quote(
        16,
        context({
          stampedPriceXaf: 4_500,
          paidSeats: 10,
          paidUntil: new Date('2026-02-01T00:00:00+01:00'),
          anchorDay: 1,
          now: new Date('2026-01-05T00:00:00+01:00'),
        }),
      );

      expect(quoted).toMatchObject({
        seats: 16,
        billableSeats: 6,
        billingKind: 'mid_period_addition',
        daysLeft: 27,
        daysInPeriod: 31,
        amountHtXaf: 23_600,
        totalXaf: amountWithVatXaf(23_600),
      });
    });

    it('refuses quoting the same seat total mid-period as NOTHING_TO_PAY', () => {
      expect(() =>
        pricing.quote(
          10,
          context({
            stampedPriceXaf: 4_500,
            paidSeats: 10,
            paidUntil: new Date('2026-02-01T00:00:00+01:00'),
            anchorDay: 1,
            now: new Date('2026-01-05T00:00:00+01:00'),
          }),
        ),
      ).toThrow(BadRequestException);
      try {
        pricing.quote(
          10,
          context({
            stampedPriceXaf: 4_500,
            paidSeats: 10,
            paidUntil: new Date('2026-02-01T00:00:00+01:00'),
            anchorDay: 1,
            now: new Date('2026-01-05T00:00:00+01:00'),
          }),
        );
      } catch (error) {
        expect((error as BadRequestException).getResponse()).toMatchObject({
          message: 'NOTHING_TO_PAY',
        });
      }
    });

    it('charges the list price to a center whose seats were free', () => {
      // A trial seat is stamped at zero. Honouring that would quote 0 XAF for
      // ten seats: converting from a trial means starting to pay.
      expect(
        pricing.quote(10, context({ stampedPriceXaf: 0 })).unitPriceXaf,
      ).toBe(START_PRICE_XAF);
    });
  });

  describe('what it refuses', () => {
    it.each([
      ['zero seats', 0],
      ['a negative count', -5],
      ['a fraction', 2.5],
    ])('refuses %s as SEATS_INVALID', (_case, seats) => {
      expect(refusal(seats).code).toBe('SEATS_INVALID');
    });

    it('refuses fewer than the contract minimum, and says what it is', () => {
      expect(refusal(MIN_PAID_SEATS_TOTAL - 1)).toEqual({
        code: 'SEATS_BELOW_MINIMUM',
        requiredSeatsTotal: MIN_PAID_SEATS_TOTAL,
      });
    });

    it('refuses fewer seats than the center has students', () => {
      // Every student needs a seat, so the student body is its own floor.
      expect(refusal(12, context({ totalStudents: 18 }))).toEqual({
        code: 'SEATS_BELOW_STUDENT_COUNT',
        requiredSeatsTotal: 18,
      });
    });

    it('reports the higher of the two floors, so one attempt is enough', () => {
      expect(refusal(3, context({ totalStudents: 4 }))).toMatchObject({
        requiredSeatsTotal: MIN_PAID_SEATS_TOTAL,
      });
    });

    it('refuses more seats than one order may hold', () => {
      expect(refusal(MAX_SEATS_TOTAL + 1)).toEqual({
        code: 'SEATS_ABOVE_MAXIMUM',
        maximumSeatsTotal: MAX_SEATS_TOTAL,
      });
    });

    it('refuses an amount that would not fit the column', () => {
      // A stamped price is not bounded by anything, so a legal seat count can
      // still exceed the ceiling. Refusing here beats "integer out of range".
      const enormous = context({ stampedPriceXaf: 1_000_000 });

      expect(refusal(MAX_SEATS_TOTAL, enormous)).toEqual({
        code: 'AMOUNT_ABOVE_MAXIMUM',
        maximumAmountXaf: MAX_AMOUNT_XAF,
      });
    });

    it('accepts everything that clears the rules', () => {
      expect(pricing.explain(10, context({ totalStudents: 10 }))).toBeNull();
    });
  });

  describe('how a refusal travels', () => {
    it('quote throws what explain reports, with the numbers kept', () => {
      const thrown = (() => {
        try {
          pricing.quote(2, context());
        } catch (error) {
          return error as BadRequestException;
        }
      })();

      expect(thrown).toBeInstanceOf(BadRequestException);
      expect(thrown!.getResponse()).toEqual({
        message: 'SEATS_BELOW_MINIMUM',
        requiredSeatsTotal: MIN_PAID_SEATS_TOTAL,
      });
    });

    it('explain never throws, because "what is wrong with this cart" is a question', () => {
      expect(() => pricing.explain(0, context())).not.toThrow();
    });

    it('requireSeats passes a usable count and refuses the rest', () => {
      expect(pricing.requireSeats(10)).toBe(10);
      expect(() => pricing.requireSeats(0)).toThrow(BadRequestException);
    });
  });
});
