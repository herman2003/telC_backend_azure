import {
  MIN_PAID_SEATS_TOTAL,
  START_PRICE_XAF,
} from '../centers/pricing.service';
import { FREE_LIVE_SESSIONS_PER_MONTH } from '../../shared/services/entitlement-spend.service';
import { PLAN_ID, type PlanId } from '../../shared/plan-id';

/**
 * What a plan costs and allows, assembled from the constants that are already
 * enforced elsewhere.
 *
 * Nothing here is typed by hand twice. The price comes from the service that
 * builds a quote and the allowance from the service that refuses an AI call,
 * so a plan can never advertise something the backend does not do — which is
 * the whole reason the frontend stops holding its own copy of these numbers.
 *
 * One plan since 2026-09-23: Start. The add-ons of the new pricing — Prep
 * Pass, Exam Day, AI Assisted Learning, AI Speaking credits — are listed here
 * as each one is built. They are not plans: a centre buys them on top of
 * Start, and what a given student holds is `GET /api/me/entitlements`, not
 * this catalogue.
 *
 * Names and descriptions are deliberately absent: they are translations, and
 * they belong in the frontend dictionaries with the rest of the copy.
 */

/**
 * A calendar month, which is what Start promises.
 *
 * It was `per_24h` until 2026-09-25, when the allowance became five sessions a
 * month rather than two a rolling day. A client matching the old string will
 * not recognise this one — deliberately, because silently rendering "per day"
 * over a monthly number is worse than failing to render at all. Both frontends
 * were told in the same change request as the five-minute session cap.
 */
const AI_WINDOW = 'per_month' as const;

export type { PlanId };

export interface PlanView {
  id: PlanId;
  monthlyPricePerSeatXaf: number;
  aiSpeaking: { limit: number; window: typeof AI_WINDOW };
}

export interface PlansView {
  minSeats: number;
  plans: PlanView[];
}

/**
 * Deliberately not reported: an annual discount.
 *
 * Annual billing is not decided yet. A route that announced it would be
 * promising what no code enforces, and a school would have agreed to
 * something we cannot deliver. It appears here the day it is built.
 */
export function buildPlansView(): PlansView {
  return {
    minSeats: MIN_PAID_SEATS_TOTAL,
    plans: [
      {
        id: PLAN_ID,
        monthlyPricePerSeatXaf: START_PRICE_XAF,
        aiSpeaking: {
          limit: FREE_LIVE_SESSIONS_PER_MONTH,
          // Stated rather than implied, so a client cannot assume. The window
          // is the UTC calendar month, and it resets on the 1st.
          window: AI_WINDOW,
        },
      },
    ],
  };
}
