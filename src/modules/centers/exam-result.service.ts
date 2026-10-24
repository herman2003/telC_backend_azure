import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CefrLevel, PassRuleType, Skill } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  GENERIC_MODEL_LEVELS,
  GenericExamContentService,
} from '../../shared/services/generic-exam-content.service';
import { markGenericSection, pointsOf } from './generic-section-scoring';

/**
 * `writing_attempts.exercise_id` is text, so it can hold values a uuid column
 * would have refused. See `writingTaskLabels`.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The two a human marks at B1/B2. Everything else the server decides. */
export const HUMAN_MARKED: readonly Skill[] = ['SCHREIBEN', 'SPRECHEN'];

/**
 * `exam_section_results.graded_by` for a mark the server froze at submit
 * (A1/A2 automatic Teile). Every other value there is a center user's id.
 */
export const SERVER_GRADER = 'SERVER';

/** The letter in an A1/A2 Lesen-und-Schreiben block: whichever Schreiben
 *  Teil holds a `text` (the form holds field answers instead). */
function letterFromBlock(answers: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(answers)) {
    if (!key.startsWith('SCHREIBEN_')) continue;
    const text = (value as { text?: unknown } | null)?.text;
    if (typeof text === 'string' && text.length > 0) return text;
  }
  return null;
}

/** An A1/A2 Teil the key could not decide, as the examiner needs to see it. */
export interface ExamReviewItem {
  skill: Skill;
  teil: number;
  maxPoints: number;
  /** What the recognised answers alone are worth. The examiner decides. */
  provisionalPoints: number;
  unrecognised: { itemNumber: number; answer: string }[];
}

export type ExamOutcome = 'PASSED' | 'FAILED' | 'INCOMPLETE';

interface PassRule {
  type: PassRuleType;
  minimum_percent: number | null;
  written_percent: number | null;
  oral_percent: number | null;
}

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

/**
 * What the machine thought, for the person who marks.
 *
 * Never a mark and never counted. It sits beside an empty field so a trainer
 * has somewhere to start, and the examiner still types their own number.
 */
export interface ExamSuggestion {
  skill: Skill;
  source: 'AI';
  /** Converted into telc's points for the Teil, so it reads like a mark
   *  would — which is the only way it is useful to compare against one. */
  points: number | null;
  maxPoints: number;
  /** What the model said about it. */
  notes: string | null;
  corrections: unknown;
  /** What the candidate actually said, for Sprechen. */
  transcript: string | null;
}

/**
 * The candidate's Schreiben letter, for the person who marks it.
 *
 * Present on both MANUAL (1,000 XAF) and AI (1,500 XAF) sittings. Never a
 * mark and never part of the student release snapshot — the trainer reads it
 * beside an empty points field.
 */
