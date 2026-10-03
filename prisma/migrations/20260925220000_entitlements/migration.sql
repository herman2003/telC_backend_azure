-- CreateEnum
CREATE TYPE "EntitlementProduct" AS ENUM ('PREP_PASS', 'AI_SPEAKING_CREDIT', 'AI_ASSISTED_LEARNING');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentKind" ADD VALUE 'PREP_PASS';
ALTER TYPE "PaymentKind" ADD VALUE 'AI_SPEAKING_CREDIT';
ALTER TYPE "PaymentKind" ADD VALUE 'AI_ASSISTED_LEARNING';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "center_entitlement_pools" (
    "center_id" TEXT NOT NULL,
    "product" "EntitlementProduct" NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "center_entitlement_pools_pkey" PRIMARY KEY ("center_id","product")
);

-- CreateTable
CREATE TABLE "code_entitlement_caps" (
    "code_id" TEXT NOT NULL,
    "product" "EntitlementProduct" NOT NULL,
    "cap" INTEGER NOT NULL DEFAULT 0,
    "used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_entitlement_caps_pkey" PRIMARY KEY ("code_id","product")
);

-- CreateTable
CREATE TABLE "code_entitlements" (
    "code_id" TEXT NOT NULL,
    "product" "EntitlementProduct" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_entitlements_pkey" PRIMARY KEY ("code_id","product")
);

-- CreateIndex
CREATE INDEX "code_entitlements_product_expires_at_idx" ON "code_entitlements"("product", "expires_at");

-- AddForeignKey
ALTER TABLE "center_entitlement_pools" ADD CONSTRAINT "center_entitlement_pools_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_entitlement_caps" ADD CONSTRAINT "code_entitlement_caps_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "activation_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_entitlements" ADD CONSTRAINT "code_entitlements_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "activation_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- The backstops under the conditional updates that move these numbers.
--
-- A pool below zero would mean a session ran on credit nobody bought. The
-- spend is written as `UPDATE ... WHERE balance >= 1`, which is what actually
-- prevents it; this is what turns a future read-then-write into a failure
-- instead of a free session.
ALTER TABLE "center_entitlement_pools"
  ADD CONSTRAINT "center_entitlement_pools_balance_non_negative"
  CHECK ("balance" >= 0);

-- A cap of zero is meaningful — it is how a manager stops somebody — but a
-- negative one is not.
ALTER TABLE "code_entitlement_caps"
  ADD CONSTRAINT "code_entitlement_caps_cap_non_negative"
  CHECK ("cap" >= 0);

ALTER TABLE "code_entitlement_caps"
  ADD CONSTRAINT "code_entitlement_caps_used_non_negative"
  CHECK ("used" >= 0);

-- Deliberately absent: a constraint that `used` may not exceed `cap`.
-- Lowering a cap to zero mid-term is how a center stops a student, and the six
-- sessions they already ran are history rather than a contradiction. The rule
-- that matters is `used < cap`, checked when spending.
