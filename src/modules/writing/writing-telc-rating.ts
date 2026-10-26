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
  /**
   * The ladder is relative to how many Leitpunkte the task asks for: A for
   * all of them, B for one short, C for two short, D below that. telc states
   * it that way at both levels, and the counts differ — four at B1, three at
   * B2 — so the rungs come from `requiredPoints` rather than from B1's four
   * written as literals. At N=4 this is exactly the previous behaviour.
   *
   * `addressed >= 4` is kept as it was. It makes four addressed points enough
   * for an A even where a task asks for more, which only bites at N>4 — no
   * telc task we hold does, and the case is pinned by a test. The one
   * behaviour it does not preserve is N=5 with three addressed, which now
   * caps at C rather than B; nothing exercises it.
   */
  let maxAllowed: TelcLetter;
  if (addressed >= requiredPoints || addressed >= 4) maxAllowed = 'A';
  else if (addressed === requiredPoints - 1) maxAllowed = 'B';
  else if (addressed === requiredPoints - 2) maxAllowed = 'C';
  else maxAllowed = 'D';

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
