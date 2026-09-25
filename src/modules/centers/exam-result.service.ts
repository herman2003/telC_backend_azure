import { Injectable, NotFoundException } from '@nestjs/common';
import type { CefrLevel, Skill } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';

/** telc's bar, on each half separately. */
export const PASS_RATIO = 0.6;

/** The two a human marks. Everything else the server decides. */
export const HUMAN_MARKED: readonly Skill[] = ['SCHREIBEN', 'SPRECHEN'];

export type ExamOutcome = 'PASSED' | 'FAILED' | 'INCOMPLETE';

/** PERCENT comes from an answer key, POINTS from an examiner's form. */
interface MarkedValue {
  kind: 'PERCENT' | 'POINTS';
  value: number;
  markedBy: 'SERVER' | 'PERSON';
}

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

export interface ExamCandidateRow {
  studentId: string;
  attemptId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  /** NOT_TAKEN for someone admitted who never started. */
  outcome: ExamOutcome | 'NOT_TAKEN';
  written: ExamHalfView | null;
  oral: ExamHalfView | null;
  awaiting: Skill[];
  releasedAt: Date | null;
}

export interface ExamSessionResults {
  sessionId: string;
  candidates: ExamCandidateRow[];
  summary: {
    candidates: number;
    awaitingMarks: number;
    released: number;
    passed: number;
    failed: number;
  };
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

