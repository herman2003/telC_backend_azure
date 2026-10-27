/**
 * telc A1/A2 Schreiben Teil 2 (TEXT_SCHREIBEN) — training AI score from the
 * section's own rubric in material (half-points), not the B1 A–D → /45 grid.
 *
 * Content: selectRequired Leitpunkte × pointsPerPoint[FULL|PARTIAL|NONE]
 * Communicative design: points[FULL|PARTIAL|NONE]
 * Typical max = 10 (3×3 + 1).
 */

export type A12Band = 'FULL' | 'PARTIAL' | 'NONE';

export interface A12LetterRubric {
  contentPoints: {
    selectRequired: number;
    pointsPerPoint: [number, number, number];
  };
  communicativeDesign: {
    points: [number, number, number];
  };
}

export interface A12LetterRating {
  contentPointBands: A12Band[];
  communicativeDesign: A12Band;
  /** Raw exam points (half-points allowed). */
  points: number;
  maxPoints: number;
  /** 0–100 for student_activity / readiness. */
  scorePercent: number;
}

const BAND_INDEX: Record<A12Band, 0 | 1 | 2> = {
  FULL: 0,
  PARTIAL: 1,
  NONE: 2,
};

export function isA12Band(value: unknown): value is A12Band {
  return value === 'FULL' || value === 'PARTIAL' || value === 'NONE';
}

export function parseA12LetterRubric(
  material: unknown,
): A12LetterRubric | null {
  if (!material || typeof material !== 'object') return null;
  const rubric = (material as { rubric?: unknown }).rubric;
  if (!rubric || typeof rubric !== 'object') return null;
  const r = rubric as {
    contentPoints?: {
      selectRequired?: unknown;
      pointsPerPoint?: unknown;
    };
    communicativeDesign?: { points?: unknown };
  };
  const selectRequired = r.contentPoints?.selectRequired;
  const pointsPerPoint = r.contentPoints?.pointsPerPoint;
  const kg = r.communicativeDesign?.points;
  if (
    typeof selectRequired !== 'number' ||
    !Number.isInteger(selectRequired) ||
    selectRequired < 1 ||
    !Array.isArray(pointsPerPoint) ||
    pointsPerPoint.length !== 3 ||
    !pointsPerPoint.every((n) => typeof n === 'number') ||
    !Array.isArray(kg) ||
    kg.length !== 3 ||
    !kg.every((n) => typeof n === 'number')
  ) {
    return null;
  }
  return {
    contentPoints: {
      selectRequired,
      pointsPerPoint: pointsPerPoint as [number, number, number],
    },
    communicativeDesign: {
      points: kg as [number, number, number],
    },
  };
}

export function bandPoints(
  band: A12Band,
  table: [number, number, number],
): number {
  return table[BAND_INDEX[band]];
}

/**
 * Sum content bands (exactly selectRequired entries) + communicative design.
 * Extra bands are ignored; missing bands count as NONE.
 */
export function buildA12LetterRating(
  contentPointBands: A12Band[],
  communicativeDesign: A12Band,
  rubric: A12LetterRubric,
  maxPoints: number,
): A12LetterRating {
  const n = rubric.contentPoints.selectRequired;
  const bands: A12Band[] = [];
  for (let i = 0; i < n; i++) {
    bands.push(contentPointBands[i] ?? 'NONE');
  }
  let points = 0;
  for (const band of bands) {
    points += bandPoints(band, rubric.contentPoints.pointsPerPoint);
  }
  points += bandPoints(communicativeDesign, rubric.communicativeDesign.points);
  const cappedMax = maxPoints > 0 ? maxPoints : 10;
  const scorePercent = Math.round((points / cappedMax) * 100);
  return {
    contentPointBands: bands,
    communicativeDesign,
    points,
    maxPoints: cappedMax,
    scorePercent: Math.min(100, Math.max(0, scorePercent)),
  };
}
