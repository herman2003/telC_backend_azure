import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Skill } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import type { SignedCenterIdentity } from './payment-shared';
import { HUMAN_MARKED } from './exam-result.service';

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
    if (!HUMAN_MARKED.includes(input.skill)) {
      throw new BadRequestException('SKILL_NOT_HUMAN_MARKED');
    }
    if (!Number.isInteger(input.points) || input.points < 0) {
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
        session: { select: { level: true, center_id: true } },
      },
    });
    if (!attempt) throw new NotFoundException('EXAM_ATTEMPT_NOT_FOUND');
    if (!attempt.submitted_at) {
      // Marking a Schreiben still being written would score a draft.
      throw new BadRequestException('EXAM_NOT_FINISHED');
    }

    const weight = await this.prisma.examSectionWeight.findUnique({
      where: {
        level_skill_teil: {
          level: attempt.session.level,
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
