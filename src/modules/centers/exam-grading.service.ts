import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CefrLevel, Skill } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import { GENERIC_MODEL_LEVELS } from '../../shared/services/generic-exam-content.service';
import type { SignedCenterIdentity } from './payment-shared';
import { HUMAN_MARKED, SERVER_GRADER } from './exam-result.service';

export interface RecordMarkInput {
  skill: Skill;
  teil: number;
  /** In telc's points for that Teil, which is what an examiner writes down. */
  points: number;
  /** What the examiner wants remembered — an oral date, a note on why. */
  note?: string;
}

export interface RecordedMark {
  skill: Skill;
  teil: number;
  points: number;
  maxPoints: number;
  gradedBy: string;
  gradedAt: Date;
  note: string | null;
}

/**
 * The marks a person gives.
 *
 * Only two: Schreiben, which a trainer reads, and Sprechen, which happened in
 * a room with an examiner and reaches Lerniqo as a number somebody types.
 * Everything else the server decided against an answer key, and letting a
 * person overwrite one would make an exam negotiable.
 */
@Injectable()
export class ExamGradingService {
  constructor(private readonly prisma: PrismaService) {}

  async recordMark(
    identity: SignedCenterIdentity,
    attemptId: string,
    input: RecordMarkInput,
  ): Promise<RecordedMark> {
    // telc marks in whole or half points (1, 0.5, 0 per M10 criterion), never
    // finer. Checked by doubling rather than a float-epsilon comparison: a
    // clean decimal like 1.5 doubles to exactly 3.
    if (input.points < 0 || !Number.isInteger(input.points * 2)) {
      throw new BadRequestException('POINTS_INVALID');
    }

    // Scoped by center inside the query rather than checked after it: a
    // manager must not be able to learn that an attempt exists from the
    // difference between 403 and 404.
    const attempt = await this.prisma.examAttempt.findFirst({
      where: { id: attemptId, session: { center_id: identity.centerId } },
      select: {
        id: true,
        submitted_at: true,
        blocks: { select: { block: true, submitted_at: true } },
        session: { select: { level: true, center_id: true } },
      },
    });
    if (!attempt) throw new NotFoundException('EXAM_ATTEMPT_NOT_FOUND');

    if (GENERIC_MODEL_LEVELS.includes(attempt.session.level)) {
      await this.requireGenericMarkable(attemptId, attempt, input);
    } else {
      this.requireStructuralMarkable(attempt, input);
    }

    return this.store(identity, attemptId, attempt.session.level, input);
  }

  /**
   * B1/B2: only Schreiben and Sprechen are a person's. Everything else the
   * server decided against an answer key, and letting a person overwrite one
   * would make an exam negotiable.
   */
  private requireStructuralMarkable(
    attempt: { blocks: { block: string; submitted_at: Date | null }[] },
    input: RecordMarkInput,
  ): void {
    if (!HUMAN_MARKED.includes(input.skill)) {
      throw new BadRequestException('SKILL_NOT_HUMAN_MARKED');
    }

    // Per block, not per attempt.
    //
    // Schreiben cannot be marked while it is still being written — that
    // would score a draft. Sprechen has no block at all: it happened in a
    // room with an examiner, and refusing it because the candidate walked
    // out before Hören would leave a mark that exists on paper with nowhere
    // to go, and a result stuck INCOMPLETE for ever.
    //
    // An earlier version gated both on the whole attempt being submitted,
    // which made an abandoned exam permanently unmarkable.
    if (input.skill === 'SCHREIBEN') {
      const block = attempt.blocks.find((row) => row.block === 'SCHREIBEN');
      if (!block?.submitted_at) {
        throw new BadRequestException('BLOCK_NOT_SUBMITTED');
      }
    }
  }

  /**
   * A1/A2: a person marks Schreiben and Sprechen, and any automatic Teil the
   * answer key could not decide — which is any Teil without a SERVER mark.
   * A SERVER mark stays the server's: an exam is not negotiable.
   *
   * Gated on the Teil's own block, which at A1/A2 is LESEN_SCHREIBEN for
   * Schreiben; Sprechen has none and is never gated, as at B1/B2.
   */
  private async requireGenericMarkable(
    attemptId: string,
    attempt: {
      blocks: { block: string; submitted_at: Date | null }[];
      session: { level: CefrLevel };
    },
    input: RecordMarkInput,
  ): Promise<void> {
    const [weight, existing] = await Promise.all([
      this.prisma.examSectionWeight.findUnique({
        where: {
          level_skill_teil: {
            level: attempt.session.level,
            skill: input.skill,
            teil: input.teil,
          },
        },
        select: { block: true },
      }),
      this.prisma.examSectionResult.findUnique({
        where: {
          attempt_id_skill_teil: {
            attempt_id: attemptId,
            skill: input.skill,
            teil: input.teil,
          },
        },
        select: { graded_by: true },
      }),
    ]);
    if (!weight) throw new NotFoundException('EXAM_SECTION_UNKNOWN');

    if (weight.block) {
      const block = attempt.blocks.find((row) => row.block === weight.block);
      if (!block?.submitted_at) {
        throw new BadRequestException('BLOCK_NOT_SUBMITTED');
      }
    }
    if (existing?.graded_by === SERVER_GRADER) {
      throw new BadRequestException('SECTION_MARKED_BY_SERVER');
    }
  }

  private async store(
    identity: SignedCenterIdentity,
    attemptId: string,
    level: CefrLevel,
    input: RecordMarkInput,
  ): Promise<RecordedMark> {
    const weight = await this.prisma.examSectionWeight.findUnique({
      where: {
        level_skill_teil: {
          level,
          skill: input.skill,
          teil: input.teil,
        },
      },
      select: { max_points: true },
    });
    if (!weight) throw new NotFoundException('EXAM_SECTION_UNKNOWN');
    if (input.points > weight.max_points) {
      throw new BadRequestException({
        message: 'POINTS_ABOVE_MAXIMUM',
        maximumPoints: weight.max_points,
      });
    }

    const gradedAt = new Date();
    const note = input.note?.trim() || null;

    // Upserted, because a second opinion or a correction after a complaint
    // replaces the mark rather than adding one. Who gave it moves with it:
    // the row is the current mark, and the current mark has a current author.
    const row = await this.prisma.examSectionResult.upsert({
      where: {
        attempt_id_skill_teil: {
          attempt_id: attemptId,
          skill: input.skill,
          teil: input.teil,
        },
      },
      create: {
        attempt_id: attemptId,
        skill: input.skill,
        teil: input.teil,
        points: input.points,
        graded_by: identity.centerUserId,
        graded_at: gradedAt,
        note,
      },
      update: {
        points: input.points,
        graded_by: identity.centerUserId,
        graded_at: gradedAt,
        note,
      },
    });

    return {
      skill: input.skill,
      teil: input.teil,
      points: row.points,
      maxPoints: weight.max_points,
      gradedBy: row.graded_by,
      gradedAt: row.graded_at,
      note: row.note ?? null,
    };
  }
}
