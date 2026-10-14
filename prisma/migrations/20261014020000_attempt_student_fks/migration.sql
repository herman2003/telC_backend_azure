-- Harden training attempt tables: require a real student, cascade on erase.
-- Rows whose student_id no longer exists (possible before this FK) are dropped
-- so ADD CONSTRAINT cannot fail on orphans.

DELETE FROM "writing_attempts" wa
WHERE NOT EXISTS (SELECT 1 FROM "students" s WHERE s."id" = wa."student_id");

DELETE FROM "listening_attempts" la
WHERE NOT EXISTS (SELECT 1 FROM "students" s WHERE s."id" = la."student_id");

DELETE FROM "sprachbausteine_attempts" sa
WHERE NOT EXISTS (SELECT 1 FROM "students" s WHERE s."id" = sa."student_id");

DELETE FROM "lesen_attempts" la
WHERE NOT EXISTS (SELECT 1 FROM "students" s WHERE s."id" = la."student_id");

DELETE FROM "speaking_attempts" sa
WHERE NOT EXISTS (SELECT 1 FROM "students" s WHERE s."id" = sa."student_id");

CREATE INDEX IF NOT EXISTS "writing_attempts_student_id_idx" ON "writing_attempts"("student_id");
CREATE INDEX IF NOT EXISTS "listening_attempts_student_id_idx" ON "listening_attempts"("student_id");

ALTER TABLE "writing_attempts"
  ADD CONSTRAINT "writing_attempts_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "listening_attempts"
  ADD CONSTRAINT "listening_attempts_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sprachbausteine_attempts"
  ADD CONSTRAINT "sprachbausteine_attempts_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lesen_attempts"
  ADD CONSTRAINT "lesen_attempts_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "speaking_attempts"
  ADD CONSTRAINT "speaking_attempts_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
