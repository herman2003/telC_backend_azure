-- telc's own Bewertungsbogen M10 produces half-point totals at every level
-- (e.g. B1 Sprechen Teil 1: Vorstellen 1/0.5/0 + Zusatzfragen 2/1/0 can sum
-- to 1.5 or 2.5), but exam_section_results.points was INTEGER and
-- exam-grading.service.ts rejected anything but a whole number. Existing
-- integer marks are exact under this widening -- no data loss.

ALTER TABLE "exam_section_results" ALTER COLUMN "points" TYPE DOUBLE PRECISION;
