import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CefrLevel, Prisma } from '@prisma/client';
import type { CenterAccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  GENERIC_MODEL_LEVELS,
  GenericExamContentService,
} from '../../shared/services/generic-exam-content.service';
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
 * A B1/B2 Modelltest is only exam-ready when every block the sitting can
 * open has content in its own 18 tables. A1/A2 completeness is a different
 * check (`GenericExamContentService.isComplete`, against
 * `exam_section_weights`) — B1 and B2 never read the generic model, so this
 * stays the fixed 12-relation check it always was.
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
    private readonly genericContent: GenericExamContentService,
    private readonly lesen: LesenService,
    private readonly sprachbausteine: SprachbausteineService,
    private readonly listening: ListeningService,
    private readonly writing: WritingService,
    private readonly speaking: SpeakingService,
  ) {}

  async list(identity: SignedCenterIdentity): Promise<ExamModelltestDto[]> {
    await this.requireExamSlots(identity);

    const [structural, generic] = await Promise.all([
      this.prisma.modelltest.findMany({
        where: {
          level: { notIn: [...GENERIC_MODEL_LEVELS] },
          ...COMPLETE_EXAM_MODELLTEST_WHERE,
        },
        select: { number: true, title: true, level: true },
      }),
      this.completeGenericModelltests(),
    ]);

    return [...structural, ...generic].sort((a, b) => a.number - b.number);
  }

  /** The A1/A2 half of `list()` — one completeness check per candidate row,
   *  since it reads a different table per row than the B1/B2 WHERE clause
   *  does. Bounded: there are a handful of A1/A2 Modelltests, not hundreds. */
  private async completeGenericModelltests(): Promise<ExamModelltestDto[]> {
    const rows = await this.prisma.modelltest.findMany({
      where: { level: { in: [...GENERIC_MODEL_LEVELS] } },
      select: { id: true, number: true, title: true, level: true },
    });

    const complete: ExamModelltestDto[] = [];
    for (const row of rows) {
      if (await this.genericContent.isComplete(row.level, row.id)) {
        complete.push({
          number: row.number,
          title: row.title,
          level: row.level,
        });
      }
    }
    return complete;
  }

  /**
   * Full exercise content for one complete Modelltest, for a manager preview.
   *
   * Resolved from the `modelltests` table by number (same completeness rules
   * as the catalogue, per track). Answer keys are stripped; B1/B2's Hören
   * also carries `audioUrl` so the dashboard can play audio without an exam
   * attempt — the generic model has no audio-serving path yet (A1/A2 Hören
   * playback is not built; see docs/plans/active/multi-level-phase-3-generic-model.md).
   */
  async getContent(
    identity: SignedCenterIdentity,
    number: number,
  ): Promise<ExamModelltestContentDto> {
    await this.requireExamSlots(identity);

    const stub = await this.prisma.modelltest.findFirst({
      where: { number },
      select: { id: true, level: true },
    });
    if (!stub) {
      throw new NotFoundException('MODELLTEST_NOT_FOUND');
    }

    return GENERIC_MODEL_LEVELS.includes(stub.level)
      ? this.genericContentDto(stub.id, stub.level, number)
      : this.structuralContentDto(number);
  }

  private async genericContentDto(
    modelltestId: string,
    level: CefrLevel,
    number: number,
  ): Promise<ExamModelltestContentDto> {
    const complete = await this.genericContent.isComplete(level, modelltestId);
    if (!complete) {
      throw new NotFoundException('MODELLTEST_NOT_FOUND');
    }

    const modelltest = await this.prisma.modelltest.findUniqueOrThrow({
      where: { id: modelltestId },
      select: { number: true, title: true },
    });
    const bySkill = await this.genericContent.sectionsFor(modelltestId);

    return {
      number,
      title: modelltest.title,
      sections: withoutAnswerKey({
        LESEN: bySkill.LESEN,
        SPRACHBAUSTEINE: bySkill.SPRACHBAUSTEINE,
        HOEREN: bySkill.HOEREN,
        SCHREIBEN: bySkill.SCHREIBEN,
        SPRECHEN: bySkill.SPRECHEN,
      }),
    };
  }

  private async structuralContentDto(
    number: number,
  ): Promise<ExamModelltestContentDto> {
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
