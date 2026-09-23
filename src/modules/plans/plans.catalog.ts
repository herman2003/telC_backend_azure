import {
  MIN_PAID_SEATS_TOTAL,
  START_PRICE_XAF,
} from '../centers/pricing.service';
import {
  AI_ALLOWANCE_PER_WINDOW,
  AI_QUOTA_WINDOW_HOURS,
} from '../../shared/services/ai-quota.service';
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
 * as each one is built.
 *
 * Names and descriptions are deliberately absent: they are translations, and
 * they belong in the frontend dictionaries with the rest of the copy.
 */

/**
 * The window label, derived from the constant rather than typed beside it.
 *
 * `AI_QUOTA_WINDOW_HOURS` is a literal, so this is `'per_24h'` at the type
 * level too: change the window to 12 hours and every client that matched
 * `per_24h` stops compiling here instead of silently rendering "per day".
 */
const AI_WINDOW = `per_${AI_QUOTA_WINDOW_HOURS}h` as const;

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
          limit: AI_ALLOWANCE_PER_WINDOW,
          // Stated rather than implied: a rolling window is not a calendar
          // day, and a client that renders "per day" must not reset it at
          // midnight.
          window: AI_WINDOW,
        },
      },
    ],
  };
}
