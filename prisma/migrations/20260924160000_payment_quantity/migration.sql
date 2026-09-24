-- `total_seats` has never been only seats since `kind` arrived: it counts exam
-- slots today and will count whatever the next center product sells. Renamed
-- while seats are still the only thing in it.
--
-- Written by hand. `migrate diff` produces DROP COLUMN + ADD COLUMN for a
-- rename, which would discard the quantity of every payment ever made.
ALTER TABLE "payments" RENAME COLUMN "total_seats" TO "quantity";
