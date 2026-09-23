/**
 * What a client calls the plan.
 *
 * There is one: Start. The Pro and Premium tiers were removed on 2026-09-23,
 * when the pricing became a single plan plus add-ons sold separately. The
 * field stays in responses — a seat still says which plan it is — so clients
 * keep a place to read when the add-ons arrive.
 */
export type PlanId = 'start';

export const PLAN_ID: PlanId = 'start';
