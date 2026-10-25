import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { CefrLevel } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  GENERIC_MODEL_LEVELS,
  GenericExamContentService,
  type GenericSectionContent,
} from '../../shared/services/generic-exam-content.service';
import { withoutAnswerKey } from '../centers/exam-content';
import { trainingFeedbackForSection } from '../centers/generic-section-scoring';
import type { ExerciseAttemptDto } from '../writing/dto/exercise-attempt.dto';
import type { ExerciseTypeDto } from '../writing/dto/exercise-type.dto';
import type { ListeningExerciseDto } from './dto/listening-exercise.dto';
import type { SubmitListeningDto } from './dto/submit-listening.dto';
import type { SubmitListeningResponseDto } from './dto/submit-listening-response.dto';
import { correctionMapFromQuestions } from './listening-correction';
import { correctionMapFromGenericItems } from '../../shared/training-correction';
import { recordActivity } from '../student-activity/student-activity.writer';
import { submitOnce } from '../student-activity/submit-once';
import { historyFields, teilStats } from '../student-activity/student-history';

const TEIL_IDS = ['1', '2', '3'];

@Injectable()
export class ListeningService {
  private readonly logger = new Logger(ListeningService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly genericContent: GenericExamContentService,
  ) {}

  async getTeils(
    studentId: string,
    modelltestNumber = 1,
  ): Promise<ExerciseTypeDto[]> {
    const modelltest = await this.getModelltest(modelltestNumber);
    if (GENERIC_MODEL_LEVELS.includes(modelltest.level)) {
      const bySkill = await this.genericContent.sectionsFor(modelltest.id);
      const sections = bySkill.HOEREN;
      const progress = await this.getProgressByExercise(
        studentId,
        modelltest.id,
      );
      const stats = await teilStats(
        this.prisma,
        studentId,
        'HOEREN',
        sections.map((s) => s.teil),
        modelltest.id,
      );
      return sections.map((s) => ({
        ...stats[s.teil],
        id: String(s.teil),
        title: s.label,
        subtitle: '',
        prompt: s.instruction,
        imagePath: this.imagePathOf(s.material),
        part: s.teil,
        durationMinutes: undefined,
        progress: progress[String(s.teil)] ?? 0,
      }));
    }
    const [exercises, progress] = await Promise.all([
      this.prisma.listeningExercise.findMany({
        where: { modelltest_id: modelltest.id },
        orderBy: { part: 'asc' },
        select: {
          part: true,
          title: true,
          subtitle: true,
          instruction: true,
          image_url: true,
          duration_minutes: true,
        },
      }),
      this.getProgressByExercise(studentId, modelltest.id),
    ]);
    const stats = await teilStats(
      this.prisma,
      studentId,
      'HOEREN',
      exercises.map((exercise) => exercise.part),
      modelltest.id,
    );
    return exercises.map((exercise) => ({
      ...stats[exercise.part],
      id: String(exercise.part),
      title: exercise.title,
      subtitle: exercise.subtitle ?? '',
      prompt: exercise.instruction,
      imagePath: exercise.image_url,
      part: exercise.part,
      durationMinutes: exercise.duration_minutes,
      progress: progress[String(exercise.part)] ?? 0,
    }));
  }

