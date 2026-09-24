-- Which payment method opened the checkout (notchpay = Mobile Money, stripe = card).
-- Null until the first checkout; additive only.
ALTER TABLE "payments" ADD COLUMN "provider" TEXT;
