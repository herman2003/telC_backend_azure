-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "amount_net_xaf" INTEGER,
ADD COLUMN     "renews_period" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "vat_amount_xaf" INTEGER;


-- `renews_period` defaults true because that is what every existing row meant:
-- before this column, paying always started a new period. A payment already
-- PENDING when this lands therefore keeps the meaning it was created under,
-- rather than changing when its webhook arrives. The opposite default would
-- deny a period to a center that had paid for one.

-- The two amount columns stay NULL on existing rows on purpose. Whether an old
-- row's `amount_xaf` was HT or TTC cannot be read off the row, and a backfill
-- that guessed would put a wrong number on an invoice.
