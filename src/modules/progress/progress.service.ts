import { Injectable, NotFoundException } from '@nestjs/common';
import type { CefrLevel, Skill } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import { SKILL_ID, type SkillId } from '../student-activity/student-history';
import {
  alerts,
  PASS_MARK,
  readiness,
  RECENT_ATTEMPTS_PER_TEIL,
  roundScores,
  SKILLS,
  skillScores,
  type ProgressAlert,
  type ProgressWeights,
  type Readiness,
  type SkillScores,
  type TeilScore,
} from './progress-formula';
import { sessionOfDay, type SessionOfDay } from './session-of-day';

const WEEK_MS = 7 * 86_400_000;

/** Home « Dernières tentatives » preview size (matches Flutter demo limit). */
const RECENT_ATTEMPTS_PREVIEW = 10;

export type RelativeTimeKey =
  | 'yesterday'
  | 'twoDaysAgo'
  | 'threeDaysAgo'
  | 'thisWeek';

/** One row for GET /api/progress/me `attempts` list. */
export interface RecentAttemptItem {
  moduleId: SkillId;
  teil: number;
  score: number;
  relativeTimeKey: RelativeTimeKey;
  mode: 'exam' | 'training';
}

export type WireAlert =
  | { type: 'inactive'; lastActivityAt: string | null }
  | { type: 'low_progress'; readiness: number }
  | { type: 'weak_skill'; skill: SkillId; score: number };

/** One student's numbers, as the dashboard and the Flutter app receive them. */
export interface StudentProgress {
  /** Per skill, 0–100; null = not practised yet. */
  skills: Record<SkillId, number | null>;
  readiness: Readiness;
  attempts: number;
  lastActivityAt: string | null;
  alerts: WireAlert[];
}

export interface CenterProgressSummary {
  students: number;
  /** Mean readiness of the students who have one; null when none does. */
  averageReadiness: number | null;
  /** How many students count as ready for the exam. */
  ready: number;
  /** Mean of each skill across the students who practised it. */
  skillAverages: Record<SkillId, number | null>;
  alerts: { inactive: number; lowProgress: number; weakSkill: number };
}

interface Activity {
  teils: TeilScore[];
  attempts: number;
  lastActivityAt: Date | null;
}

/**
 * D38, computed once in the backend from `StudentActivity`. The center
 * dashboard and the Flutter app both read this; neither computes anything.
 */
