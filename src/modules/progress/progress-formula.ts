import type { Skill } from '@prisma/client';

/**
 * The D38 calculation, as pure functions: skill scores, readiness, alerts.
 *
 * Nothing here reads the database or stores a result. Every number is derived
 * from `StudentActivity` when asked, so changing a weight below changes every
 * student's history at once, with nothing to migrate.
 */

/**
 * Teils per skill, still used only by `session-of-day.ts` to pick a Teil
 * number to recommend. B1-shaped (known gap for A2 — Schreiben has 2 Teile
 * there, not 1 — tracked separately, not fixed here: picking a slightly
 * wrong Teil to *suggest* practising is not the "can never reach ready" bug
 * this file's own weights fix is for).
 */
export const TEILS_PER_SKILL: Record<Skill, number> = {
  HOEREN: 3,
  LESEN: 3,
  SPRACHBAUSTEINE: 2,
  SCHREIBEN: 1,
  SPRECHEN: 3,
};

export const WRITTEN_SKILLS: Skill[] = [
  'LESEN',
  'SPRACHBAUSTEINE',
  'HOEREN',
  'SCHREIBEN',
];

/**
 * telc's pass bar is 60 % at every level (A1/A2 of the combined total,
 * B1/B2 of each half) — confirmed against every seeded `exam_pass_rules`
 * row, so this one constant is safe to keep level-invariant. Used by
 * `session-of-day.ts` for training-vs-exam mode, not for a pass verdict.
 */
export const PASS_MARK = 60;

/**
 * What a level's exam is worth, read from `exam_section_weights` and
 * `exam_pass_rules` by the caller — never hardcoded here. A skill this
 * level doesn't have (e.g. A2's missing Sprachbausteine) is simply absent
 * from `skillMaxPoints`/`teilsPerSkill`, which `skillPoints`/`skillScores`
 * below treat as "not offered", not zero-attempted.
 */
export interface ProgressWeights {
  /** Sum of the skill's Teile `max_points`, for this level. */
  skillMaxPoints: Partial<Record<Skill, number>>;
  /** How many Teile this level gives the skill, for averaging. */
  teilsPerSkill: Partial<Record<Skill, number>>;
  writtenMax: number;
  oralMax: number;
  totalMax: number;
  passRule: {
    type: 'TOTAL_PERCENT' | 'PART_PERCENT';
    minimumPercent: number | null;
    writtenPercent: number | null;
    oralPercent: number | null;
  };
}

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
 * A skill this level doesn't offer (`teilsPerSkill` has no entry) is null
 * too, regardless of stray attempt rows — never a division by zero.
 */
export function skillScores(
  teils: TeilScore[],
  weights: Pick<ProgressWeights, 'teilsPerSkill'>,
): SkillScores {
  const result = {} as SkillScores;
  for (const skill of SKILLS) {
    const teilCount = weights.teilsPerSkill[skill] ?? 0;
    if (teilCount === 0) {
      result[skill] = null;
      continue;
    }
    const own = teils.filter(
      (t) => t.skill === skill && t.teil >= 1 && t.teil <= teilCount,
    );
    if (own.length === 0) {
      result[skill] = null;
      continue;
    }
    const sum = own.reduce((total, t) => total + t.score, 0);
    // Not rounded: the pass mark is decided on the exact score (59.67 is not
    // 60). Round with `roundScores` only for display.
    result[skill] = sum / teilCount;
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
export function skillPoints(
  skills: SkillScores,
  skill: Skill,
  weights: ProgressWeights,
): number {
  const percent = skills[skill] ?? 0;
  return (percent / 100) * (weights.skillMaxPoints[skill] ?? 0);
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
 * Readiness mirrors the student's level: written and oral halves, each out
 * of that level's own point caps (`weights`). Skills never practised count 0
 * here (option C): a student who skips speaking is not ready.
 *
 * "Ready" follows the level's own pass rule — B1/B2 need 60 % of *each*
 * half (`PART_PERCENT`); A1/A2 need 60 % of the *combined* total
 * (`TOTAL_PERCENT`), the same distinction `exam-result.service.ts`'s
 * verdict makes. Using B1/B2's per-half rule for an A-level student would
 * make them permanently unready the moment they skip one skill, even at a
 * perfect combined score.
 *
 * Takes the exact skill scores from `skillScores`, never the rounded ones:
 * rounding first would let 59.67 pass.
 */
export function readiness(
  skills: SkillScores,
  totalAttempts: number,
  weights: ProgressWeights,
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
    pointsWritten += skillPoints(skills, skill, weights);
  }
  const pointsOral = skillPoints(skills, 'SPRECHEN', weights);
  const pointsTotal = pointsWritten + pointsOral;

  const written =
    weights.writtenMax > 0 ? (pointsWritten / weights.writtenMax) * 100 : 0;
  const oral = weights.oralMax > 0 ? (pointsOral / weights.oralMax) * 100 : 0;
  const score =
    weights.totalMax > 0 ? (pointsTotal / weights.totalMax) * 100 : 0;

  // Compared on exact points: 134.9 is not a pass.
  const ready =
    weights.passRule.type === 'PART_PERCENT'
      ? pointsWritten >=
          weights.writtenMax * ((weights.passRule.writtenPercent ?? 0) / 100) &&
        pointsOral >=
          weights.oralMax * ((weights.passRule.oralPercent ?? 0) / 100)
      : pointsTotal >=
        weights.totalMax * ((weights.passRule.minimumPercent ?? 0) / 100);

  return {
    score: Math.round(score),
    written: Math.round(written),
    oral: Math.round(oral),
    ready,
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
