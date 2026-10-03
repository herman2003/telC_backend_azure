-- AlterTable
ALTER TABLE "center_subscriptions" ADD COLUMN     "anchor_day" INTEGER;


-- A day of the month, not a date. Anything outside 1-31 is a bug upstream,
-- and a renewal date computed from it would land somewhere nobody intended.
ALTER TABLE "center_subscriptions"
  ADD CONSTRAINT "center_subscriptions_anchor_day_range"
  CHECK ("anchor_day" IS NULL OR ("anchor_day" >= 1 AND "anchor_day" <= 31));
