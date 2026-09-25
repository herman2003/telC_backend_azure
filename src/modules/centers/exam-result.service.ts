import { Injectable, NotFoundException } from '@nestjs/common';
import type { CefrLevel, Skill } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';

/** telc's bar, on each half separately. */
export const PASS_RATIO = 0.6;

/** The two a human marks. Everything else the server decides. */
export const HUMAN_MARKED: readonly Skill[] = ['SCHREIBEN', 'SPRECHEN'];

export type ExamOutcome = 'PASSED' | 'FAILED' | 'INCOMPLETE';

export interface ExamSectionResultView {
  skill: Skill;
  teil: number;
  /** Null while nobody has marked it. */
  points: number | null;
  maxPoints: number;
  /** Rounded, for display only. Nothing is decided on it. */
  percent: number | null;
  markedBy: 'SERVER' | 'PERSON' | null;
}

export interface ExamHalfView {
  points: number;
  maxPoints: number;
  percent: number;
  passed: boolean;
}

export interface ExamResultView {
  attemptId: string;
  studentId: string;
  submittedAt: Date | null;
  releasedAt: Date | null;
  sections: ExamSectionResultView[];
  written: ExamHalfView;
  oral: ExamHalfView;
  outcome: ExamOutcome;
  /** The skills still waiting for a person. Empty means the verdict stands. */
  awaiting: Skill[];
}

/**
 * What a candidate scored, and whether they passed.
 *
 * telc passes the halves separately — 60% of the written block AND 60% of the
 * oral — so a candidate strong on paper and silent in the room fails. No
 * combined average can express that, which is why this is not an average.
 *
 * The automatic marks are percentages per Teil and the weights turn them into
 * telc's points: Lesen is 75 and Sprachbausteine 30, so a perfect
 * Sprachbausteine does not rescue a poor Lesen. Everything is decided on
 * points; percentages exist only to be shown.
 */
@Injectable()
export class ExamResultService {
  constructor(private readonly prisma: PrismaService) {}

