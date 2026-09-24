-- One plan, Start: the Pro and Premium tiers go, with everything keyed on
-- them. The new pricing (2026-09-23) is Start plus add-ons sold per student or
-- per use, which are entitlements of their own rather than a ladder.
--
-- Nothing is sold yet — production is a demo with no paying center — so the
-- tier columns are dropped rather than migrated. A center holds one seat row,
-- and a payment carries its own unit price instead of per-tier lines.

-- DropForeignKey
ALTER TABLE "payment_lines" DROP CONSTRAINT "payment_lines_payment_id_fkey";

-- DropIndex
DROP INDEX "center_seats_center_id_tier_key";

-- AlterTable
ALTER TABLE "students" DROP COLUMN "tier";

-- AlterTable
ALTER TABLE "center_seats" DROP COLUMN "tier";

-- AlterTable
ALTER TABLE "activation_codes" DROP COLUMN "tier";

-- AlterTable
--
-- Added with a default and then stripped of it: the column is NOT NULL, and a
-- demo database with payments in it would otherwise refuse the statement. Any
-- existing row is a demo purchase at the launch price.
ALTER TABLE "payments" ADD COLUMN "unit_price_xaf" INTEGER NOT NULL DEFAULT 4500;
ALTER TABLE "payments" ALTER COLUMN "unit_price_xaf" DROP DEFAULT;

-- DropTable
DROP TABLE "payment_lines";

-- DropEnum
DROP TYPE "Tier";

-- CreateIndex
--
-- A center that somehow holds several seat rows would refuse this index. That
-- cannot happen from here on: one row per center is the rule the code now
-- upserts against.
CREATE UNIQUE INDEX "center_seats_center_id_key" ON "center_seats"("center_id");
