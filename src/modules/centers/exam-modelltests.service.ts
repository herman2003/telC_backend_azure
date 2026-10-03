import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CenterAccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { PrismaService } from '../../shared/services/prisma.service';
import type { ExamModelltestDto } from './dto/exam-modelltests.dto';

type SignedCenterIdentity = Pick<CenterAccessTokenPayload, 'centerId'>;

/** Modelltests a center may select for a paid exam sitting. */
@Injectable()
export class ExamModelltestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(identity: SignedCenterIdentity): Promise<ExamModelltestDto[]> {
    const center = await this.prisma.center.findUnique({
      where: { id: identity.centerId },
      select: {
        exam_slots_remaining: true,
        exam_ai_slots_remaining: true,
      },
    });

    // A payment intent is not access. Only the verified-payment path credits
    // these balances, and publishing spends them again.
    if (
      !center ||
      (center.exam_slots_remaining < 1 && center.exam_ai_slots_remaining < 1)
    ) {
      throw new ForbiddenException('EXAM_SLOTS_REQUIRED');
    }

    return this.prisma.modelltest.findMany({
      // Existence alone does not make an exam usable. Every block the sitting
      // can open must have content before the Modelltest appears in the picker.
      where: {
        AND: [
          { lesenTeil1Exercises: { some: {} } },
          { lesenTeil2Exercises: { some: {} } },
          { lesenTeil3Exercises: { some: {} } },
          { sprachbausteineExercises: { some: {} } },
          { sprachbausteineTeil2Exercises: { some: {} } },
          { writingExercises: { some: {} } },
          { listeningExercises: { some: { part: 1 } } },
          { listeningExercises: { some: { part: 2 } } },
          { listeningExercises: { some: { part: 3 } } },
          { speakingExercises: { some: { part: 1 } } },
          { speakingExercises: { some: { part: 2 } } },
          { speakingExercises: { some: { part: 3 } } },
        ],
      },
      orderBy: { number: 'asc' },
      select: { number: true, title: true },
    });
  }
}
