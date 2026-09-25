import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CefrLevel, ExamBlock } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import { ExamSessionPolicyService } from './exam-session-policy.service';

export type BlockState = 'NOT_STARTED' | 'RUNNING' | 'EXPIRED' | 'SUBMITTED';

export interface ExamBlockView {
  block: ExamBlock;
  position: number;
  minutes: number;
  state: BlockState;
  startedAt: Date | null;
  deadlineAt: Date | null;
  /** Zero once the deadline has passed. Never negative: a client rendering a
   *  countdown should show 00:00, not minus four minutes. */
  remainingSeconds: number;
}

export interface ExamAttemptView {
  id: string;
  sessionId: string;
  startedAt: Date;
  submittedAt: Date | null;
  /**
   * The server's clock at the moment of answering.
   *
   * The client renders `deadlineAt - serverNow` rather than
   * `deadlineAt - Date.now()`, so a device whose clock is wrong still shows
   * the right countdown.
   */
  serverNow: Date;
  blocks: ExamBlockView[];
}

export interface StartedBlock {
  block: ExamBlock;
  startedAt: Date;
  deadlineAt: Date;
  serverNow: Date;
  remainingSeconds: number;
}

/** What the sitting service reads of an attempt. */
const ATTEMPT_SELECT = {
  id: true,
  session_id: true,
  student_id: true,
  started_at: true,
  submitted_at: true,
  session: {
    select: {
      id: true,
      level: true,
      modelltest_id: true,
      grading_tier: true,
      opens_at: true,
      closes_at: true,
      published_at: true,
      cancelled_at: true,
      force_closed_at: true,
    },
  },
  blocks: {
    select: {
      block: true,
      started_at: true,
      deadline_at: true,
      submitted_at: true,
      answers: true,
    },
  },
} as const;

/**
 * A candidate sitting an exam.
 *
 * Every limit here is enforced by the server. The app hides what a candidate
 * may not do, and this refuses it — because an app can be edited and this
 * cannot.
 */
