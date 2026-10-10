import type { Skill } from '@prisma/client';

/**
 * The D38 calculation, as pure functions: skill scores, readiness, alerts.
 *
 * Nothing here reads the database or stores a result. Every number is derived
 * from `StudentActivity` when asked, so changing a weight below changes every
 * student's history at once, with nothing to migrate.
 */

/** Teils per skill in telc B1. A Teil never attempted counts 0 (D38). */
export const TEILS_PER_SKILL: Record<Skill, number> = {
  HOEREN: 3,
  LESEN: 3,
  SPRACHBAUSTEINE: 2,
  SCHREIBEN: 1,
  SPRECHEN: 3,
};

/**
 * Official telc Deutsch B1 / Zertifikat Deutsch point caps (Übungstest grid).
 * Change them here and nowhere else.
 */
export const SKILL_MAX_POINTS: Record<Skill, number> = {
  LESEN: 75,
  SPRACHBAUSTEINE: 30,
  HOEREN: 75,
  SCHREIBEN: 45,
  SPRECHEN: 75,
};

export const WRITTEN_SKILLS: Skill[] = [
  'LESEN',
  'SPRACHBAUSTEINE',
  'HOEREN',
  'SCHREIBEN',
];

export const WRITTEN_MAX = 225;
export const ORAL_MAX = 75;
export const TOTAL_MAX = 300;

/** 60 % of each half: 135 / 225 written, 45 / 75 oral. */
export const PASS_WRITTEN_POINTS = 135;
export const PASS_ORAL_POINTS = 45;

/** Kept for callers/docs: 60 % of a half. Prefer the point thresholds above. */
export const PASS_MARK = 60;

/** Under this many attempts in total, readiness is not a number yet. */
export const MIN_ATTEMPTS_FOR_READINESS = 5;
/** How many recent attempts make a Teil score. */
export const RECENT_ATTEMPTS_PER_TEIL = 3;

/** Alert thresholds, the ones the dashboard already uses (D38). */
export const INACTIVE_AFTER_DAYS = 7;
export const LOW_PROGRESS_BELOW = 40;
export const WEAK_SKILL_BELOW = 45;

export const SKILLS: Skill[] = [
  'HOEREN',
  'LESEN',
  'SPRACHBAUSTEINE',
  'SCHREIBEN',
  'SPRECHEN',
];

/** One Teil's score: the mean of its recent attempts, in percent. */
export interface TeilScore {
  skill: Skill;
  teil: number;
  score: number;
}

export type SkillScores = Record<Skill, number | null>;

/**
 * Skill score = mean of its Teil scores, a Teil never attempted counting 0.
 * A skill with no attempt at all is null: "not practised yet", never 0 %.
 */
export function skillScores(teils: TeilScore[]): SkillScores {
  const result = {} as SkillScores;
  for (const skill of SKILLS) {
    const own = teils.filter(
      (t) =>
        t.skill === skill && t.teil >= 1 && t.teil <= TEILS_PER_SKILL[skill],
    );
    if (own.length === 0) {
      result[skill] = null;
      continue;
    }
    const sum = own.reduce((total, t) => total + t.score, 0);
    // Not rounded: the pass mark is decided on the exact score (59.67 is not
    // 60). Round with `roundScores` only for display.
    result[skill] = sum / TEILS_PER_SKILL[skill];
  }
  return result;
}

/** Whole points, for the response and for the alerts the user reads. */
export function roundScores(scores: SkillScores): SkillScores {
  const result = {} as SkillScores;
  for (const skill of SKILLS) {
    const score = scores[skill];
    result[skill] = score === null ? null : Math.round(score);
  }
  return result;
}

/** Exact telc points for one skill from its percent score (null → 0). */
export function skillPoints(skills: SkillScores, skill: Skill): number {
  const percent = skills[skill] ?? 0;
  return (percent / 100) * SKILL_MAX_POINTS[skill];
}

export interface Readiness {
  /** 0–100, or null under MIN_ATTEMPTS_FOR_READINESS attempts. */
  score: number | null;
  /** 0–100 of the written half (225 pts). */
  written: number | null;
  /** 0–100 of the oral half (75 pts). */
  oral: number | null;
  /** Both halves at the pass mark. False while there is not enough data. */
  ready: boolean;
  /** Estimated points out of 300 (null under min attempts). */
  pointsTotal: number | null;
  /** Estimated written points out of 225. */
  pointsWritten: number | null;
  /** Estimated oral points out of 75. */
  pointsOral: number | null;
}

/**
 * Readiness mirrors telc Deutsch B1 scoring: written (225) and oral (75),
 * each needing 60 % (135 / 45). Skills never practised count 0 here
 * (option C): a student who skips speaking is not ready.
 *
 * Takes the exact skill scores from `skillScores`, never the rounded ones:
 * rounding first would let 59.67 pass.
 */
export function readiness(
  skills: SkillScores,
  totalAttempts: number,
): Readiness {
  if (totalAttempts < MIN_ATTEMPTS_FOR_READINESS) {
    return {
      score: null,
      written: null,
      oral: null,
      ready: false,
      pointsTotal: null,
      pointsWritten: null,
      pointsOral: null,
    };
  }

  let pointsWritten = 0;
  for (const skill of WRITTEN_SKILLS) {
    pointsWritten += skillPoints(skills, skill);
  }
  const pointsOral = skillPoints(skills, 'SPRECHEN');
  const pointsTotal = pointsWritten + pointsOral;

  const written = (pointsWritten / WRITTEN_MAX) * 100;
  const oral = (pointsOral / ORAL_MAX) * 100;
  const score = (pointsTotal / TOTAL_MAX) * 100;

  return {
    score: Math.round(score),
    written: Math.round(written),
    oral: Math.round(oral),
    // Compared on exact points: 134.9 is not a pass.
    ready:
      pointsWritten >= PASS_WRITTEN_POINTS && pointsOral >= PASS_ORAL_POINTS,
    pointsTotal: Math.round(pointsTotal),
    pointsWritten: Math.round(pointsWritten),
    pointsOral: Math.round(pointsOral),
  };
}

export type ProgressAlert =
  | { type: 'inactive'; lastActivityAt: Date | null }
  | { type: 'low_progress'; readiness: number }
  | { type: 'weak_skill'; skill: Skill; score: number };

/**
 * Takes the rounded skill scores: an alert must agree with the number shown
 * beside it, so a skill displayed as 45 is never flagged as under 45.
 */
export function alerts(
  skills: SkillScores,
  result: Readiness,
  lastActivityAt: Date | null,
  now: Date,
): ProgressAlert[] {
  const found: ProgressAlert[] = [];
  const inactiveSince = now.getTime() - INACTIVE_AFTER_DAYS * 86_400_000;
  if (!lastActivityAt || lastActivityAt.getTime() < inactiveSince) {
    found.push({ type: 'inactive', lastActivityAt });
  }
  if (result.score !== null && result.score < LOW_PROGRESS_BELOW) {
    found.push({ type: 'low_progress', readiness: result.score });
  }
  for (const skill of SKILLS) {
    const score = skills[skill];
    // Only a skill already practised: "not practised yet" is not weak.
    if (score !== null && score < WEAK_SKILL_BELOW) {
      found.push({ type: 'weak_skill', skill, score });
    }
  }
  return found;
}