export interface ExamSchreibenSubmission {
  /** Which Schreiben task the letter answers; null when it is not recorded. */
  task?: string | null;
  text: string | null;
  submittedAt: Date | null;
  characterCount: number;
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
  /** Empty unless the center bought the AI tier. */
  suggestions: ExamSuggestion[];
  /**
   * Null only when the attempt has no SCHREIBEN block yet. Otherwise always
   * present, with `text: null` until the candidate has submitted content.
   */
  schreibenSubmission: ExamSchreibenSubmission | null;
  /** A1/A2 Teile waiting for an examiner because the key did not recognise
   *  an answer. Only on a center's single-candidate view; empty otherwise. */
  review: ExamReviewItem[];
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
  private readonly logger = new Logger(ExamResultService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly genericContent: GenericExamContentService,
  ) {}

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
        session: {
          select: { level: true, center_id: true, modelltest_id: true },
        },
      },
    });
    if (!attempt) throw new NotFoundException('EXAM_ATTEMPT_NOT_FOUND');

    const { level } = attempt.session;
    const weights = await this.weightsFor(level);
    const passRule = await this.passRuleFor(level);
    const marks = (await this.marksForMany([attemptId], level)).get(attemptId);
    const submissions = await this.schreibenSubmissionsFor([attemptId], level);
    const result = this.assemble(
      attempt,
      weights,
      marks ?? new Map(),
      passRule,
      level,
    );

    return {
      ...result,
      // The candidate's own answers, but provisional: for the examiner only.
      review: centerId
        ? await this.reviewFor(
            attemptId,
            attempt.session.modelltest_id,
            level,
            result.sections,
          )
        : [],
      suggestions: await this.suggestionsFor(attemptId, weights),
      schreibenSubmission: submissions.get(attemptId) ?? null,
    };
  }

  /**
   * A1/A2 automatic Teile still without a mark because the key did not
   * recognise an answer: the answers the examiner must judge, and what the
   * recognised ones alone are worth. Read from the submitted blocks, for
   * display only — the mark itself is whatever the examiner then gives.
   */
  private async reviewFor(
    attemptId: string,
    modelltestId: string,
    level: CefrLevel,
    sections: ExamSectionResultView[],
  ): Promise<ExamReviewItem[]> {
    if (!GENERIC_MODEL_LEVELS.includes(level)) return [];
    const open = sections.filter((section) => section.points === null);
    if (open.length === 0) return [];

    const [bySkill, blocks] = await Promise.all([
      this.genericContent.sectionsFor(modelltestId),
      this.prisma.examAttemptBlock.findMany({
        where: { attempt_id: attemptId, submitted_at: { not: null } },
        select: { answers: true },
      }),
    ]);
    const answers: Record<string, Record<string, unknown>> = {};
    for (const block of blocks) {
      Object.assign(
        answers,
        (block.answers ?? {}) as Record<string, Record<string, unknown>>,
      );
    }

    const review: ExamReviewItem[] = [];
    for (const section of open) {
      const content = bySkill[section.skill]?.find(
        (candidate) => candidate.teil === section.teil,
      );
      if (!content || content.scoringMode !== 'AUTO') continue;
      const mark = markGenericSection(
        content,
        answers[`${section.skill}_${section.teil}`] ?? {},
      );
      if (mark.unrecognised.length === 0) continue;
      review.push({
        skill: section.skill,
        teil: section.teil,
        maxPoints: section.maxPoints,
        provisionalPoints: pointsOf(mark, section.maxPoints),
        unrecognised: mark.unrecognised,
      });
    }
    return review;
  }

  /**
   * What the model offered, on a sitting that paid for it.
   *
   * Read from where the evaluations already wrote them rather than copied
   * into a table of their own: the AI's Schreiben score lives on the writing
   * attempt and its Sprechen transcript on the speaking attempt, and two
   * records of one opinion is one record too many.
   *
   * A percentage is turned into the Teil's points so a trainer can compare it
   * with the mark they are about to give. It is still a suggestion.
   */
  private async suggestionsFor(
    attemptId: string,
    weights: { skill: Skill; teil: number; max_points: number }[],
  ): Promise<ExamSuggestion[]> {
    const [writing, speaking] = await Promise.all([
      this.prisma.writingAttempt.findMany({
        where: { exam_attempt_id: attemptId },
        select: {
          score: true,
          feedback: true,
          corrections: true,
        },
      }),
      this.prisma.speakingAttempt.findMany({
        where: { exam_attempt_id: attemptId },
        select: {
          teil_number: true,
          transcript: true,
          score: true,
          evaluation: true,
        },
      }),
    ]);

    const pointsFor = (skill: Skill, percent: number | null) => {
      const weight = weights.find((w) => w.skill === skill);
      if (!weight || percent === null) return null;
      return Math.round((percent / 100) * weight.max_points);
    };
    const maxFor = (skill: Skill) =>
      weights.find((w) => w.skill === skill)?.max_points ?? 0;

    const suggestions: ExamSuggestion[] = [];

    for (const row of writing) {
      // A row with no score is a Schreiben stored but not yet looked at by
      // the model — nothing to suggest.
      if (row.score === null) continue;
      suggestions.push({
        skill: 'SCHREIBEN',
        source: 'AI',
        points: pointsFor('SCHREIBEN', row.score),
        maxPoints: maxFor('SCHREIBEN'),
        notes: row.feedback,
        corrections: row.corrections,
        transcript: null,
      });
    }

    for (const row of speaking) {
      suggestions.push({
        skill: 'SPRECHEN',
        source: 'AI',
        points: pointsFor('SPRECHEN', row.score),
        maxPoints: maxFor('SPRECHEN'),
        notes: null,
        corrections: row.evaluation,
        // The reason the tier exists: the examiner reads what was said
        // before deciding what the oral in the room was worth.
        transcript: row.transcript,
      });
    }

    return suggestions;
  }

  /** One attempt's result from parts already loaded. The single view and the
   *  batched one go through here, so they cannot disagree. */
  private assemble(
    attempt: {
      id: string;
      student_id: string;
      submitted_at: Date | null;
      released_at: Date | null;
    },
    weights: {
      skill: Skill;
      teil: number;
      max_points: number;
      part: string;
    }[],
    marks: Map<string, MarkedValue>,
    passRule: PassRule,
    level: CefrLevel,
  ): Omit<ExamResultView, 'suggestions' | 'schreibenSubmission' | 'review'> {
    const sections = this.sectionsOf(weights, marks);
    const written = this.half(
      weights,
      sections,
      'WRITTEN',
      passRule.written_percent ?? passRule.minimum_percent ?? 0,
    );
    const oral = this.half(
      weights,
      sections,
      'ORAL',
      passRule.oral_percent ?? passRule.minimum_percent ?? 0,
    );
    const awaiting = this.awaitingOf(sections, level);

    return {
      attemptId: attempt.id,
      studentId: attempt.student_id,
      submittedAt: attempt.submitted_at,
      releasedAt: attempt.released_at,
      sections,
      written,
      oral,
      outcome: this.outcomeOf(awaiting, written, oral, passRule),
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

  /**
   * B1/B2: only the two a person gives can be missing — an automatic Teil
   * the candidate never reached was marked zero when the block was submitted.
   * A1/A2: any Teil without a mark, since an automatic Teil the key could not
   * decide waits for the examiner too.
   */
  private awaitingOf(
    sections: ExamSectionResultView[],
    level: CefrLevel,
  ): Skill[] {
    if (GENERIC_MODEL_LEVELS.includes(level)) {
      return [
        ...new Set(
          sections.filter((s) => s.points === null).map((s) => s.skill),
        ),
      ];
    }
    return HUMAN_MARKED.filter((skill) =>
      sections.some(
        (section) => section.skill === skill && section.points === null,
      ),
    );
  }

  /**
   * A verdict with a mark missing would fail every candidate the moment they
   * put their pen down, since Sprechen happens days later.
   *
   * PART_PERCENT (B1/B2) requires both halves to clear their own bar.
   * TOTAL_PERCENT (A1/A2) has no separate written/oral bar — telc marks the
   * combined total against one threshold, so a candidate strong on paper and
   * weak orally still passes, which the PART_PERCENT rule would wrongly fail.
   */
  private outcomeOf(
    awaiting: Skill[],
    written: ExamHalfView,
    oral: ExamHalfView,
    passRule: PassRule,
  ): ExamOutcome {
    if (awaiting.length > 0) return 'INCOMPLETE';

    if (passRule.type === 'PART_PERCENT') {
      return written.passed && oral.passed ? 'PASSED' : 'FAILED';
    }

    const points = written.points + oral.points;
    const maxPoints = written.maxPoints + oral.maxPoints;
    const passed =
      maxPoints > 0 &&
      points >= maxPoints * ((passRule.minimum_percent ?? 0) / 100);
    return passed ? 'PASSED' : 'FAILED';
  }

  /**
   * Full results for several attempts at once.
   *
   * Six queries whatever the number, not six each. Releasing a sitting of
   * four hundred used to call `forAttempt` per candidate — the very N+1 the
   * table was batched to avoid, reintroduced one file away from the fix.
   *
   * The attempts must already be known to belong to the caller's center:
   * this takes ids, not a permission.
   */
  async forAttempts(attemptIds: string[]): Promise<ExamResultView[]> {
    if (attemptIds.length === 0) return [];

    const attempts = await this.prisma.examAttempt.findMany({
      where: { id: { in: attemptIds } },
      select: {
        id: true,
        student_id: true,
        submitted_at: true,
        released_at: true,
        session: { select: { level: true } },
      },
    });
    if (attempts.length === 0) return [];

    // Every attempt in one sitting shares a level, and a caller batching
    // across levels is not a thing this has to be fast at.
    const weights = await this.weightsFor(attempts[0].session.level);
    const passRule = await this.passRuleFor(attempts[0].session.level);
    const marks = await this.marksForMany(
      attempts.map((a) => a.id),
      attempts[0].session.level,
    );

    // No suggestions here: a table of forty candidates has no room for
    // forty transcripts, and the manager opens one candidate to read one.
    // Schreiben text is batched for export / release paths that need it;
    // the session results table never surfaces these views.
    const submissions = await this.schreibenSubmissionsFor(
      attempts.map((a) => a.id),
      attempts[0].session.level,
    );

    return attempts.map((attempt) => ({
      ...this.assemble(
        attempt,
        weights,
        marks.get(attempt.id) ?? new Map(),
        passRule,
        attempt.session.level,
      ),
      suggestions: [],
      review: [],
      schreibenSubmission: submissions.get(attempt.id) ?? null,
    }));
  }

  /**
   * Letter text the trainer must read before typing a Schreiben mark.
   *
   * Prefer `writing_attempts.content` (what scoring stored on submit). Fall
   * back to the timed block's `answers.text` when the writing row is missing
   * — the block is what the candidate actually submitted against the clock.
   */
  private async schreibenSubmissionsFor(
    attemptIds: string[],
    level: CefrLevel,
  ): Promise<Map<string, ExamSchreibenSubmission | null>> {
    // A1/A2 write in the shared Lesen-und-Schreiben block, and only the
    // letter (the Teil a person marks) leaves a writing row; the form's
    // answers stay on the block.
    const generic = GENERIC_MODEL_LEVELS.includes(level);
    const byAttempt = new Map<string, ExamSchreibenSubmission | null>();
    for (const id of attemptIds) byAttempt.set(id, null);
    if (attemptIds.length === 0) return byAttempt;

    const [writing, blocks] = await Promise.all([
      this.prisma.writingAttempt.findMany({
        where: { exam_attempt_id: { in: attemptIds } },
        select: {
          exam_attempt_id: true,
          content: true,
          // The prompt the letter answers. Stored as the task's own id since
          // the exam began recording which of a choice was taken.
          exercise_id: true,
        },
      }),
      this.prisma.examAttemptBlock.findMany({
        where: {
          attempt_id: { in: attemptIds },
          block: generic ? 'LESEN_SCHREIBEN' : 'SCHREIBEN',
        },
        select: {
          attempt_id: true,
          submitted_at: true,
          answers: true,
        },
      }),
    ]);

    const contentByAttempt = new Map<string, string>();
    const exerciseByAttempt = new Map<string, string>();
    for (const row of writing) {
      if (!row.exam_attempt_id) continue;
      if (typeof row.content === 'string' && row.content.length > 0) {
        contentByAttempt.set(row.exam_attempt_id, row.content);
      }
      if (row.exercise_id) {
        exerciseByAttempt.set(row.exam_attempt_id, row.exercise_id);
      }
    }

    // One lookup for the whole page rather than one per candidate: a sitting
    // of thirty answers at most two distinct prompts.
    const taskLabels = await this.writingTaskLabels([
      ...new Set(exerciseByAttempt.values()),
    ]);

    for (const block of blocks) {
      const fromWriting = contentByAttempt.get(block.attempt_id);
      const answers = (block.answers ?? {}) as Record<string, unknown>;
      const fromBlock = generic
        ? letterFromBlock(answers)
        : typeof answers.text === 'string' && answers.text.length > 0
          ? answers.text
          : null;
      const text = fromWriting ?? fromBlock;

      const exerciseId = exerciseByAttempt.get(block.attempt_id);
      byAttempt.set(block.attempt_id, {
        text,
        submittedAt: block.submitted_at,
        characterCount: text?.length ?? 0,
        task: (exerciseId && taskLabels.get(exerciseId)) ?? null,
      });
    }

    return byAttempt;
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
    const passRule = await this.passRuleFor(session.level);
    const attemptIds = session.attempts.map((attempt) => attempt.id);
    const marks = await this.marksForMany(attemptIds, session.level);

    // Typed, not inferred: inference takes the shape of the first map, and a
    // no-show row — null attempt, NOT_TAKEN, no halves — does not fit it.
    const rows: ExamCandidateRow[] = session.attempts.map((attempt) => {
      const sections = this.sectionsOf(
        weights,
        marks.get(attempt.id) ?? new Map(),
      );
      const written = this.half(
        weights,
        sections,
        'WRITTEN',
        passRule.written_percent ?? passRule.minimum_percent ?? 0,
      );
      const oral = this.half(
        weights,
        sections,
        'ORAL',
        passRule.oral_percent ?? passRule.minimum_percent ?? 0,
      );
      const awaiting = this.awaitingOf(sections, session.level);

      return {
        studentId: attempt.student_id,
        attemptId: attempt.id,
        firstName: attempt.student.first_name,
        lastName: attempt.student.last_name,
        email: attempt.student.email,
        outcome: this.outcomeOf(awaiting, written, oral, passRule),
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
    /** This half's own bar, for display. Not what decides the verdict —
     *  `outcomeOf` reads the level's `exam_pass_rules` row for that, since a
     *  TOTAL_PERCENT level has no separate written/oral bar to clear. */
    thresholdPercent: number,
  ): ExamHalfView {
    const inPart = new Set(
      weights
        .filter((weight) => weight.part === part)
        .map((weight) => `${weight.skill}_${weight.teil}`),
    );
    const mine = sections.filter((section) =>
      inPart.has(`${section.skill}_${section.teil}`),
    );

    const points = mine.reduce(
      (sum, section) => sum + (section.points ?? 0),
      0,
    );
    const maxPoints = mine.reduce((sum, section) => sum + section.maxPoints, 0);

    return {
      points,
      maxPoints,
      // Shown, never decided on: 134.5 of 225 displays as 60 and is not 60.
      percent: maxPoints === 0 ? 0 : Math.round((points / maxPoints) * 100),
      passed: maxPoints > 0 && points >= maxPoints * (thresholdPercent / 100),
    };
  }

  /**
   * Readable labels for the Schreiben tasks a sitting's candidates answered.
   *
   * Ids that resolve to nothing are simply absent: sittings recorded before
   * the task was stored carry a placeholder in `exercise_id`, and that is a
   * null label rather than an error on a results page.
   *
   * Those placeholders are filtered out rather than queried. `exercise_id` is
   * a plain text column, the ids it now holds are uuids, and the pre-B2 rows
   * hold `exam-<modelltestId>` and `exam-schreiben`. Postgres rejects the
   * whole statement on the first unparseable uuid, so passing one through
   * loses every label in the batch, not just its own — a sitting with one old
   * candidate and three current ones showed no task labels at all, and the
   * `catch` below reported it as if the task were unreadable.
   */
  private async writingTaskLabels(
    exerciseIds: string[],
  ): Promise<Map<string, string>> {
    const labels = new Map<string, string>();
    const resolvable = exerciseIds.filter((id) => UUID.test(id));
    if (resolvable.length === 0) return labels;

    const rows = await this.prisma.writingExercise
      .findMany({
        where: { id: { in: resolvable } },
        select: { id: true, part: true, title: true },
      })
      .catch((error: unknown) => {
        // A results page is still useful without the label, so this degrades
        // rather than failing. Logged because an unreadable task looks exactly
        // like a sitting recorded before the task was stored, and silence
        // would make a real fault indistinguishable from old data.
        this.logger.warn(
          `Could not read Schreiben task labels: ${(error as Error).message}`,
        );
        return [] as { id: string; part: number; title: string }[];
      });

    for (const row of rows) {
      const letter = String.fromCharCode('A'.charCodeAt(0) + row.part - 1);
      labels.set(row.id, `Aufgabe ${letter} — ${row.title}`);
    }
    return labels;
  }

  private async passRuleFor(level: CefrLevel): Promise<PassRule> {
    const rule = await this.prisma.examPassRule.findUnique({
      where: { level },
      select: {
        type: true,
        minimum_percent: true,
        written_percent: true,
        oral_percent: true,
      },
    });
    if (!rule) {
      // Seeded data, same fault class as EXAM_WEIGHTS_MISSING.
      throw new NotFoundException('EXAM_PASS_RULE_MISSING');
    }
    return rule;
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
    level: CefrLevel,
  ): Promise<Map<string, Map<string, MarkedValue>>> {
    const byAttempt = new Map<string, Map<string, MarkedValue>>();
    for (const id of attemptIds) byAttempt.set(id, new Map());
    if (attemptIds.length === 0) return byAttempt;

    // One read per table for the whole sitting rather than four per
    // candidate: a school of four hundred is six queries, not sixteen
    // hundred.
    //
    // A1/A2 read only `exam_section_results`: their automatic marks were
    // frozen there at submit (SERVER), and a Teil the key could not decide
    // has no row until the examiner gives one. The per-skill attempt rows
    // still hold their answers, but are not the verdict.
    const where = { exam_attempt_id: { in: attemptIds } };
    const generic = GENERIC_MODEL_LEVELS.includes(level);
    const [lesen, sprachbausteine, hoeren, human] = await Promise.all([
      generic
        ? []
        : this.prisma.lesenAttempt.findMany({
            where,
            select: { exam_attempt_id: true, teil_id: true, score: true },
          }),
      generic
        ? []
        : this.prisma.sprachbausteineAttempt.findMany({
            where,
            select: { exam_attempt_id: true, teil_id: true, score: true },
          }),
      generic
        ? []
        : this.prisma.listeningAttempt.findMany({
            where,
            select: { exam_attempt_id: true, exercise_id: true, score: true },
          }),
      this.prisma.examSectionResult.findMany({
        where: { attempt_id: { in: attemptIds } },
        select: {
          attempt_id: true,
          skill: true,
          teil: true,
          points: true,
          graded_by: true,
        },
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
        markedBy: row.graded_by === SERVER_GRADER ? 'SERVER' : 'PERSON',
      });
    }

    return byAttempt;
  }
}