  /**
   * One candidate's result.
   *
   * `centerId` is optional only because the student's own view asks the same
   * question about themselves. When a manager asks, it is always given: of
   * everything in this feature, handing out another school's marks is the
   * worst thing that could happen.
   */
  async forAttempt(
    attemptId: string,
    centerId?: string,
  ): Promise<ExamResultView> {
    const attempt = await this.prisma.examAttempt.findFirst({
      where: {
        id: attemptId,
        ...(centerId ? { session: { center_id: centerId } } : {}),
      },
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
    const marks = (await this.marksForMany([attemptId])).get(attemptId);

    const sections = this.sectionsOf(weights, marks ?? new Map());
    const written = this.half(weights, sections, 'WRITTEN');
    const oral = this.half(weights, sections, 'ORAL');
    const awaiting = this.awaitingOf(sections);

    return {
      attemptId: attempt.id,
      studentId: attempt.student_id,
      submittedAt: attempt.submitted_at,
      releasedAt: attempt.released_at,
      sections,
      written,
      oral,
      outcome: this.outcomeOf(awaiting, written, oral),
      awaiting,
    };
  }

  /**
   * One Teil's mark, in telc's points.
   *
   * The two kinds arrive in different units and this is the only place that
   * knows both: the server marks out of a hundred, because that is what an
   * answer key gives, and a person marks in points, because that is what an
   * examiner writes on the form.
   */
  private sectionsOf(
    weights: { skill: Skill; teil: number; max_points: number; part: string }[],
    marks: Map<string, MarkedValue>,
  ): ExamSectionResultView[] {
    return weights.map((weight) => {
      const mark = marks.get(`${weight.skill}_${weight.teil}`);
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
  }

  /** Only the two a person gives can be missing. An automatic Teil the
   *  candidate never reached was marked zero when the block was submitted. */
  private awaitingOf(sections: ExamSectionResultView[]): Skill[] {
    return HUMAN_MARKED.filter((skill) =>
      sections.some(
        (section) => section.skill === skill && section.points === null,
      ),
    );
  }

  /** A verdict with a mark missing would fail every candidate the moment they
   *  put their pen down, since Sprechen happens days later. */
  private outcomeOf(
    awaiting: Skill[],
    written: ExamHalfView,
    oral: ExamHalfView,
  ): ExamOutcome {
    if (awaiting.length > 0) return 'INCOMPLETE';
    return written.passed && oral.passed ? 'PASSED' : 'FAILED';
  }

  /**
   * Every candidate in one sitting.
   *
   * Six queries whatever the size of the school, not four per candidate: a
   * sitting of four hundred would otherwise be sixteen hundred round trips to
   * draw one table. The marks come back in one read each and are grouped in
   * memory.
   */
  async forSession(
    centerId: string,
    sessionId: string,
  ): Promise<ExamSessionResults> {
    const session = await this.prisma.examSession.findFirst({
      // Scoped by center in the query: another school's sitting is a 404.
      where: { id: sessionId, center_id: centerId },
      select: {
        id: true,
        level: true,
        attempts: {
          select: {
            id: true,
            student_id: true,
            submitted_at: true,
            released_at: true,
            student: {
              select: { first_name: true, last_name: true, email: true },
            },
          },
        },
        participants: {
          select: {
            student_id: true,
            student: {
              select: { first_name: true, last_name: true, email: true },
            },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('EXAM_SESSION_NOT_FOUND');

    const weights = await this.weightsFor(session.level);
    const attemptIds = session.attempts.map((attempt) => attempt.id);
    const marks = await this.marksForMany(attemptIds);

    const rows = session.attempts.map((attempt) => {
      const sections = this.sectionsOf(
        weights,
        marks.get(attempt.id) ?? new Map(),
      );
      const written = this.half(weights, sections, 'WRITTEN');
      const oral = this.half(weights, sections, 'ORAL');
      const awaiting = this.awaitingOf(sections);

      return {
        studentId: attempt.student_id,
        attemptId: attempt.id,
        firstName: attempt.student.first_name,
        lastName: attempt.student.last_name,
        email: attempt.student.email,
        outcome: this.outcomeOf(awaiting, written, oral),
        written,
        oral,
        awaiting,
        releasedAt: attempt.released_at,
      } satisfies ExamCandidateRow;
    });

    // A no-show is a row with nothing in it, not a missing row: a manager
    // reconciling fifteen names against twelve results needs the other three.
    const sat = new Set(rows.map((row) => row.studentId));
    for (const participant of session.participants) {
      if (sat.has(participant.student_id)) continue;
      rows.push({
        studentId: participant.student_id,
        attemptId: null,
        firstName: participant.student.first_name,
        lastName: participant.student.last_name,
        email: participant.student.email,
        outcome: 'NOT_TAKEN',
        written: null,
        oral: null,
        awaiting: [],
        releasedAt: null,
      });
    }

    return {
      sessionId: session.id,
      candidates: rows,
      summary: {
        candidates: rows.length,
        awaitingMarks: rows.filter((row) => row.awaiting.length > 0).length,
        released: rows.filter((row) => row.releasedAt !== null).length,
        passed: rows.filter((row) => row.outcome === 'PASSED').length,
        failed: rows.filter((row) => row.outcome === 'FAILED').length,
      },
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
  private async marksForMany(
    attemptIds: string[],
  ): Promise<Map<string, Map<string, MarkedValue>>> {
    const byAttempt = new Map<string, Map<string, MarkedValue>>();
    for (const id of attemptIds) byAttempt.set(id, new Map());
    if (attemptIds.length === 0) return byAttempt;

    // One read per table for the whole sitting rather than four per
    // candidate: a school of four hundred is six queries, not sixteen
    // hundred.
    const where = { exam_attempt_id: { in: attemptIds } };
    const [lesen, sprachbausteine, hoeren, human] = await Promise.all([
      this.prisma.lesenAttempt.findMany({
        where,
        select: { exam_attempt_id: true, teil_id: true, score: true },
      }),
      this.prisma.sprachbausteineAttempt.findMany({
        where,
        select: { exam_attempt_id: true, teil_id: true, score: true },
      }),
      this.prisma.listeningAttempt.findMany({
        where,
        select: { exam_attempt_id: true, exercise_id: true, score: true },
      }),
      this.prisma.examSectionResult.findMany({
        where: { attempt_id: { in: attemptIds } },
        select: { attempt_id: true, skill: true, teil: true, points: true },
      }),
    ]);

    const put = (
      attemptId: string | null,
      skill: Skill,
      teil: string | number,
      mark: MarkedValue,
    ) => {
      if (!attemptId) return;
      const teilNumber = Number(teil);
      if (!Number.isInteger(teilNumber)) return;
      byAttempt.get(attemptId)?.set(`${skill}_${teilNumber}`, mark);
    };

    // The automatic rows hold percentages out of a hundred.
    for (const row of lesen) {
      put(row.exam_attempt_id, 'LESEN', row.teil_id, {
        kind: 'PERCENT',
        value: row.score ?? 0,
        markedBy: 'SERVER',
      });
    }
    for (const row of sprachbausteine) {
      put(row.exam_attempt_id, 'SPRACHBAUSTEINE', row.teil_id, {
        kind: 'PERCENT',
        value: row.score ?? 0,
        markedBy: 'SERVER',
      });
    }
    for (const row of hoeren) {
      put(row.exam_attempt_id, 'HOEREN', row.exercise_id, {
        kind: 'PERCENT',
        value: row.score ?? 0,
        markedBy: 'SERVER',
      });
    }
    // A person's mark wins over anything automatic for the same Teil: it is
    // the later judgement, and the one somebody signed.
    for (const row of human) {
      put(row.attempt_id, row.skill, row.teil, {
        kind: 'POINTS',
        value: row.points,
        markedBy: 'PERSON',
      });
    }

    return byAttempt;
  }
}
