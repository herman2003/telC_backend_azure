-- Add `block` to exam_section_weights so BLOCK_SECTIONS can be derived from
-- rows instead of hardcoded (exam-scoring.service.ts). Add LESEN_SCHREIBEN
-- for A1/A2, which is not used by any B1/B2 row seeded here.
--
-- ADD VALUE and its first use cannot share a transaction, so this migration
-- only adds the new enum value. Nothing is set to it yet.

ALTER TYPE "ExamBlock" ADD VALUE 'LESEN_SCHREIBEN';