  async forAttempt(attemptId: string): Promise<ExamResultView> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        student_id: true,
        submitted_at: true,
        released_at: true,
        session: { select: { level: true, center_id: true } },
      },
    });
    if (!attempt) throw new NotFoundException('EXAM_ATTEMPT_NOT_FOUND');

    const weights = await this.weightsFor(attempt.session.level);
    const marks = await this.marksFor(attemptId);

    const sections = weights.map((weight) => {
      const mark = marks.get(`${weight.skill}_${weight.teil}`);

      // The two kinds of mark arrive in different units, and this is the one
      // place that knows both. The server marks out of a hundred because
      // that is what an answer key gives; a person marks in telc's points
      // because that is what an examiner writes on the form.
      const points =
        mark === undefined
          ? null
          : mark.kind === 'POINTS'
            ? mark.value
            : Math.round((mark.value / 100) * weight.max_points);

      return {
        skill: weight.skill,
        teil: weight.teil,
        points,
        maxPoints: weight.max_points,
        percent:
          points === null
            ? null
            : Math.round((points / weight.max_points) * 100),
        markedBy: mark?.markedBy ?? null,
      } satisfies ExamSectionResultView;
    });

    const written = this.half(weights, sections, 'WRITTEN');
    const oral = this.half(weights, sections, 'ORAL');

    // Only the two a person gives can be missing. An automatic Teil the
    // candidate never reached was marked zero when the block was submitted.
    const awaiting = HUMAN_MARKED.filter((skill) =>
      sections.some(
        (section) => section.skill === skill && section.points === null,
      ),
    );

    return {
      attemptId: attempt.id,
      studentId: attempt.student_id,
      submittedAt: attempt.submitted_at,
      releasedAt: attempt.released_at,
      sections,
      written,
      oral,
      // A verdict with a mark missing would fail every candidate the moment
      // they put their pen down, since Sprechen happens days later.
      outcome:
        awaiting.length > 0
          ? 'INCOMPLETE'
          : written.passed && oral.passed
            ? 'PASSED'
            : 'FAILED',
      awaiting,
    };
  }

  private half(
    weights: { skill: Skill; teil: number; max_points: number; part: string }[],
    sections: ExamSectionResultView[],
    part: 'WRITTEN' | 'ORAL',
  ): ExamHalfView {
    const inPart = new Set(
      weights
        .filter((weight) => weight.part === part)
        .map((weight) => `${weight.skill}_${weight.teil}`),
    );
    const mine = sections.filter((section) =>
      inPart.has(`${section.skill}_${section.teil}`),
    );

    const points = mine.reduce((sum, section) => sum + (section.points ?? 0), 0);
    const maxPoints = mine.reduce((sum, section) => sum + section.maxPoints, 0);

    return {
      points,
      maxPoints,
      // Shown, never decided on: 134.5 of 225 displays as 60 and is not 60.
      percent: maxPoints === 0 ? 0 : Math.round((points / maxPoints) * 100),
      passed: maxPoints > 0 && points >= maxPoints * PASS_RATIO,
    };
  }

  private async weightsFor(level: CefrLevel) {
    const weights = await this.prisma.examSectionWeight.findMany({
      where: { level },
      orderBy: [{ skill: 'asc' }, { teil: 'asc' }],
      select: { skill: true, teil: true, max_points: true, part: true },
    });
    if (weights.length === 0) {
      // Seeded data, so this is a deployment fault — but a candidate must not
      // be told they scored zero because a row is missing.
      throw new NotFoundException('EXAM_WEIGHTS_MISSING');
    }
    return weights;
  }

  /**
   * Every mark for this attempt, automatic and human alike.
   *
   * The automatic ones are read from the per-skill attempt rows where the
   * marking wrote them, and converted to points here. Copying them into a
   * results table would be two records of one fact, and the one nobody looks
   * at is the one that drifts.
   */
  private async marksFor(attemptId: string): Promise<
    Map<
      string,
      {
        /** PERCENT from an answer key, POINTS from an examiner's form. */
        kind: 'PERCENT' | 'POINTS';
        value: number;
        markedBy: 'SERVER' | 'PERSON';
      }
    >
  > {
    const where = { exam_attempt_id: attemptId };
    const [lesen, sprachbausteine, hoeren, human] = await Promise.all([
      this.prisma.lesenAttempt.findMany({
        where,
        select: { teil_id: true, score: true },
      }),
      this.prisma.sprachbausteineAttempt.findMany({
        where,
        select: { teil_id: true, score: true },
      }),
      this.prisma.listeningAttempt.findMany({
        where,
        select: { exercise_id: true, score: true },
      }),
      this.prisma.examSectionResult.findMany({
        where: { attempt_id: attemptId },
        select: { skill: true, teil: true, points: true },
      }),
    ]);

    const marks = new Map<
      string,
      {
        kind: 'PERCENT' | 'POINTS';
        value: number;
        markedBy: 'SERVER' | 'PERSON';
      }
    >();

    // The automatic rows hold percentages out of a hundred.
    const auto: [Skill, { teil: string; score: number | null }[]][] = [
      ['LESEN', lesen.map((r) => ({ teil: r.teil_id, score: r.score }))],
      [
        'SPRACHBAUSTEINE',
        sprachbausteine.map((r) => ({ teil: r.teil_id, score: r.score })),
      ],
      ['HOEREN', hoeren.map((r) => ({ teil: r.exercise_id, score: r.score }))],
    ];
    for (const [skill, rows] of auto) {
      for (const row of rows) {
        const teil = Number(row.teil);
        if (!Number.isInteger(teil)) continue;
        marks.set(`${skill}_${teil}`, {
          kind: 'PERCENT',
          value: row.score ?? 0,
          markedBy: 'SERVER',
        });
      }
    }

    // A person's mark wins over anything automatic for the same Teil: it is
    // the later judgement, and the one somebody signed.
    for (const row of human) {
      marks.set(`${row.skill}_${row.teil}`, {
        kind: 'POINTS',
        value: row.points,
        markedBy: 'PERSON',
      });
    }

    return marks;
  }
}
