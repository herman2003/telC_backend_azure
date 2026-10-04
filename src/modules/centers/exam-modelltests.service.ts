import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CenterAccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { PrismaService } from '../../shared/services/prisma.service';
import { LesenService } from '../lesen/lesen.service';
import { ListeningService } from '../listening/listening.service';
import { SpeakingService } from '../speaking/services/speaking.service';
import { SprachbausteineService } from '../sprachbausteine/sprachbausteine.service';
import { WritingService } from '../writing/writing.service';
import type {
  ExamModelltestContentDto,
  ExamModelltestDto,
} from './dto/exam-modelltests.dto';
import { withoutAnswerKey } from './exam-content';

type SignedCenterIdentity = Pick<CenterAccessTokenPayload, 'centerId'>;

/**
 * A Modelltest is only exam-ready when every block the sitting can open has
 * content. Shared by the catalogue list and the manager preview so a number
 * that appears in the picker always resolves to a real, complete row.
 */
const COMPLETE_EXAM_MODELLTEST_WHERE: Prisma.ModelltestWhereInput = {
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
};

/** Modelltests a center may select for a paid exam sitting. */
@Injectable()
export class ExamModelltestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lesen: LesenService,
    private readonly sprachbausteine: SprachbausteineService,
    private readonly listening: ListeningService,
    private readonly writing: WritingService,
    private readonly speaking: SpeakingService,
  ) {}

  async list(identity: SignedCenterIdentity): Promise<ExamModelltestDto[]> {
    await this.requireExamSlots(identity);

    return this.prisma.modelltest.findMany({
      where: COMPLETE_EXAM_MODELLTEST_WHERE,
      orderBy: { number: 'asc' },
      select: { number: true, title: true },
    });
  }

  /**
   * Full exercise content for one complete Modelltest, for a manager preview.
   *
   * Resolved from the `modelltests` table by number (same completeness rules
   * as the catalogue). Answer keys are stripped; Hören also carries `audioUrl`
   * so the dashboard can play audio without an exam attempt.
   */
  async getContent(
    identity: SignedCenterIdentity,
    number: number,
  ): Promise<ExamModelltestContentDto> {
    await this.requireExamSlots(identity);

    const modelltest = await this.prisma.modelltest.findFirst({
      where: {
        number,
        ...COMPLETE_EXAM_MODELLTEST_WHERE,
      },
      select: { id: true, number: true, title: true },
    });
    if (!modelltest) {
      throw new NotFoundException('MODELLTEST_NOT_FOUND');
    }

    const [
      lesen,
      sprachbausteine,
      hoerenTeile,
      schreiben,
      sprechen,
      audioRows,
    ] = await Promise.all([
      this.lesen.getExercise(modelltest.number),
      this.sprachbausteine.getExercise(modelltest.number),
      Promise.all(
        [1, 2, 3].map((part) =>
          this.listening.getExamTeil(modelltest.number, part),
        ),
      ),
      this.writing.getExerciseByModelltest(modelltest.number),
      this.speaking.getTeils(modelltest.number),
      this.prisma.listeningExercise.findMany({
        where: { modelltest_id: modelltest.id },
        select: { id: true, audio_url: true },
      }),
    ]);

    const audioById = new Map(
      audioRows.map((row) => [row.id, row.audio_url] as const),
    );
    const hoeren = hoerenTeile.map((teil) => ({
      ...teil,
      audioUrl: audioById.get(teil.audioId) ?? '',
    }));

    return {
      number: modelltest.number,
      title: modelltest.title,
      sections: withoutAnswerKey({
        LESEN: lesen,
        SPRACHBAUSTEINE: sprachbausteine,
        HOEREN: hoeren,
        SCHREIBEN: schreiben,
        SPRECHEN: sprechen,
      }),
    };
  }

  private async requireExamSlots(
    identity: SignedCenterIdentity,
  ): Promise<void> {
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
  }
}
