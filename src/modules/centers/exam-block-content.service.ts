import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CefrLevel, ExamBlock } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  GENERIC_MODEL_LEVELS,
  GenericExamContentService,
} from '../../shared/services/generic-exam-content.service';
import { LesenService } from '../lesen/lesen.service';
import { SprachbausteineService } from '../sprachbausteine/sprachbausteine.service';
import { ListeningService } from '../listening/listening.service';
import { WritingService } from '../writing/writing.service';
import { withoutAnswerKey } from './exam-content';

export interface ExamBlockContent {
  block: ExamBlock;
  /** Keyed by skill, each holding that skill's Teile as training serves them
   *  — minus every answer. */
  sections: Record<string, unknown>;
  /** What the candidate has already answered, so a reload restores the paper
   *  rather than blanking it. */
  savedAnswers: Record<string, unknown>;
  deadlineAt: Date;
  serverNow: Date;
  remainingSeconds: number;
}

/**
 * The paper a candidate is handed when a block starts.
 *
 * Training's questions with the answers taken out, and only for the block
 * they are actually sitting: serving the whole exam at once would let someone
 * read Schreiben's task during the ninety minutes meant for Lesen.
 */
@Injectable()
export class ExamBlockContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly genericContent: GenericExamContentService,
    private readonly lesen: LesenService,
    private readonly sprachbausteine: SprachbausteineService,
    private readonly listening: ListeningService,
    private readonly writing: WritingService,
  ) {}

  async getBlockContent(
    studentId: string,
    attemptId: string,
    block: ExamBlock,
  ): Promise<ExamBlockContent> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        student_id: true,
        session: {
          select: {
            modelltest: { select: { id: true, number: true, level: true } },
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
      },
    });

    // 404, never 403: a 403 would confirm the attempt exists.
    if (!attempt || attempt.student_id !== studentId) {
      throw new NotFoundException('EXAM_ATTEMPT_NOT_FOUND');
    }

    const row = attempt.blocks.find((b) => b.block === block);
    if (!row) throw new BadRequestException('BLOCK_NOT_STARTED');
    if (row.submitted_at) {
      throw new BadRequestException('BLOCK_ALREADY_SUBMITTED');
    }
    // A block whose time ran out is still served while it is unsubmitted:
    // the candidate should see what they were working on as the app submits
    // it, rather than watch the screen blank at 00:00.

    const {
      id: modelltestId,
      number: modelltestNumber,
      level,
    } = attempt.session.modelltest;
    const serverNow = new Date();

    return {
      block,
      sections: await this.sectionsFor(
        block,
        modelltestNumber,
        modelltestId,
        level,
      ),
      savedAnswers: (row.answers ?? {}) as Record<string, unknown>,
      deadlineAt: row.deadline_at,
      serverNow,
      remainingSeconds: Math.max(
        0,
        Math.round((row.deadline_at.getTime() - serverNow.getTime()) / 1000),
      ),
    };
  }

  /**
   * The Teile of one block, from the services that own them.
   *
   * Stripped on the way out rather than fetched differently: one source of
   * truth for what a Teil looks like, and one function for what a candidate
   * may not see.
   */
  private async sectionsFor(
    block: ExamBlock,
    modelltestNumber: number,
    modelltestId: string,
    level: CefrLevel,
  ): Promise<Record<string, unknown>> {
    if (GENERIC_MODEL_LEVELS.includes(level)) {
      return this.genericSectionsFor(block, modelltestId);
    }

    if (block === 'LESEN_SPRACHBAUSTEINE') {
      // Both at once, because telc gives them one 90-minute block with free
      // navigation between their five Teile.
      const [lesen, sprachbausteine] = await Promise.all([
        this.lesen.getExercise(modelltestNumber),
        this.sprachbausteine.getExercise(modelltestNumber),
      ]);

      return withoutAnswerKey({
        LESEN: lesen,
        SPRACHBAUSTEINE: sprachbausteine,
      });
    }

    if (block === 'HOEREN') {
      // All three Teile at once: they share one timed block, and the app
      // needs to know what is coming to pace the candidate through it.
      const teile = await Promise.all(
        [1, 2, 3].map((part) =>
          this.listening.getExamTeil(modelltestNumber, part),
        ),
      );

      // Each Teil carries the id to ask for a play and how often it may be
      // played — never an address. A URL here is a recording a candidate can
      // replay with nobody counting it.
      return withoutAnswerKey({ HOEREN: teile });
    }

    // The task itself. Serving null here ran a thirty-minute timer over an
    // empty screen — a candidate with nothing to write and no way to know
    // why. There is no answer key to strip: a human marks it.
    return withoutAnswerKey({
      SCHREIBEN: await this.writing.getExerciseByModelltest(modelltestNumber),
    });
  }

  /**
   * A1/A2's block shapes, from the generic model.
   *
   * `LESEN_SCHREIBEN` is A1/A2's single Lesen+Schreiben block (telc gives
   * B1/B2 two separate ones). Each `HOEREN` Teil names its own recording the
   * way B1/B2's do — `audioId` and `playsAllowed` — so the app plays both the
   * same way. The id is the Teil's own section id; the address stays on the
   * server (docs/domains/exam-simulator.md).
   */
  private async genericSectionsFor(
    block: ExamBlock,
    modelltestId: string,
  ): Promise<Record<string, unknown>> {
    const bySkill = await this.genericContent.sectionsFor(modelltestId);

    if (block === 'HOEREN') {
      return withoutAnswerKey({
        HOEREN: bySkill.HOEREN.map((teil) => ({
          ...teil,
          audioId: teil.id,
          playsAllowed: 1,
        })),
      });
    }

    // LESEN_SCHREIBEN is the only other block a generic-model level sits.
    return withoutAnswerKey({
      LESEN: bySkill.LESEN,
      SCHREIBEN: bySkill.SCHREIBEN,
    });
  }
}