  async getSessions(
    studentId: string,
    teilNumber?: number,
    limit = 50,
  ): Promise<ExerciseAttemptDto[]> {
    try {
      const exerciseId =
        teilNumber !== undefined && TEIL_IDS.includes(String(teilNumber))
          ? String(teilNumber)
          : undefined;
      const rows = await this.prisma.listeningAttempt.findMany({
        where: {
          // Training only. An exam attempt lives in this same table and
          // must not be read back as practice: it would show a candidate
          // scores their center has not released, and count an exam as
          // preparation for itself.
          exam_attempt_id: null,
          student_id: studentId,
          erasure_id: null,
          ...(exerciseId ? { exercise_id: exerciseId } : {}),
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        select: {
          attempt_id: true,
          exercise_id: true,
          modelltest_id: true,
          created_at: true,
          completed_at: true,
          score: true,
          feedback: true,
          duration_seconds: true,
        },
      });
      return rows.map((row) => ({
        ...historyFields('HOEREN', {
          attemptId: row.attempt_id,
          teil: Number(row.exercise_id),
          score: row.score,
          completedAt: row.completed_at ?? row.created_at,
          durationSeconds: row.duration_seconds,
          modelltestId: row.modelltest_id,
        }),
        ...this.mapRowToAttemptDto(row),
      }));
    } catch (err) {
      this.logger.error(`Error in getSessions: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Training Teil payload — same shape as exam (`getExamTeil`).
   *
   * No durable audio URL: a URL in the payload is a recording the student can
   * replay without anyone counting it. Bytes come from
   * `POST /api/listening/audio/{id}/play` after a play is spent.
   */
  async getExercise(
    type: string,
    modelltestNumber = 1,
  ): Promise<ListeningExerciseDto> {
    const part = this.parsePart(type);
    const modelltest = await this.getModelltest(modelltestNumber);
    if (GENERIC_MODEL_LEVELS.includes(modelltest.level)) {
      return this.loadGenericTeilPayload(modelltest.id, part);
    }
    return this.loadTeilPayload(modelltestNumber, part);
  }

  /**
   * One Teil as an exam serves it: the questions, the picture, and the id to
   * ask for a play — never an address. B1/B2 tables only — A1/A2 Exam Day
   * reads the generic model in `ExamBlockContentService`.
   */
  async getExamTeil(
    modelltestNumber: number,
    part: number,
  ): Promise<ListeningExerciseDto> {
    return this.loadTeilPayload(modelltestNumber, part);
  }

  private async loadGenericTeilPayload(
    modelltestId: string,
    part: number,
  ): Promise<ListeningExerciseDto> {
    const section = await this.genericContent.sectionFor(
      modelltestId,
      'HOEREN',
      part,
    );
    if (!section) this.throwExerciseNotFound();
    return this.toGenericTrainingDto(section);
  }

  private toGenericTrainingDto(
    section: GenericSectionContent,
  ): ListeningExerciseDto {
    // Keys stay off GET (same habit as B1 Hören); submit returns outcomes/review.
    return {
      audioId: section.id,
      playsAllowed: 1,
      contentRevision: section.contentRevision,
      imagePath: this.imagePathOf(section.material),
      questions: section.items.map((item) => ({
        id: String(item.itemNumber),
        prompt: item.prompt ?? '',
      })),
      aufgabentyp: section.aufgabentyp,
      sectionId: section.sectionId,
      // Same deny-list as Exam Day — strips transcript / solution / isCorrect
      // that import parks under material.media and items.
      material: withoutAnswerKey(section.material),
      items: section.items.map((item) => ({
        itemNumber: item.itemNumber,
        prompt: item.prompt,
        imageUrl: item.imageUrl ?? null,
        options: item.options.map(({ key, content, imageUrl }) => ({
          key,
          content,
          imageUrl: imageUrl ?? null,
        })),
      })),
    };
  }

  private imagePathOf(material: unknown): string {
    const url = (material as { imageUrl?: unknown } | null)?.imageUrl;
    return typeof url === 'string' ? url : '';
  }

  private async loadTeilPayload(
    modelltestNumber: number,
    part: number,
  ): Promise<ListeningExerciseDto> {
    const exercise = await this.prisma.listeningExercise.findFirst({
      where: { modelltest: { number: modelltestNumber }, part },
      select: {
        id: true,
        content_revision: true,
        image_url: true,
        exam_plays_allowed: true,
        questions: {
          orderBy: { sort_order: 'asc' },
          select: { question_number: true, prompt: true },
        },
      },
    });
    if (!exercise) this.throwExerciseNotFound();

    return {
      audioId: exercise.id,
      playsAllowed: exercise.exam_plays_allowed,
      imagePath: exercise.image_url,
      contentRevision: exercise.content_revision,
      questions: exercise.questions.map((question) => ({
        id: `q${question.question_number}`,
        prompt: question.prompt,
      })),
    };
  }

  /**
   * What a Teil is marked against.
   *
   * Public because the exam scorer marks with it too. Two copies of an answer
   * key are two things that can drift, and the one that drifts is always the
   * one nobody is looking at.
   */
  async getAnswerKey(
    modelltestNumber: number,
    part: number,
  ): Promise<Record<string, string>> {
    const exercise = await this.prisma.listeningExercise.findFirst({
      where: { modelltest: { number: modelltestNumber }, part },
      select: {
        questions: {
          orderBy: { sort_order: 'asc' },
          select: { question_number: true, correct_answer: true },
        },
      },
    });
    if (!exercise) this.throwExerciseNotFound();

    return Object.fromEntries(
      exercise.questions.map((question) => [
        `q${question.question_number}`,
        question.correct_answer,
      ]),
    );
  }

  async submit(
    studentId: string,
    dto: SubmitListeningDto,
  ): Promise<SubmitListeningResponseDto> {
    const part = this.parsePart(dto.type, true);
    const modelltestNumber = dto.modelltestNumber ?? 1;
    const modelltest = await this.getModelltest(modelltestNumber);
    if (GENERIC_MODEL_LEVELS.includes(modelltest.level)) {
      return this.submitGeneric(studentId, dto, modelltest.id, part);
    }
    const exercise = await this.prisma.listeningExercise.findFirst({
      where: { modelltest: { number: modelltestNumber }, part },
      include: { questions: { orderBy: { sort_order: 'asc' } } },
    });
    if (!exercise) this.throwUnknownType();
    if (dto.content_revision !== exercise.content_revision) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'Content revision mismatch — please reload the exercise',
        messageKey: 'listeningStaleRevision',
      });
    }
    if (!dto.answers || Object.keys(dto.answers).length === 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'Answers must not be empty',
        messageKey: 'listeningEmptyAnswers',
      });
    }
    const answerKey = Object.fromEntries(
      exercise.questions.map((question) => [
        `q${question.question_number}`,
        question.correct_answer,
      ]),
    );
    this.validateAnswers(dto.answers as Record<string, string>, answerKey);
    const score = this.computeScore(
      dto.answers as Record<string, string>,
      answerKey,
    );
    const correction = correctionMapFromQuestions(exercise.questions);
    const completedAt = new Date();
    const { attemptId, earlier } = await submitOnce(
      studentId,
      dto.attemptId,
      (id) =>
        this.prisma.listeningAttempt.findUnique({
          where: { attempt_id: id },
          select: { student_id: true, score: true },
        }),
      (id) =>
        this.prisma.$transaction(async (tx) => {
          await tx.listeningAttempt.create({
            data: {
              attempt_id: id,
              student_id: studentId,
              exercise_id: dto.type,
              listening_exercise_id: exercise.id,
              status: 'completed',
              score,
              timed: dto.timed,
              content_revision: dto.content_revision,
              modelltest_id: exercise.modelltest_id,
              duration_seconds: dto.durationSeconds ?? null,
              completed_at: completedAt,
            },
          });
          await recordActivity(tx, {
            studentId,
            skill: 'HOEREN',
            teil: part,
            score,
            durationSeconds: dto.durationSeconds,
            modelltestId: exercise.modelltest_id,
            attemptId: id,
            completedAt,
          });
        }),
    );
    return {
      attemptId,
      score: earlier?.score ?? score,
      answerKey,
      ...(correction ? { correction } : {}),
    };
  }

  private async submitGeneric(
    studentId: string,
    dto: SubmitListeningDto,
    modelltestId: string,
    part: number,
  ): Promise<SubmitListeningResponseDto> {
    const section = await this.genericContent.sectionFor(
      modelltestId,
      'HOEREN',
      part,
    );
    if (!section) this.throwUnknownType();
    if (dto.content_revision !== section.contentRevision) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'Content revision mismatch — please reload the exercise',
        messageKey: 'listeningStaleRevision',
      });
    }
    if (!dto.answers || Object.keys(dto.answers).length === 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'Answers must not be empty',
        messageKey: 'listeningEmptyAnswers',
      });
    }
    const feedback = trainingFeedbackForSection(section, dto.answers);
    const score = feedback.percent;
    const correction = correctionMapFromGenericItems(section.items);
    const completedAt = new Date();
    const { attemptId, earlier } = await submitOnce(
      studentId,
      dto.attemptId,
      (id) =>
        this.prisma.listeningAttempt.findUnique({
          where: { attempt_id: id },
          select: { student_id: true, score: true },
        }),
      (id) =>
        this.prisma.$transaction(async (tx) => {
          await tx.listeningAttempt.create({
            data: {
              attempt_id: id,
              student_id: studentId,
              exercise_id: dto.type,
              listening_exercise_id: null,
              status: 'completed',
              score,
              timed: dto.timed,
              content_revision: dto.content_revision,
              modelltest_id: modelltestId,
              answers: dto.answers as object,
              duration_seconds: dto.durationSeconds ?? null,
              completed_at: completedAt,
            },
          });
          await recordActivity(tx, {
            studentId,
            skill: 'HOEREN',
            teil: part,
            score,
            durationSeconds: dto.durationSeconds,
            modelltestId,
            attemptId: id,
            completedAt,
          });
        }),
    );
    if (earlier) {
      return { attemptId, score: earlier.score ?? score };
    }
    return {
      attemptId,
      score,
      outcomes: feedback.outcomes,
      review: feedback.review,
      ...(correction ? { correction } : {}),
    };
  }

  private async getModelltest(
    number: number,
  ): Promise<{ id: string; level: CefrLevel }> {
    const modelltest = await this.prisma.modelltest.findUnique({
      where: { number },
      select: { id: true, level: true },
    });
    if (!modelltest)
      throw new NotFoundException(`Modelltest ${number} not found`);
    return modelltest;
  }

  private parsePart(type: string, submission = false): number {
    if (!TEIL_IDS.includes(type)) {
      if (submission) this.throwUnknownType();
      this.throwExerciseNotFound();
    }
    return Number(type);
  }

  private throwExerciseNotFound(): never {
    throw new NotFoundException({
      statusCode: 404,
      error: 'Not Found',
      message: 'Exercise type not found',
      messageKey: 'listeningExerciseNotFound',
    });
  }

  private throwUnknownType(): never {
    throw new UnprocessableEntityException({
      statusCode: 422,
      error: 'Unprocessable Entity',
      message: 'Unknown exercise type',
      messageKey: 'listeningUnknownType',
    });
  }

  private validateAnswers(
    answers: Record<string, string>,
    answerKey: Record<string, string>,
  ): void {
    if (Object.keys(answers).some((id) => !(id in answerKey)))
      throw new UnprocessableEntityException('Unknown listening question');
    if (
      Object.values(answers).some((answer) => answer !== '+' && answer !== '-')
    )
      throw new UnprocessableEntityException(
        'Listening answers must be + or -',
      );
  }

  private computeScore(
    answers: Record<string, string>,
    answerKey: Record<string, string>,
  ): number {
    const total = Object.keys(answerKey).length;
    if (total === 0) return 0;
    const correct = Object.entries(answerKey).filter(
      ([id, answer]) => answers[id] === answer,
    ).length;
    return Math.round((correct / total) * 100);
  }

  private async getProgressByExercise(
    studentId: string,
    modelltestId: string,
  ): Promise<Record<string, number>> {
    const result: Record<string, number> = Object.fromEntries(
      TEIL_IDS.map((id) => [id, 0]),
    );
    try {
      const rows = await this.prisma.listeningAttempt.findMany({
        where: {
          // Training only. An exam attempt lives in this same table and
          // must not be read back as practice: it would show a candidate
          // scores their center has not released, and count an exam as
          // preparation for itself.
          exam_attempt_id: null,
          student_id: studentId,
          status: 'completed',
          modelltest_id: modelltestId,
          erasure_id: null,
        },
        select: { exercise_id: true },
      });
      for (const row of rows)
        if (TEIL_IDS.includes(row.exercise_id)) result[row.exercise_id] = 100;
    } catch {
      /* Progress failure must not hide exam content. */
    }
    return result;
  }

  private mapRowToAttemptDto(row: {
    attempt_id: string;
    created_at?: Date | string | null;
    completed_at?: Date | string | null;
    score?: number | null;
    feedback?: string | null;
    duration_seconds?: number | null;
  }): ExerciseAttemptDto {
    const toIso = (date: Date | string | null | undefined) =>
      date ? (date instanceof Date ? date.toISOString() : date) : '';
    const date = toIso(row.completed_at) || toIso(row.created_at);
    return {
      id: row.attempt_id,
      date: date || undefined,
      dateLabel: date ? this.formatDateLabel(date) : undefined,
      score: row.score ?? undefined,
      feedback: row.feedback ?? undefined,
      durationSeconds: row.duration_seconds ?? undefined,
    };
  }

  private formatDateLabel(isoDate: string): string {
    const date = new Date(isoDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateOnly = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    if (dateOnly.getTime() === today.getTime()) return 'Heute';
    if (dateOnly.getTime() === yesterday.getTime()) return 'Gestern';
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
