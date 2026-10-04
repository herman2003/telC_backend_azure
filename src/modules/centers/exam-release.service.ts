import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import type { SignedCenterIdentity } from './payment-shared';
import { ExamResultService, type ExamResultView } from './exam-result.service';
import { NotificationsService } from '../../shared/services/notifications.service';

export interface ReleaseSummary {
  released: number;
  /** How many went out with a mark still missing. */
  incomplete: number;
  releasedAt: Date;
}

export interface ReleaseOptions {
  /**
   * Release results a human has not finished marking.
   *
   * Off by default, and refused rather than warned about. Telling a candidate
   * "pending" before the oral is a real thing a center may want — someone
   * needing a written score for a deadline — but it is a decision, and a
   * decision the server should have seen. When that candidate later asks why
   * they were told nothing was final, "the dashboard sent it" is not an
   * answer anybody can use.
   */
  allowIncomplete?: boolean;
}

export type ReleasedResult = Omit<
  ExamResultView,
  'releasedAt' | 'suggestions' | 'schreibenSubmission'
> & {
  releasedAt: Date;
};

/**
 * Letting a candidate see their result.
 *
 * Nothing reaches a student until the center says so, and the center may say
 * so more than once: the written marks the day after the exam, the verdict
 * when the oral has been marked a week later.
 *
 * What is released is a **snapshot**, not a view. A candidate told they
 * passed must not find that changed because somebody re-marked afterwards. If
 * the center wants a correction seen, it releases again — deliberately, and
 * with a new `released_at` saying when the story changed.
 */
@Injectable()
export class ExamReleaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly results: ExamResultService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Releases every candidate in a sitting. */
  async releaseSession(
    identity: SignedCenterIdentity,
    sessionId: string,
    options: ReleaseOptions = {},
  ): Promise<ReleaseSummary> {
    const session = await this.prisma.examSession.findFirst({
      // Scoped in the query: another school's sitting is a 404, not a 403.
      where: { id: sessionId, center_id: identity.centerId },
      select: { id: true, attempts: { select: { id: true } } },
    });
    if (!session) throw new NotFoundException('EXAM_SESSION_NOT_FOUND');

    // Every result is computed before anything is written, so a sitting is
    // either released whole or not at all. Half a class told their marks and
    // half not, because the refusal came in the middle, is the worst outcome
    // here.
    //
    // Batched: one call for the sitting rather than one per candidate. The
    // attempts came from a query already scoped to this center, so passing
    // ids is not a way round the scoping.
    const results = await this.results.forAttempts(
      session.attempts.map((attempt) => attempt.id),
    );
    const incomplete = results.filter(
      (result) => result.awaiting.length > 0,
    ).length;

    if (incomplete > 0 && !options.allowIncomplete) {
      throw new BadRequestException({
        message: 'RESULTS_INCOMPLETE',
        incomplete,
        // So the dashboard's warning can name a number rather than a vague
        // "some results".
        total: results.length,
      });
    }

    // One transaction for the whole sitting. The refusal above already
    // stopped a class being released in halves for want of a mark; this stops
    // it happening for want of a connection. A write failing on the eleventh
    // of fifteen candidates would otherwise leave ten told and five not, with
    // nothing saying which.
    const releasedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const result of results) {
        await this.store(result, releasedAt, tx);
      }
      await this.tell(results, sessionId, tx);
    });

    return { released: results.length, incomplete, releasedAt };
  }

  /** Releases one candidate — the late oral, the corrected mark. */
  async releaseAttempt(
    identity: SignedCenterIdentity,
    attemptId: string,
    options: ReleaseOptions = {},
  ): Promise<ReleaseSummary> {
    const attempt = await this.prisma.examAttempt.findFirst({
      where: { id: attemptId, session: { center_id: identity.centerId } },
      select: { id: true, session_id: true },
    });
    if (!attempt) throw new NotFoundException('EXAM_ATTEMPT_NOT_FOUND');

    const result = await this.results.forAttempt(attemptId, identity.centerId);
    const incomplete = result.awaiting.length > 0 ? 1 : 0;

    if (incomplete && !options.allowIncomplete) {
      throw new BadRequestException({
        message: 'RESULTS_INCOMPLETE',
        incomplete,
        total: 1,
      });
    }

    const releasedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.store(result, releasedAt, tx);
      await this.tell([result], attempt.session_id, tx);
    });

    return { released: 1, incomplete, releasedAt };
  }

  /**
   * What the candidate may read: what was released, and nothing else.
   *
   * Deliberately does not recompute. Reading the live result here would mean
   * a candidate's verdict could change under them between two refreshes, for
   * reasons nobody told them about.
   */
  async forStudent(
    studentId: string,
    attemptId: string,
  ): Promise<ReleasedResult> {
    const attempt = await this.prisma.examAttempt.findFirst({
      where: { id: attemptId, student_id: studentId },
      select: { id: true, released_at: true, released_result: true },
    });
    // 404, never 403: a 403 would confirm somebody else's attempt exists.
    if (!attempt) throw new NotFoundException('EXAM_ATTEMPT_NOT_FOUND');

    if (!attempt.released_at || !attempt.released_result) {
      // Not a partial result and not "pending marks": as far as the candidate
      // is concerned this exam has no result until the center says it has.
      throw new BadRequestException('RESULT_NOT_RELEASED');
    }

    return {
      ...(attempt.released_result as object),
      releasedAt: attempt.released_at,
    } as ReleasedResult;
  }

  /**
   * Tells the candidates their result is ready.
   *
   * The notification carries the sitting and nothing about the verdict. It is
   * a nudge to go and look; a phone screen at a bus stop is not where
   * somebody should learn they failed, and a payload that said so would be
   * read by whoever glanced at the lock screen.
   *
   * Told again on a re-release, deliberately: a result that changed is
   * exactly the thing a candidate needs to hear about twice.
   */
  private async tell(
    results: ExamResultView[],
    sessionId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await this.notifications.notifyMany(
      results.map((result) => result.studentId),
      'EXAM_RESULT_RELEASED',
      { sessionId },
      tx,
    );
  }

  /**
   * Freezes one candidate's result as it stands.
   *
   * Without the suggestions. They exist for the person deciding a mark, and
   * the candidate is reading one that has already been decided — "the machine
   * said 32" beside a trainer's 28 is an argument, not a result. The
   * sitting-wide release batches and never carried them; this keeps the two
   * paths telling a student the same thing.
   */
  private async store(
    result: ExamResultView,
    releasedAt: Date,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    // Suggestions and the Schreiben letter are for the person marking. The
    // candidate already wrote the letter; shipping it back on the release
    // snapshot is noise, and AI suggestions beside a trainer's mark are an
    // argument, not a result.
    const released: Record<string, unknown> = { ...result };
    delete released.suggestions;
    delete released.schreibenSubmission;

    await tx.examAttempt.update({
      where: { id: result.attemptId },
      data: {
        released_at: releasedAt,
        released_result: released as Prisma.InputJsonValue,
      },
    });
  }
}
