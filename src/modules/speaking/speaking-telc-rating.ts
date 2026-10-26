/**
 * telc Muendlicher Ausdruck — Bewertungsbogen M10, per level.
 *
 * Four criteria graded A-D. The point tables differ by level, and not by a
 * scale factor:
 *
 *   B1  Teil 1 = 15, Teil 2 = 30, Teil 3 = 30   (oral total 75)
 *   B2  all three scored parts = 25             (oral total 75)
 *
 * Both totals are 75, but the letters convert differently — a C is worth 1 at
 * B1 Teil 1, 2 at B1 Teil 2/3 and 3 at B2 — so B2 is a third table rather
 * than B1 rescaled. A middling candidate scores materially higher at B2 than
 * the same letters would suggest under B1's grid.
 *
 * `level` is required everywhere it matters. An unknown level is a programming
 * error, not something to fall back to B1 for: falling back is how a B2
 * candidate silently gets marked as B1.
 */
import type { CefrLevel } from '@prisma/client';

export type TelcLetter = 'A' | 'B' | 'C' | 'D';

export interface TelcSprechenCriteria {
  /** 1 Ausdrucksfaehigkeit */
  expression: TelcLetter;
  /** 2 Aufgabenbewaeltigung */
  taskFulfilment: TelcLetter;
  /** 3 Formale Richtigkeit */
  formalAccuracy: TelcLetter;
  /** 4 Aussprache und Intonation */
  pronunciation: TelcLetter;
}

export interface TelcSprechenRating extends TelcSprechenCriteria {
  points: number;
  maxPoints: number;
  teilNumber: ScoredTeil;
}

type CriterionKey = keyof TelcSprechenCriteria;
type LetterPoints = Record<CriterionKey, Record<TelcLetter, number>>;

/** The Teile telc awards points for. B2's introduction is not one of them. */
export type ScoredTeil = 1 | 2 | 3;

/** Criteria 1-3 share one scale; criterion 4 (pronunciation) is lower. */
const M10_B1_TEIL1: LetterPoints = {
  expression: { A: 4, B: 3, C: 1, D: 0 },
  taskFulfilment: { A: 4, B: 3, C: 1, D: 0 },
  formalAccuracy: { A: 4, B: 3, C: 1, D: 0 },
  pronunciation: { A: 3, B: 2, C: 1, D: 0 },
};

const M10_B1_TEIL23: LetterPoints = {
  expression: { A: 8, B: 6, C: 2, D: 0 },
  taskFulfilment: { A: 8, B: 6, C: 2, D: 0 },
  formalAccuracy: { A: 8, B: 6, C: 2, D: 0 },
  pronunciation: { A: 6, B: 4, C: 2, D: 0 },
};

/**
 * B2, uniform across Teil 1-3: 7 + 7 + 7 + 4 = 25.
 *
 * Source: telc Deutsch B2, Uebungstest 1 (2019), the M10 rating form and its
 * criteria pages.
 */
const M10_B2: LetterPoints = {
  expression: { A: 7, B: 5, C: 3, D: 0 },
  taskFulfilment: { A: 7, B: 5, C: 3, D: 0 },
  formalAccuracy: { A: 7, B: 5, C: 3, D: 0 },
  pronunciation: { A: 4, B: 2, C: 1, D: 0 },
};

export function isTelcLetter(value: unknown): value is TelcLetter {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D';
}

/**
 * Refuses anything that is not a scored Teil.
 *
 * B2 opens with an unscored `Einander kennenlernen`, carried as part 0. The
 * earlier `normalizeTeilNumber` coerced every unexpected value to 1, which
 * would have rated that introduction as a scored opener and returned a
 * confident number for it. The HTTP boundary already rejects it — the
 * evaluate DTO is `@Min(1) @Max(3)` — so this is the guard for an internal
 * caller, where the alternative is a wrong mark rather than an error.
 */
export class UnscoredTeilError extends Error {
  constructor(readonly teilNumber: number) {
    super(`Teil ${teilNumber} is not a scored Teil of the telc oral exam`);
    this.name = 'UnscoredTeilError';
  }
}

export function assertScoredTeil(teilNumber: number): ScoredTeil {
  if (teilNumber === 1 || teilNumber === 2 || teilNumber === 3) {
    return teilNumber;
  }
  // Its own type, so a caller can tell this apart from a failure to store.
  // Thrown bare, it reached the store path's catch and was logged as
  // "Speaking attempt not stored" — a caller bug wearing a database error's
  // clothes.
  throw new UnscoredTeilError(teilNumber);
}

function tableFor(level: CefrLevel, teilNumber: number): LetterPoints {
  const teil = assertScoredTeil(teilNumber);
  if (level === 'B2') return M10_B2;
  return teil === 1 ? M10_B1_TEIL1 : M10_B1_TEIL23;
}

/** The points a perfect performance is worth, for this level and Teil. */
export function m10MaxPoints(level: CefrLevel, teilNumber: number): number {
  const table = tableFor(level, teilNumber);
  return (
    table.expression.A +
    table.taskFulfilment.A +
    table.formalAccuracy.A +
    table.pronunciation.A
  );
}

export function m10PointsForTeil(
  criteria: TelcSprechenCriteria,
  level: CefrLevel,
  teilNumber: number,
): { points: number; maxPoints: number } {
  const table = tableFor(level, teilNumber);
  const points =
    table.expression[criteria.expression] +
    table.taskFulfilment[criteria.taskFulfilment] +
    table.formalAccuracy[criteria.formalAccuracy] +
    table.pronunciation[criteria.pronunciation];
  return { points, maxPoints: m10MaxPoints(level, teilNumber) };
}

/** 0-100 for student_activity / readiness, from Teil points. */
export function scoreFromM10Points(points: number, maxPoints: number): number {
  if (maxPoints <= 0) return 0;
  return Math.round((points / maxPoints) * 100);
}

export function criterionMax(
  level: CefrLevel,
  teilNumber: number,
  key: CriterionKey,
): number {
  return tableFor(level, teilNumber)[key].A;
}

export function criterionPercent(
  letter: TelcLetter,
  level: CefrLevel,
  teilNumber: number,
  key: CriterionKey,
): number {
  const max = criterionMax(level, teilNumber, key);
  if (max <= 0) return 0;
  const pts = tableFor(level, teilNumber)[key][letter];
  return Math.round((pts / max) * 100);
}

export function buildTelcSprechenRating(
  criteria: TelcSprechenCriteria,
  level: CefrLevel,
  teilNumber: number,
): TelcSprechenRating {
  const teil = assertScoredTeil(teilNumber);
  const { points, maxPoints } = m10PointsForTeil(criteria, level, teil);
  return { ...criteria, points, maxPoints, teilNumber: teil };
}
