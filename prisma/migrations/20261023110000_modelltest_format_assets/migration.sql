-- Level-wide content metadata not already authoritative elsewhere: Hoeren's
-- Exam Day delivery contract and grade bands (format), and the visual-asset
-- manifest (assets). Null for every existing row -- B1/B2, and any A1/A2
-- Modelltest imported before this column existed.

ALTER TABLE "modelltests" ADD COLUMN "format" JSONB;
ALTER TABLE "modelltests" ADD COLUMN "assets" JSONB;
