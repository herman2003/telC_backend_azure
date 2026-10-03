import { BadRequestException, Injectable } from '@nestjs/common';
import { amountWithVatXaf } from './vat';

/**
 * What a seat costs.
 *
 * A constant rather than a table: git carries the history of when the price
 * changed and why, and a change gets a review instead of an UPDATE someone
 * runs at night. There is one price because there is one plan — Start (the
 * tiers were removed on 2026-09-23). The add-ons of the new pricing are sold
 * per student or per use and get their own catalogue when they are built.
 *
 * This is a launch price. When it rises, every center already holding seats
 * keeps what it agreed to, because that price is stamped on its seat row
 * rather than read from here.
 */
export const START_PRICE_XAF = 4_500;

/**
 * The fewest seats a paid order may buy.
 *
 * A contract minimum, not a technical one: below ten the invoice is worth less
 * than the conversation that produced it.
 */
export const MIN_PAID_SEATS_TOTAL = 10;

/**
 * The most seats one order may buy. A school with more than this is a
 * conversation, not a checkout.
 */
export const MAX_SEATS_TOTAL = 10_000;

/**
 * The largest amount that fits the `amount_xaf` columns, which are Postgres
 * INTEGER.
 *
 * Checked against the computed total rather than inferred from the seat count,
 * because a stamped price is not bounded by anything — an enterprise price, or
 * a 300000-for-30000 typo in the by-hand stamping workflow, puts a legal seat
 * count over the ceiling. Refusing here turns "integer out of range" at
 * insert, which reaches the client as a 500, into a refusal it can act on.
 */
export const MAX_AMOUNT_XAF = 2_147_483_647;

/**
 * What pricing needs to know about a center. Nothing else about it matters.
 */
export interface CenterPricingContext {
  /**
   * The price already stamped on this center's seat row, or null if it holds
   * no seats yet.
   *
   * Zero is how a free trial seat is held, and is deliberately not a price
   * this center has agreed to pay — see `priceFor`.
   */
  stampedPriceXaf: number | null;
  /** Every student the center governs. They all need a seat. */
  totalStudents: number;
}

export interface Quote {
  seats: number;
  unitPriceXaf: number;
  totalXaf: number;
}

export type QuoteRefusalCode =
  | 'SEATS_INVALID'
  | 'SEATS_BELOW_MINIMUM'
  | 'SEATS_BELOW_STUDENT_COUNT'
  | 'SEATS_ABOVE_MAXIMUM'
  | 'AMOUNT_ABOVE_MAXIMUM';

/**
 * Why an order was refused, and the number needed to fix it in one attempt.
 */
export interface QuoteRefusal {
  code: QuoteRefusalCode;
  /**
   * The fewest seats this order may buy: the contract minimum, or the student
   * body when that is larger. Present on every floor refusal, so one round
   * trip is enough.
   */
  requiredSeatsTotal?: number;
  /** The most seats one order may buy, on `SEATS_ABOVE_MAXIMUM`. */
  maximumSeatsTotal?: number;
  /** The most any order may come to, on `AMOUNT_ABOVE_MAXIMUM`. */
  maximumAmountXaf?: number;
}

/**
 * The single authority on what a center owes.
 *
 * Pure by design: no database, no HTTP, no clock. Everything it needs arrives
 * as a seat count and a context, which is what lets every rule here be tested
 * directly instead of through a request.
 *
 * The price is never an input. A caller says how many seats it wants; what
 * that costs is decided here. An endpoint that accepts an amount is a bug,
 * not a convenience.
 */
@Injectable()
export class PricingService {
  quote(seats: number, context: CenterPricingContext): Quote {
    const refusal = this.explain(seats, context);

    if (refusal) {
      throw this.asException(refusal);
    }

    const unitPriceXaf = this.priceFor(context);
    // unitPrice stays HT (catalogue / grandfathered stamp). totalXaf is TTC:
    // providers only accept one integer amount, with no VAT field.
    const netXaf = seats * unitPriceXaf;

    return {
      seats,
      unitPriceXaf,
      totalXaf: amountWithVatXaf(netXaf),
    };
  }

  /**
   * The seat count, or the refusal it earns.
   *
   * Public because a caller that needs to identify an intent before pricing it
   * — payment idempotency does — must apply exactly the check pricing applies,
   * or two requests meaning the same thing could be fingerprinted differently.
   */
  requireSeats(seats: number): number {
    if (!Number.isInteger(seats) || seats <= 0) {
      throw this.asException({ code: 'SEATS_INVALID' });
    }

    return seats;
  }

  /** One place builds the HTTP shape, so every refusal reaches a client alike. */
  asException(refusal: QuoteRefusal): BadRequestException {
    const { code, ...detail } = refusal;

    return new BadRequestException({ message: code, ...detail });
  }

  /**
   * Which rule an order fails and the number it must reach, or null when it
   * clears all of them.
   *
   * Separate from `quote` so a caller can explain a refusal without provoking
   * one. It therefore never throws — an unusable order is reported, not
   * raised, because a UI asking "what is wrong with this cart" is not an error
   * path.
   */
  explain(seats: number, context: CenterPricingContext): QuoteRefusal | null {
    if (!Number.isInteger(seats) || seats <= 0) {
      return { code: 'SEATS_INVALID' };
    }

    if (seats > MAX_SEATS_TOTAL) {
      return {
        code: 'SEATS_ABOVE_MAXIMUM',
        maximumSeatsTotal: MAX_SEATS_TOTAL,
      };
    }

    // Two floors, and the center has to clear the higher: the contract
    // minimum, and its own student body — every student it governs needs a
    // seat, or the payment would leave some of them without one.
    const requiredSeatsTotal = Math.max(
      MIN_PAID_SEATS_TOTAL,
      context.totalStudents,
    );

    if (seats < context.totalStudents) {
      return { code: 'SEATS_BELOW_STUDENT_COUNT', requiredSeatsTotal };
    }

    if (seats < MIN_PAID_SEATS_TOTAL) {
      return { code: 'SEATS_BELOW_MINIMUM', requiredSeatsTotal };
    }

    // Last, because it is the only rule that needs a price. An order that
    // fails a floor is refused on the floor, which is the more useful answer.
    // Ceiling is on the TTC amount that would be stored / sent to the provider.
    if (amountWithVatXaf(seats * this.priceFor(context)) > MAX_AMOUNT_XAF) {
      return { code: 'AMOUNT_ABOVE_MAXIMUM', maximumAmountXaf: MAX_AMOUNT_XAF };
    }

    return null;
  }

  /**
   * A center already paying keeps the price it agreed to; anyone else pays
   * today's list price.
   *
   * Repricing the row would raise the price on seats the center already has,
   * which is not what adding seats should do.
   *
   * A stamped price of zero is a granted seat, not an agreement — it is how a
   * free trial seat is held. Treating it as a price to honour would quote a
   * trial center 0 XAF for ten seats and then fail the insert, since a payment
   * must be positive. So zero falls through to list price: converting from a
   * trial means starting to pay.
   */
  private priceFor(context: CenterPricingContext): number {
    const stamped = context.stampedPriceXaf;

    return stamped != null && stamped > 0 ? stamped : START_PRICE_XAF;
  }
}
