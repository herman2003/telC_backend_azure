import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import type {
  SessionHistoryItemDto,
  SpeakingExerciseResponseDto,
  TeilListItemDto,
} from '../dto';
import {
  historyFields,
  teilStats,
} from '../../student-activity/student-history';
import {
  GENERIC_MODEL_LEVELS,
  GenericExamContentService,
} from '../../../shared/services/generic-exam-content.service';
import type { ExaminerTopic } from '../live/examiner-prompt.service';
import { examinerTopicFromGenericSection } from './generic-sprechen-topic';

@Injectable()
export class SpeakingService {
  private readonly logger = new Logger(SpeakingService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly genericContent: GenericExamContentService,
  ) {}

  /**
   * Topic Elena should use for a live training session.
   *
   * B1/B2: `speaking_exercises` via {@link getTeils}.
   * A1/A2: generic `exam_sections` SPRECHEN mapped to the same shape.
   * Missing content → null (Elena invents a topic; never fail the mint).
   */
  async resolveExaminerTopic(
    modelltestNumber: number,
    teilNumber: number,
  ): Promise<ExaminerTopic | null> {
    try {
      const teils = await this.getTeils(modelltestNumber);
      const match = teils.find((teil) => teil.part === teilNumber);
      if (match?.topicTitle) {
        return {
          title: match.topicTitle,
          description: match.topicDescription,
          points: match.topicPoints,
        };
      }
    } catch (error) {
      this.logger.warn(
        `speaking_exercises miss for MT ${modelltestNumber} Teil ${teilNumber}: ` +
          `${(error as Error).message}. Trying generic SPRECHEN.`,
      );
    }

    const modelltest = await this.prisma.modelltest.findUnique({
      where: { number: modelltestNumber },
      select: { id: true, level: true },
    });
    if (!modelltest || !GENERIC_MODEL_LEVELS.includes(modelltest.level)) {
      return null;
    }

    const section = await this.genericContent.sectionFor(
      modelltest.id,
      'SPRECHEN',
      teilNumber,
    );
    if (!section) return null;
    return examinerTopicFromGenericSection(section);
  }

  /**
   * GET /api/speaking/exercise?modelltest= — A1/A2 generic sections (SPRECHEN).
   * B1/B2: 404 — clients use GET /api/speaking/teils.
   */
  async getExerciseByModelltest(
    modelltestNumber: number,
  ): Promise<SpeakingExerciseResponseDto> {
    const modelltest = await this.prisma.modelltest.findUnique({
      where: { number: modelltestNumber },
    });

    if (!modelltest) {
      throw this.exerciseNotFoundForModelltest();
    }

    if (!GENERIC_MODEL_LEVELS.includes(modelltest.level)) {
      throw this.exerciseNotFoundForModelltest();
    }

    const bySkill = await this.genericContent.sectionsFor(modelltest.id);
    const sections = bySkill.SPRECHEN;
    if (sections.length === 0) {
      throw this.exerciseNotFoundForModelltest();
    }
    const contentRevision =
      sections.find((s) => s.teil === 1)?.contentRevision ??
      sections[0].contentRevision;
    return {
      contentRevision,
      issuedAt: new Date().toISOString(),
      sections: sections.map((s) => ({
        id: s.id,
        sectionId: s.sectionId,
        aufgabentyp: s.aufgabentyp,
        teil: s.teil,
        label: s.label,
        instruction: s.instruction,
        maxPoints: s.maxPoints,
        contentRevision: s.contentRevision,
        material: s.material,
        items: s.items,
      })),
    };
  }

  private exerciseNotFoundForModelltest(): NotFoundException {
    return new NotFoundException({
      statusCode: 404,
      error: 'Not Found',
      message: 'Exercise not found for this Modelltest',
      messageKey: 'speakingExerciseNotFound',
    });
  }

  async getTeils(
    modelltestNumber = 1,
    studentId?: string,
  ): Promise<TeilListItemDto[]> {
    const modelltest = await this.prisma.modelltest.findUnique({
      where: { number: modelltestNumber },
      select: { id: true },
    });
    if (!modelltest)
      throw new NotFoundException(`Modelltest ${modelltestNumber} not found`);
    const exercises = await this.prisma.speakingExercise.findMany({
      where: { modelltest_id: modelltest.id },
      orderBy: { part: 'asc' },
      select: {
        part: true,
        title: true,
        subtitle: true,
        topic_title: true,
        topic_description: true,
        topic_points: true,
        instructions: true,
        duration_minutes: true,
        prep_duration_seconds: true,
        image_url: true,
        exam_image_url: true,
      },
    });
    const stats = studentId
      ? await teilStats(
          this.prisma,
          studentId,
          'SPRECHEN',
          exercises.map((exercise) => exercise.part),
          modelltest.id,
        )
      : {};
    return exercises.map((exercise) => ({
      ...stats[exercise.part],
      id: exercise.part,
      part: exercise.part,
      title: exercise.title,
      subtitle: exercise.subtitle ?? '',
      topicTitle: exercise.topic_title,
      topicDescription: exercise.topic_description,
      topicPoints: this.toTopicPoints(exercise.topic_points),
      durationMinutes: exercise.duration_minutes,
      prepDurationSeconds: exercise.prep_duration_seconds,
      imagePath: exercise.image_url,
      examImagePath: exercise.exam_image_url,
      instructions: exercise.instructions,
    }));
  }

  async getSessions(
    studentId: string,
    teilNumber?: number,
    limit = 50,
  ): Promise<SessionHistoryItemDto[]> {
    // Read from the evaluations `evaluate` keeps (phase 11). The live Gemini
    // flow's exam_sessions, the old source, stopped in March 2026 without ever
    // storing a score, and was dropped on 2026-09-19.
    try {
      const rows = await this.prisma.speakingAttempt.findMany({
        where: {
          // Training only. An AI speaking session sat inside an exam lives in
          // this same table, and a candidate must not find their exam
          // transcript in their practice history before the center has
          // released anything.
          exam_attempt_id: null,
          student_id: studentId,
          erasure_id: null,
          ...(teilNumber !== undefined && teilNumber >= 1 && teilNumber <= 3
            ? { teil_number: teilNumber }
            : {}),
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        select: {
          attempt_id: true,
          teil_number: true,
          modelltest_id: true,
          score: true,
          evaluation: true,
          duration_seconds: true,
          created_at: true,
        },
      });
      return rows.map((row) => {
        const evaluation = (row.evaluation ?? {}) as {
          strengths?: string;
          areas_for_improvement?: string;
        };
        return {
          ...historyFields('SPRECHEN', {
            attemptId: row.attempt_id,
            teil: row.teil_number,
            score: row.score,
            completedAt: row.created_at,
            durationSeconds: row.duration_seconds,
            modelltestId: row.modelltest_id,
          }),
          sessionId: row.attempt_id,
          teilNumber: row.teil_number,
          completedAt: row.created_at.toISOString(),
          overallScore: row.score,
          strengths: evaluation.strengths ?? null,
          areasForImprovement: evaluation.areas_for_improvement ?? null,
        };
      });
    } catch (err) {
      this.logger.error(`Error in getSessions: ${(err as Error).message}`);
      return [];
    }
  }

  private toTopicPoints(value: unknown): string[] {
    if (
      !Array.isArray(value) ||
      value.some((point) => typeof point !== 'string')
    ) {
      this.logger.warn('Speaking exercise has invalid topic_points JSON');
      return [];
    }
    return value.filter((point): point is string => typeof point === 'string');
  }
}