@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every student's progress in one query, however many students. */
  async forStudents(
    studentIds: string[],
    now = new Date(),
  ): Promise<Map<string, StudentProgress>> {
    const [activity, levels] = await Promise.all([
      this.activityOf(studentIds, now),
      this.levelsOf(studentIds),
    ]);
    const weightsByLevel = await this.weightsByLevel(new Set(levels.values()));
    const result = new Map<string, StudentProgress>();
    for (const id of studentIds) {
      const level = levels.get(id) ?? 'B1';
      result.set(
        id,
        this.progressOf(activity.get(id), now, weightsByLevel.get(level)!),
      );
    }
    return result;
  }

  /**
   * The signed-in student's numbers, with the weekly change: readiness now
   * minus readiness on the activity up to 7 days ago (D38), plus today's
   * home-screen session (D7).
   */
  async forStudent(
    studentId: string,
    now = new Date(),
  ): Promise<
    Omit<StudentProgress, 'attempts'> & {
      attempts: RecentAttemptItem[];
      attemptsTotal: number;
      attemptsBelowThreshold: number;
      weeklyChange: number | null;
      level: CefrLevel | null;
      sessionOfDay: SessionOfDay;
    }
  > {
    const weekAgo = new Date(now.getTime() - WEEK_MS);
    const [current, before, student, recentAttempts] = await Promise.all([
      this.activityOf([studentId], now),
      this.activityOf([studentId], weekAgo),
      // A guest has no row, and no level.
      this.prisma.student.findUnique({
        where: { id: studentId },
        select: { level: true },
      }),
      this.recentAttemptsOf(studentId, now),
    ]);
    const weights = await this.weightsFor(student?.level ?? 'B1');
    const activity = current.get(studentId);
    const progress = this.progressOf(activity, now, weights);
    const earlier = this.progressOf(before.get(studentId), weekAgo, weights);
    const weeklyChange =
      progress.readiness.score !== null && earlier.readiness.score !== null
        ? progress.readiness.score - earlier.readiness.score
        : null;
    const { attempts: attemptsTotal, ...rest } = progress;
    return {
      ...rest,
      attempts: recentAttempts,
      attemptsTotal,
      attemptsBelowThreshold: recentAttempts.filter((a) => a.score < PASS_MARK)
        .length,
      weeklyChange,
      level: student?.level ?? null,
      sessionOfDay: sessionOfDay(activity?.teils ?? [], {
        studentId,
        now,
      }),
    };
  }

  /** The dashboard's headline numbers, over every student of the center. */
  async forCenter(
    centerId: string,
    now = new Date(),
  ): Promise<CenterProgressSummary> {
    const students = await this.prisma.student.findMany({
      where: { center_id: centerId },
      select: { id: true },
    });
    const all = [
      ...(
        await this.forStudents(
          students.map((s) => s.id),
          now,
        )
      ).values(),
    ];

    const mean = (values: number[]) =>
      values.length
        ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        : null;

    const skillAverages = {} as Record<SkillId, number | null>;
    for (const skill of SKILLS) {
      const id = SKILL_ID[skill];
      skillAverages[id] = mean(
        all.map((p) => p.skills[id]).filter((v): v is number => v !== null),
      );
    }
    const count = (type: WireAlert['type']) =>
      all.filter((p) => p.alerts.some((a) => a.type === type)).length;

    return {
      students: all.length,
      averageReadiness: mean(
        all
          .map((p) => p.readiness.score)
          .filter((v): v is number => v !== null),
      ),
      ready: all.filter((p) => p.readiness.ready).length,
      skillAverages,
      alerts: {
        inactive: count('inactive'),
        lowProgress: count('low_progress'),
        weakSkill: count('weak_skill'),
      },
    };
  }

  private progressOf(
    activity: Activity | undefined,
    now: Date,
    weights: ProgressWeights,
  ): StudentProgress {
    const exact: SkillScores = skillScores(activity?.teils ?? [], weights);
    // The pass decision on the exact scores; everything shown, rounded.
    const result = readiness(exact, activity?.attempts ?? 0, weights);
    const scores = roundScores(exact);
    const lastActivityAt = activity?.lastActivityAt ?? null;
    const skills = {} as Record<SkillId, number | null>;
    for (const skill of SKILLS) skills[SKILL_ID[skill]] = scores[skill];
    return {
      skills,
      readiness: result,
      attempts: activity?.attempts ?? 0,
      lastActivityAt: lastActivityAt?.toISOString() ?? null,
      alerts: alerts(scores, result, lastActivityAt, now).map(toWire),
    };
  }

  /**
   * Newest completed activities for the home list (GET /me only).
   * Score is percent 0–100; mode mirrors session-of-day (training under 60 %).
   */
  private async recentAttemptsOf(
    studentId: string,
    now: Date,
    limit = RECENT_ATTEMPTS_PREVIEW,
  ): Promise<RecentAttemptItem[]> {
    const rows = await this.prisma.studentActivity.findMany({
      where: {
        student_id: studentId,
        erasure_id: null,
        created_at: { lte: now },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        skill: true,
        teil: true,
        score: true,
        max_score: true,
        created_at: true,
      },
    });
    return rows.map((row) => {
      const percent =
        row.max_score > 0 ? Math.round((row.score * 100) / row.max_score) : 0;
      return {
        moduleId: SKILL_ID[row.skill],
        teil: row.teil,
        score: percent,
        relativeTimeKey: relativeTimeKey(row.created_at, now),
        mode: percent < PASS_MARK ? 'training' : 'exam',
      };
    });
  }

  /**
   * Per student and Teil: the mean of the last 3 attempts, the attempt count,
   * the latest activity. One grouped query for the whole list, so a page of
   * students costs the same as one.
   */
  private async activityOf(
    studentIds: string[],
    asOf: Date,
  ): Promise<Map<string, Activity>> {
    const byStudent = new Map<string, Activity>();
    if (studentIds.length === 0) return byStudent;

    const rows = await this.prisma.$queryRaw<
      {
        student_id: string;
        skill: Skill;
        teil: number;
        score: number;
        attempts: number;
        last_at: Date;
      }[]
    >`
      WITH ranked AS (
        SELECT student_id, skill, teil, created_at,
               score::float8 * 100 / max_score AS percent,
               ROW_NUMBER() OVER (
                 PARTITION BY student_id, skill, teil
                 ORDER BY created_at DESC
               ) AS recent
        FROM student_activities
        WHERE student_id = ANY(${studentIds}::text[])
          AND erasure_id IS NULL
          AND created_at <= ${asOf}
      )
      SELECT student_id,
             skill::text AS skill,
             teil,
             AVG(percent) FILTER (WHERE recent <= ${RECENT_ATTEMPTS_PER_TEIL}) AS score,
             COUNT(*)::int AS attempts,
             MAX(created_at) AS last_at
      FROM ranked
      GROUP BY student_id, skill, teil`;

    for (const row of rows) {
      const entry = byStudent.get(row.student_id) ?? {
        teils: [],
        attempts: 0,
        lastActivityAt: null,
      };
      entry.teils.push({ skill: row.skill, teil: row.teil, score: row.score });
      entry.attempts += row.attempts;
      if (!entry.lastActivityAt || row.last_at > entry.lastActivityAt) {
        entry.lastActivityAt = row.last_at;
      }
      byStudent.set(row.student_id, entry);
    }
    return byStudent;
  }

  /** A guest has no row and no level — defaults to B1, same as `forStudent`. */
  private async levelsOf(
    studentIds: string[],
  ): Promise<Map<string, CefrLevel>> {
    if (studentIds.length === 0) return new Map();
    const rows = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, level: true },
    });
    return new Map(rows.map((row) => [row.id, row.level ?? 'B1']));
  }

  private async weightsByLevel(
    levels: Set<CefrLevel>,
  ): Promise<Map<CefrLevel, ProgressWeights>> {
    const result = new Map<CefrLevel, ProgressWeights>();
    await Promise.all(
      [...levels].map(async (level) => {
        result.set(level, await this.weightsFor(level));
      }),
    );
    return result;
  }

  /**
   * What a level's exam is worth, read from `exam_section_weights` and
   * `exam_pass_rules` — never hardcoded. A level's rows summed by skill
   * reproduce exactly what the old B1 constants spelled out directly (see
   * `progress-formula.spec.ts`'s equality test against them).
   */
  private async weightsFor(level: CefrLevel): Promise<ProgressWeights> {
    const [rows, passRule] = await Promise.all([
      this.prisma.examSectionWeight.findMany({
        where: { level },
        select: { skill: true, teil: true, max_points: true, part: true },
      }),
      this.prisma.examPassRule.findUnique({
        where: { level },
        select: {
          type: true,
          minimum_percent: true,
          written_percent: true,
          oral_percent: true,
        },
      }),
    ]);
    if (rows.length === 0) {
      throw new NotFoundException('EXAM_WEIGHTS_MISSING');
    }
    if (!passRule) {
      throw new NotFoundException('EXAM_PASS_RULE_MISSING');
    }

    const skillMaxPoints: Partial<Record<Skill, number>> = {};
    const teilsPerSkill: Partial<Record<Skill, number>> = {};
    let writtenMax = 0;
    let oralMax = 0;
    for (const row of rows) {
      skillMaxPoints[row.skill] =
        (skillMaxPoints[row.skill] ?? 0) + row.max_points;
      teilsPerSkill[row.skill] = (teilsPerSkill[row.skill] ?? 0) + 1;
      if (row.part === 'WRITTEN') writtenMax += row.max_points;
      else oralMax += row.max_points;
    }

    return {
      skillMaxPoints,
      teilsPerSkill,
      writtenMax,
      oralMax,
      totalMax: writtenMax + oralMax,
      passRule: {
        type: passRule.type,
        minimumPercent: passRule.minimum_percent,
        writtenPercent: passRule.written_percent,
        oralPercent: passRule.oral_percent,
      },
    };
  }
}

function toWire(alert: ProgressAlert): WireAlert {
  switch (alert.type) {
    case 'inactive':
      return {
        type: 'inactive',
        lastActivityAt: alert.lastActivityAt?.toISOString() ?? null,
      };
    case 'low_progress':
      return alert;
    case 'weak_skill':
      return {
        type: 'weak_skill',
        skill: SKILL_ID[alert.skill],
        score: alert.score,
      };
  }
}

/** Same day buckets as Flutter `HomeService._relativeTimeKey`. */
function relativeTimeKey(at: Date, now: Date): RelativeTimeKey {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const day = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  const daysAgo = Math.round((today - day) / 86_400_000);
  if (daysAgo === 1) return 'yesterday';
  if (daysAgo === 2) return 'twoDaysAgo';
  if (daysAgo === 3) return 'threeDaysAgo';
  return 'thisWeek';
}
