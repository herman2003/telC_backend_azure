import type { Skill } from '@prisma/client';
import { SKILL_ID, type SkillId } from '../student-activity/student-history';
import {
  PASS_MARK,
  SKILLS,
  TEILS_PER_SKILL,
  skillScores,
  type TeilScore,
} from './progress-formula';

/** Home-screen "Session of the day" (D7): one exercise in the weakest spot. */
export type SessionMode = 'exam' | 'training';

export interface SessionOfDay {
  moduleId: SkillId;
  teil: number;
  durationMinutes: number;
  mode: SessionMode;
  /** Hörverstehen only; null for other modules. */
  maxListens: number | null;
  weaknessPercent: number;
}

export interface SessionOfDayInput {
  studentId: string;
  now: Date;
}

/**
 * Typical Teil lengths for a short daily session (not full Modelltest timing).
 * Tuned for the home CTA, not official exam clocks.
 */
const DURATION_MINUTES: Record<Skill, Record<number, number>> = {
  HOEREN: { 1: 10, 2: 10, 3: 10 },
  LESEN: { 1: 15, 2: 15, 3: 15 },
  SPRACHBAUSTEINE: { 1: 15, 2: 15 },
  SCHREIBEN: { 1: 25 },
  SPRECHEN: { 1: 10, 2: 10, 3: 10 },
};

/**
 * Pick today's practice target from Teil scores already used for D38.
 * Deterministic for the same student + calendar day + activity snapshot.
 */
export function sessionOfDay(
  teils: TeilScore[],
  input: SessionOfDayInput,
): SessionOfDay {
  // Known gap: still B1-shaped (TEILS_PER_SKILL), unlike progress.service.ts's
  // own call which reads the student's level. Picking a slightly wrong Teil
  // to *suggest* for an A2 student is not the readiness-blocking bug fixed
  // elsewhere in this file's module.
  const scores = skillScores(teils, { teilsPerSkill: TEILS_PER_SKILL });
  const practised = SKILLS.filter((skill) => scores[skill] !== null);

  const skill =
    practised.length === 0
      ? pickBySeed(SKILLS, seed(input.studentId, input.now, 'skill'))
      : practised.reduce((weakest, candidate) =>
          (scores[candidate] as number) < (scores[weakest] as number)
            ? candidate
            : weakest,
        );

  const teil = pickWeakestTeil(skill, teils, input);
  // Mode on the exact Teil score (same spirit as readiness: 59.6 is not 60).
  const exactWeakness = teilScoreOrZero(skill, teil, teils);
  const weaknessPercent = Math.round(exactWeakness);
  const mode: SessionMode = exactWeakness < PASS_MARK ? 'training' : 'exam';
  const maxListens = skill === 'HOEREN' ? (mode === 'exam' ? 2 : 3) : null;

  return {
    moduleId: SKILL_ID[skill],
    teil,
    durationMinutes: DURATION_MINUTES[skill][teil] ?? 10,
    mode,
    maxListens,
    weaknessPercent,
  };
}

function pickWeakestTeil(
  skill: Skill,
  teils: TeilScore[],
  input: SessionOfDayInput,
): number {
  const maxTeil = TEILS_PER_SKILL[skill];
  const candidates = Array.from({ length: maxTeil }, (_, i) => i + 1);
  let lowest = Infinity;
  for (const teil of candidates) {
    lowest = Math.min(lowest, teilScoreOrZero(skill, teil, teils));
  }
  const tied = candidates.filter(
    (teil) => teilScoreOrZero(skill, teil, teils) === lowest,
  );
  return pickBySeed(tied, seed(input.studentId, input.now, `teil-${skill}`));
}

function teilScoreOrZero(
  skill: Skill,
  teil: number,
  teils: TeilScore[],
): number {
  return teils.find((t) => t.skill === skill && t.teil === teil)?.score ?? 0;
}

/** UTC calendar day key so the home CTA does not flip mid-day for one user. */
function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function seed(studentId: string, now: Date, salt: string): number {
  const raw = `${studentId}|${dayKey(now)}|${salt}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickBySeed<T>(items: readonly T[], seedValue: number): T {
  return items[seedValue % items.length];
}