@Injectable()
export class ExamSittingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: ExamSessionPolicyService,
  ) {}

  /**
   * Begins the exam, or returns the attempt already begun.
   *
   * The window governs starting: a candidate admitted to a sitting that has
   * not opened, or has closed, is refused. Once begun, closing time does not
   * stop them finishing — see `startBlock`.
   */
  async start(studentId: string, sessionId: string): Promise<ExamAttemptView> {
    const existing = await this.prisma.examAttempt.findUnique({
      where: { session_id_student_id: { session_id: sessionId, student_id: studentId } },
      select: ATTEMPT_SELECT,
    });
    // Before the window gate, deliberately: a candidate who began at 08:59
    // must be able to reload at 09:01 and find their exam, not be told it is
    // closed. Cancellation is the exception — see below.
    if (existing) {
      this.requireNotCancelled(existing.session);
      return this.viewOf(existing);
    }

    const admitted = await this.prisma.examSessionParticipant.findUnique({
      where: {
        session_id_student_id: { session_id: sessionId, student_id: studentId },
      },
      select: { id: true },
    });
    if (!admitted) throw new NotFoundException('NOT_A_PARTICIPANT');

    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        level: true,
        modelltest_id: true,
        opens_at: true,
        closes_at: true,
        published_at: true,
        cancelled_at: true,
        force_closed_at: true,
      },
    });
    if (!session) throw new NotFoundException('EXAM_SESSION_NOT_FOUND');
    if (!this.policy.mayStart(session)) {
      throw new BadRequestException('EXAM_NOT_OPEN');
    }

    try {
      const created = await this.prisma.examAttempt.create({
        data: { session_id: sessionId, student_id: studentId },
        select: ATTEMPT_SELECT,
      });
      return this.viewOf(created);
    } catch {
      // The unique index is the concurrency control: two taps of "start"
      // race to insert, and the loser reads the row that won.
      const won = await this.prisma.examAttempt.findUnique({
        where: {
          session_id_student_id: { session_id: sessionId, student_id: studentId },
        },
        select: ATTEMPT_SELECT,
      });
      if (!won) throw new ConflictException('EXAM_START_FAILED');
      return this.viewOf(won);
    }
  }

  /**
   * The sittings this student was admitted to.
   *
   * Only those: an exam nobody admitted them to should not appear at all,
   * not appear and refuse. Each carries its derived status so the app can say
   * "opens on 5 October" rather than showing a button that fails.
   */
  async mySessions(studentId: string): Promise<
    {
      sessionId: string;
      name: string;
      level: CefrLevel;
      status: string;
      opensAt: Date;
      closesAt: Date;
      attemptId: string | null;
      submittedAt: Date | null;
    }[]
  > {
    const admitted = await this.prisma.examSessionParticipant.findMany({
      where: { student_id: studentId },
      orderBy: { session: { opens_at: 'desc' } },
      select: {
        session: {
          select: {
            id: true,
            name: true,
            level: true,
            opens_at: true,
            closes_at: true,
            published_at: true,
            cancelled_at: true,
            force_closed_at: true,
            attempts: {
              where: { student_id: studentId },
              select: { id: true, submitted_at: true },
            },
          },
        },
      },
    });

    return admitted.map(({ session }) => ({
      sessionId: session.id,
      name: session.name,
      level: session.level,
      status: this.policy.statusOf(session),
      opensAt: session.opens_at,
      closesAt: session.closes_at,
      attemptId: session.attempts[0]?.id ?? null,
      submittedAt: session.attempts[0]?.submitted_at ?? null,
    }));
  }

  /**
   * What the scorer needs to mark this attempt: which Modelltest it is.
   *
   * Read through the attempt rather than taken from the request, so a
   * candidate cannot ask to be marked against a different paper.
   */
  async attemptContextFor(
    studentId: string,
    attemptId: string,
  ): Promise<{
    modelltestId: string;
    modelltestNumber: number;
    gradingTier: 'MANUAL' | 'AI';
  }> {
    const attempt = await this.load(studentId, attemptId);
    const modelltest = await this.prisma.modelltest.findUniqueOrThrow({
      where: { id: attempt.session.modelltest_id },
      select: { number: true },
    });

    return {
      modelltestId: attempt.session.modelltest_id,
      modelltestNumber: modelltest.number,
      // Read from the sitting, never from the request: what the center paid
      // for is not something a client gets to say.
      gradingTier: attempt.session.grading_tier,
    };
  }

  async getAttempt(
    studentId: string,
    attemptId: string,
  ): Promise<ExamAttemptView> {
    return this.viewOf(await this.load(studentId, attemptId));
  }

  /**
   * Starts one timed block, or resumes it.
   *
   * Resuming is the same call: a refresh looks exactly like a second start,
   * and issuing a fresh deadline would hand back the time already spent.
   *
   * The sitting's closing time is NOT checked here. It governs beginning an
   * exam, not finishing one: a candidate who started at 08:59 and reaches
   * Schreiben at 09:01 is sitting an exam they were entitled to sit.
   */
  async startBlock(
    studentId: string,
    attemptId: string,
    block: ExamBlock,
  ): Promise<StartedBlock> {
    const attempt = await this.load(studentId, attemptId);
    this.requireNotCancelled(attempt.session);
    const schedule = await this.scheduleFor(attempt.session.level);

    const planned = schedule.find((row) => row.block === block);
    if (!planned) throw new BadRequestException('BLOCK_NOT_IN_EXAM');

    const already = attempt.blocks.find((row) => row.block === block);
    if (already?.submitted_at) {
      throw new BadRequestException('BLOCK_ALREADY_SUBMITTED');
    }
    if (already) {
      // Resuming. The deadline is whatever it was.
      return this.startedView(block, already.started_at, already.deadline_at);
    }

    const running = attempt.blocks.find((row) => !row.submitted_at);
    if (running) throw new BadRequestException('BLOCK_IN_PROGRESS');

    // Everything before it must be done. telc runs the blocks in order, and
    // Hören before Lesen is a different exam.
    const done = new Set(
      attempt.blocks.filter((row) => row.submitted_at).map((row) => row.block),
    );
    const unfinishedEarlier = schedule.filter(
      (row) => row.position < planned.position && !done.has(row.block),
    );
    if (unfinishedEarlier.length > 0) {
      throw new BadRequestException('BLOCK_OUT_OF_ORDER');
    }

    const startedAt = new Date();
    const deadlineAt = new Date(
      startedAt.getTime() + planned.minutes * 60 * 1000,
    );
    await this.prisma.examAttemptBlock.create({
      data: {
        attempt_id: attemptId,
        block,
        started_at: startedAt,
        deadline_at: deadlineAt,
      },
    });

    return this.startedView(block, startedAt, deadlineAt);
  }

  /**
   * Saves what the candidate has answered so far.
   *
   * Called as they go, so a crash costs seconds rather than ninety minutes.
   * The whole answer set each time rather than a delta: a client that has to
   * merge is a client that can lose an answer, and the payload is small.
   *
   * Refused once the deadline has passed. What was saved before it still
   * counts — see `submitBlock`.
   */
  async saveAnswers(
    studentId: string,
    attemptId: string,
    block: ExamBlock,
    answers: Record<string, unknown>,
  ): Promise<{ savedAt: Date; answerCount: number }> {
    const attempt = await this.load(studentId, attemptId);
    this.requireNotCancelled(attempt.session);
    const row = attempt.blocks.find((b) => b.block === block);

    if (!row) throw new BadRequestException('BLOCK_NOT_STARTED');
    if (row.submitted_at) {
      throw new BadRequestException('BLOCK_ALREADY_SUBMITTED');
    }

    const savedAt = new Date();
    if (savedAt >= row.deadline_at) {
      throw new BadRequestException('BLOCK_EXPIRED');
    }

    // Conditional on the deadline in the statement as well, so an autosave
    // in flight when the clock runs out cannot land after it.
    const saved = await this.prisma.examAttemptBlock.updateMany({
      where: {
        attempt_id: attemptId,
        block,
        submitted_at: null,
        deadline_at: { gt: savedAt },
      },
      data: { answers: answers as never },
    });
    if (saved.count !== 1) throw new BadRequestException('BLOCK_EXPIRED');

    return { savedAt, answerCount: Object.keys(answers).length };
  }

  /**
   * Closes a block and returns what will be scored.
   *
   * A late submit is accepted, not refused: the app auto-submits at 00:00 and
   * that request can arrive a moment later, and refusing would leave the
   * block open and unscored for ever. What is refused is the LATE ANSWERS —
   * the block is closed on whatever was saved before the deadline.
   */
  async submitBlock(
    studentId: string,
    attemptId: string,
    block: ExamBlock,
    answers?: Record<string, unknown>,
  ): Promise<{
    block: ExamBlock;
    submittedAt: Date;
    late: boolean;
    answers: Record<string, unknown>;
  }> {
    const attempt = await this.load(studentId, attemptId);
    this.requireNotCancelled(attempt.session);
    const row = attempt.blocks.find((b) => b.block === block);

    if (!row) throw new BadRequestException('BLOCK_NOT_STARTED');
    if (row.submitted_at) {
      throw new BadRequestException('BLOCK_ALREADY_SUBMITTED');
    }

    const submittedAt = new Date();
    const late = submittedAt >= row.deadline_at;
    const finalAnswers = late
      ? ((row.answers ?? {}) as Record<string, unknown>)
      : (answers ?? ((row.answers ?? {}) as Record<string, unknown>));

    const closed = await this.prisma.examAttemptBlock.updateMany({
      where: { attempt_id: attemptId, block, submitted_at: null },
      data: { answers: finalAnswers as never, submitted_at: submittedAt },
    });
    // Lost the race with another submit of the same block. The first one is
    // the submission; this one changed nothing.
    if (closed.count !== 1) {
      throw new BadRequestException('BLOCK_ALREADY_SUBMITTED');
    }

    await this.closeAttemptIfFinished(attemptId, attempt.session.level);

    return { block, submittedAt, late, answers: finalAnswers };
  }

  /**
   * Marks the attempt finished once its last block is in.
   *
   * Derived from the blocks rather than counted by the client, so an app that
   * stops early leaves an attempt that is visibly unfinished rather than one
   * that claims to be done.
   */
  private async closeAttemptIfFinished(
    attemptId: string,
    level: CefrLevel,
  ): Promise<void> {
    const schedule = await this.scheduleFor(level);
    const submitted = await this.prisma.examAttemptBlock.count({
      where: { attempt_id: attemptId, submitted_at: { not: null } },
    });

    if (submitted >= schedule.length) {
      await this.prisma.examAttempt.updateMany({
        where: { id: attemptId, submitted_at: null },
        data: { submitted_at: new Date() },
      });
    }
  }

  /** The blocks of a level, in the order telc sits them. */
  private async scheduleFor(level: CefrLevel) {
    const schedule = await this.prisma.examBlockDuration.findMany({
      where: { level },
      orderBy: { position: 'asc' },
      select: { block: true, minutes: true, position: true },
    });
    if (schedule.length === 0) {
      // Seeded data, so this is a deployment fault rather than a request
      // fault — but a candidate should not be told "0 minutes".
      throw new NotFoundException('EXAM_TIMINGS_MISSING');
    }
    return schedule;
  }

  /**
   * One attempt of the signed-in student, or 404.
   *
   * Scoped by student in the check rather than trusting the id: 404 and not
   * 403, because a 403 would confirm the attempt exists.
   */
  private async load(studentId: string, attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: ATTEMPT_SELECT,
    });
    if (!attempt || attempt.student_id !== studentId) {
      throw new NotFoundException('EXAM_ATTEMPT_NOT_FOUND');
    }
    return attempt;
  }

  /**
   * A cancelled sitting stops everyone, including the people already inside
   * it.
   *
   * The closing time deliberately does not stop a candidate finishing what
   * they began. Cancellation is different: the center called the exam off,
   * and an exam that carries on being taken after that is not cancelled.
   *
   * Reading it stays allowed — `getAttempt` does not call this — so the app
   * can show what happened rather than leave the screen blank.
   */
  private requireNotCancelled(session: { cancelled_at: Date | null }): void {
    if (session.cancelled_at) {
      throw new BadRequestException('EXAM_CANCELLED');
    }
  }

  private startedView(
    block: ExamBlock,
    startedAt: Date,
    deadlineAt: Date,
  ): StartedBlock {
    const serverNow = new Date();
    return {
      block,
      startedAt,
      deadlineAt,
      serverNow,
      remainingSeconds: remainingSecondsAt(deadlineAt, serverNow),
    };
  }

  private async viewOf(attempt: {
    id: string;
    session_id: string;
    started_at: Date;
    submitted_at: Date | null;
    session: { level: CefrLevel };
    blocks: {
      block: ExamBlock;
      started_at: Date;
      deadline_at: Date;
      submitted_at: Date | null;
    }[];
  }): Promise<ExamAttemptView> {
    const serverNow = new Date();
    const schedule = await this.scheduleFor(attempt.session.level);

    return {
      id: attempt.id,
      sessionId: attempt.session_id,
      startedAt: attempt.started_at,
      submittedAt: attempt.submitted_at,
      serverNow,
      // Built from the schedule rather than from what exists, so a client
      // sees the whole exam ahead of it and not only what it has started.
      blocks: schedule.map((planned) => {
        const row = attempt.blocks.find((b) => b.block === planned.block);
        return {
          block: planned.block,
          position: planned.position,
          minutes: planned.minutes,
          state: stateOf(row, serverNow),
          startedAt: row?.started_at ?? null,
          deadlineAt: row?.deadline_at ?? null,
          remainingSeconds: row
            ? remainingSecondsAt(row.deadline_at, serverNow)
            : planned.minutes * 60,
        };
      }),
    };
  }
}

function stateOf(
  row:
    | { started_at: Date; deadline_at: Date; submitted_at: Date | null }
    | undefined,
  now: Date,
): BlockState {
  if (!row) return 'NOT_STARTED';
  if (row.submitted_at) return 'SUBMITTED';
  return now >= row.deadline_at ? 'EXPIRED' : 'RUNNING';
}

/** Never negative: a countdown shows 00:00, not minus four minutes. */
function remainingSecondsAt(deadlineAt: Date, now: Date): number {
  return Math.max(
    0,
    Math.round((deadlineAt.getTime() - now.getTime()) / 1000),
  );
}
