/**
 * telc Deutsch B1 Schriftlicher Ausdruck — letter grades → points.
 *
 * Raw A/B/C/D map to 5/3/1/0 per criterion (max 15). Display / exam weight
 * uses ×3 → 0–45 (15 % of the 300-point exam).
 */

export type TelcLetter = 'A' | 'B' | 'C' | 'D';

export interface TelcSchreibenCriteria {
  /** I Aufgabenbewältigung */
  taskFulfilment: TelcLetter;
  /** II Kommunikative Gestaltung */
  communicativeDesign: TelcLetter;
  /** III Formale Richtigkeit */
  formalAccuracy: TelcLetter;
}

export interface TelcSchreibenRating extends TelcSchreibenCriteria {
  /** 0–45 after D-kill and ×3 scaling. */
  points: number;
}

const LETTER_POINTS: Record<TelcLetter, number> = {
  A: 5,
  B: 3,
  C: 1,
  D: 0,
};

export const TELC_SCHREIBEN_MAX_POINTS = 45;

export function isTelcLetter(value: unknown): value is TelcLetter {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D';
}

export function letterPoints(letter: TelcLetter): number {
  return LETTER_POINTS[letter];
}

/**
 * Cap Aufgabenbewältigung from how many Leitpunkte were addressed.
 * N = required bullets (typically 4).
 */
export function capTaskFulfilment(
  letter: TelcLetter,
  pointsAddressed: number | undefined,
  requiredPoints: number,
): TelcLetter {
  if (
    pointsAddressed === undefined ||
    !Number.isInteger(pointsAddressed) ||
    requiredPoints <= 0
  ) {
    return letter;
  }
  const addressed = Math.max(0, pointsAddressed);
  // Spec: ≤1→D, 2→C, 3→B; ≥4 or ≥N → keep model letter.
  let maxAllowed: TelcLetter = 'A';
  if (addressed >= requiredPoints || addressed >= 4) maxAllowed = 'A';
  else if (addressed <= 1) maxAllowed = 'D';
  else if (addressed === 2) maxAllowed = 'C';
  else maxAllowed = 'B';

  // Lower index = better grade. Cap when the model letter is better than allowed.
  const order: TelcLetter[] = ['A', 'B', 'C', 'D'];
  const letterRank = order.indexOf(letter);
  const maxRank = order.indexOf(maxAllowed);
  return letterRank < maxRank ? maxAllowed : letter;
}

export function telcSchreibenPoints(c: TelcSchreibenCriteria): {
  points: number;
  killed: boolean;
} {
  if (c.taskFulfilment === 'D' || c.formalAccuracy === 'D') {
    return { points: 0, killed: true };
  }
  const raw =
    letterPoints(c.taskFulfilment) +
    letterPoints(c.communicativeDesign) +
    letterPoints(c.formalAccuracy);
  return { points: raw * 3, killed: false };
}

/** 0–100 for student_activity / readiness, from /45 points. */
export function scoreFromTelcPoints(points: number): number {
  return Math.round((points / TELC_SCHREIBEN_MAX_POINTS) * 100);
}

export function buildTelcSchreibenRating(
  criteria: TelcSchreibenCriteria,
  pointsAddressed: number | undefined,
  requiredLeitpunkte: number,
): TelcSchreibenRating {
  const taskFulfilment = capTaskFulfilment(
    criteria.taskFulfilment,
    pointsAddressed,
    requiredLeitpunkte,
  );
  const capped: TelcSchreibenCriteria = {
    ...criteria,
    taskFulfilment,
  };
  const { points } = telcSchreibenPoints(capped);
  return { ...capped, points };
}
