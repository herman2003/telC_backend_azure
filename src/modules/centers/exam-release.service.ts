import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import type { SignedCenterIdentity } from './payment-shared';
import { ExamResultService, type ExamResultView } from './exam-result.service';

export interface ReleaseSummary {
  released: number;
  releasedAt: Date;
}

export type ReleasedResult = Omit<ExamResultView, 'releasedAt'> & {
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
  ) {}

  /** Releases every candidate in a sitting. */
  async releaseSession(
    identity: SignedCenterIdentity,
    sessionId: string,
  ): Promise<ReleaseSummary> {
    const session = await this.prisma.examSession.findFirst({
      // Scoped in the query: another school's sitting is a 404, not a 403.
      where: { id: sessionId, center_id: identity.centerId },
      select: { id: true, attempts: { select: { id: true } } },
    });
    if (!session) throw new NotFoundException('EXAM_SESSION_NOT_FOUND');

    const releasedAt = new Date();
    for (const attempt of session.attempts) {
      await this.snapshot(attempt.id, identity.centerId, releasedAt);
    }

    return { released: session.attempts.length, releasedAt };
  }

  /** Releases one candidate — the late oral, the corrected mark. */
  async releaseAttempt(
    identity: SignedCenterIdentity,
    attemptId: string,
  ): Promise<ReleaseSummary> {
    const attempt = await this.prisma.examAttempt.findFirst({
      where: { id: attemptId, session: { center_id: identity.centerId } },
      select: { id: true },
    });
    if (!attempt) throw new NotFoundException('EXAM_ATTEMPT_NOT_FOUND');

    const releasedAt = new Date();
    await this.snapshot(attemptId, identity.centerId, releasedAt);

    return { released: 1, releasedAt };
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
   * Freezes one candidate's result as it stands.
   *
   * An incomplete result is released if the center asks for it. Refusing
   * would make a candidate wait a week for the oral before learning anything
   * at all, and "you passed the written half" is worth telling them.
   */
  private async snapshot(
    attemptId: string,
    centerId: string,
    releasedAt: Date,
  ): Promise<void> {
    const result = await this.results.forAttempt(attemptId, centerId);

    await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        released_at: releasedAt,
        released_result: result as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
