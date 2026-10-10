/**
 * telc Deutsch B1 Mündlicher Ausdruck — Bewertungsbogen M10.
 *
 * Four criteria graded A–D; points differ for Teil 1 vs Teil 2/3.
 * Max: T1 = 15, T2 = 30, T3 = 30 (oral total 75).
 */

export type TelcLetter = 'A' | 'B' | 'C' | 'D';

export interface TelcSprechenCriteria {
  /** 1 Ausdrucksfähigkeit */
  expression: TelcLetter;
  /** 2 Aufgabenbewältigung */
  taskFulfilment: TelcLetter;
  /** 3 Formale Richtigkeit */
  formalAccuracy: TelcLetter;
  /** 4 Aussprache und Intonation */
  pronunciation: TelcLetter;
}

export interface TelcSprechenRating extends TelcSprechenCriteria {
  points: number;
  maxPoints: number;
  teilNumber: 1 | 2 | 3;
}

type CriterionKey = keyof TelcSprechenCriteria;

/** Criteria 1–3 share one scale; criterion 4 (pronunciation) is lower. */
const M10_TEIL1: Record<CriterionKey, Record<TelcLetter, number>> = {
  expression: { A: 4, B: 3, C: 1, D: 0 },
  taskFulfilment: { A: 4, B: 3, C: 1, D: 0 },
  formalAccuracy: { A: 4, B: 3, C: 1, D: 0 },
  pronunciation: { A: 3, B: 2, C: 1, D: 0 },
};

const M10_TEIL23: Record<CriterionKey, Record<TelcLetter, number>> = {
  expression: { A: 8, B: 6, C: 2, D: 0 },
  taskFulfilment: { A: 8, B: 6, C: 2, D: 0 },
  formalAccuracy: { A: 8, B: 6, C: 2, D: 0 },
  pronunciation: { A: 6, B: 4, C: 2, D: 0 },
};

export function isTelcLetter(value: unknown): value is TelcLetter {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D';
}

export function normalizeTeilNumber(teilNumber: number): 1 | 2 | 3 {
  if (teilNumber === 2) return 2;
  if (teilNumber === 3) return 3;
  return 1;
}

export function m10MaxPoints(teilNumber: number): 15 | 30 {
  return normalizeTeilNumber(teilNumber) === 1 ? 15 : 30;
}

function tableForTeil(teilNumber: number) {
  return normalizeTeilNumber(teilNumber) === 1 ? M10_TEIL1 : M10_TEIL23;
}

export function m10PointsForTeil(
  criteria: TelcSprechenCriteria,
  teilNumber: number,
): { points: number; maxPoints: 15 | 30 } {
  const table = tableForTeil(teilNumber);
  const points =
    table.expression[criteria.expression] +
    table.taskFulfilment[criteria.taskFulfilment] +
    table.formalAccuracy[criteria.formalAccuracy] +
    table.pronunciation[criteria.pronunciation];
  return { points, maxPoints: m10MaxPoints(teilNumber) };
}

/** 0–100 for student_activity / readiness, from Teil points. */
export function scoreFromM10Points(points: number, maxPoints: number): number {
  if (maxPoints <= 0) return 0;
  return Math.round((points / maxPoints) * 100);
}

export function criterionMax(teilNumber: number, key: CriterionKey): number {
  return tableForTeil(teilNumber)[key].A;
}

export function criterionPercent(
  letter: TelcLetter,
  teilNumber: number,
  key: CriterionKey,
): number {
  const max = criterionMax(teilNumber, key);
  if (max <= 0) return 0;
  const pts = tableForTeil(teilNumber)[key][letter];
  return Math.round((pts / max) * 100);
}

export function buildTelcSprechenRating(
  criteria: TelcSprechenCriteria,
  teilNumber: number,
): TelcSprechenRating {
  const teil = normalizeTeilNumber(teilNumber);
  const { points, maxPoints } = m10PointsForTeil(criteria, teil);
  return { ...criteria, points, maxPoints, teilNumber: teil };
}
