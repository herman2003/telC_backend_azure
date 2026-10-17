import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { TrainingModelltestAccessService } from '../../shared/services/training-modelltest-access.service';
import { submitOnce } from '../student-activity/submit-once';
import { grammarDayBounds, topicOfTheDay } from './grammar-day';
import {
  exerciseStatusAtIndex,
  pickOfTheDayExercises,
  sortGrammarExercises,
} from './grammar-exercise-order';
import { grammarImageUrlForSlug } from './grammar-image-url';
import {
  DEFAULT_GRAMMAR_LANG,
  localizeExercise,
  localizeGrammarTopic,
  parseGrammarLang,
  type GrammarLang,
} from './grammar-locale';
import {
  GRAMMAR_PRACTICE_LEVELS,
  isGrammarPracticeDifficulty,
  practiceQuestionCountFor,
} from './grammar-practice-levels';
import type {
  CompleteLessonResponseDto,
  GrammarExercisesOfTheDayDto,
  GrammarOfTheDayDto,
  GrammarPracticeExercisesDto,
  GrammarPracticeLevelsDto,
  GrammarPracticeProgressDto,
  GrammarPracticeSessionDto,
  GrammarTopicDto,
  SubmitGrammarExerciseResponseDto,
  SubmitGrammarPracticeDto,
  SubmitGrammarPracticeResponseDto,
} from './dto/grammar.dto';

type GrammarAccessOpts = { isGuest?: boolean; lang?: GrammarLang };

type GrammarProgressRow = {
  id: string;
  lesson_completed: boolean;
  next_exercise_index: number;
};

@Injectable()
export class GrammarService {
  /** Guest JWTs have no `students` row — keep of-the-day progress in memory. */
  private readonly guestProgress = new Map<string, GrammarProgressRow>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly trainingAccess: TrainingModelltestAccessService,
  ) {}

  async getOfTheDay(
    studentId: string,
    now: Date = new Date(),
    opts: GrammarAccessOpts = {},
  ): Promise<GrammarOfTheDayDto> {
    const lang = parseGrammarLang(opts.lang ?? DEFAULT_GRAMMAR_LANG);
    const topic = await this.resolveTopicOfTheDay(now);
    const [progress, dayExercises, modelltestNumber] = await Promise.all([
      this.getOrInitProgress(studentId, topic.id, opts),
      this.prisma.grammarExercise.findMany({
        where: { topic_id: topic.id },
        select: { id: true, difficulty: true, sort_order: true },
      }),
      this.safeWeeklyNumber(now),
    ]);
    const exercisesTotal = pickOfTheDayExercises(dayExercises).length;

    return {
      modelltestNumber,
      day: this.dayDto(now),
      topic: this.toTopicDto(topic, lang),
      progress: {
        lessonCompleted: progress.lesson_completed,
        nextExerciseIndex: progress.next_exercise_index,
        exercisesTotal,
        exercisesCompleted: Math.min(
          progress.next_exercise_index,
          exercisesTotal,
        ),
      },
    };
  }

  async getTopicById(
    studentId: string,
    topicId: string,
    now: Date = new Date(),
    opts: GrammarAccessOpts = {},
  ): Promise<GrammarOfTheDayDto> {
    const ofTheDay = await this.getOfTheDay(studentId, now, opts);
    if (ofTheDay.topic.id !== topicId) {
      throw new NotFoundException('GRAMMAR_TOPIC_NOT_TODAY');
    }
    return ofTheDay;
  }

  async completeLesson(
    studentId: string,
    now: Date = new Date(),
    opts: GrammarAccessOpts = {},
  ): Promise<CompleteLessonResponseDto> {
    const topic = await this.resolveTopicOfTheDay(now);
    const progress = await this.getOrInitProgress(studentId, topic.id, opts);

    if (opts.isGuest === true) {
      progress.lesson_completed = true;
      this.guestProgress.set(
        this.guestProgressKey(studentId, topic.id),
        progress,
      );
      return {
        lessonCompleted: true,
        nextExerciseIndex: progress.next_exercise_index,
      };
    }

    const updated = await this.prisma.grammarTopicProgress.update({
      where: { id: progress.id },
      data: {
        lesson_completed: true,
        // Keep cursor if already further; only ensure lesson flag.
        next_exercise_index: progress.lesson_completed
          ? progress.next_exercise_index
          : progress.next_exercise_index,
      },
    });

    return {
      lessonCompleted: updated.lesson_completed,
      nextExerciseIndex: updated.next_exercise_index,
    };
  }

  async getExercisesOfTheDay(
    studentId: string,
    now: Date = new Date(),
    opts: GrammarAccessOpts = {},
  ): Promise<GrammarExercisesOfTheDayDto> {
    const lang = parseGrammarLang(opts.lang ?? DEFAULT_GRAMMAR_LANG);
    const topic = await this.resolveTopicOfTheDay(now);
    const progress = await this.getOrInitProgress(studentId, topic.id, opts);
    const raw = await this.prisma.grammarExercise.findMany({
      where: { topic_id: topic.id },
    });
    const ordered = pickOfTheDayExercises(raw);

    return {
      topicId: topic.id,
      topicSlug: topic.slug,
      day: this.dayDto(now),
      lessonCompleted: progress.lesson_completed,
      exercises: ordered.map((exo, index) => {
        const localized = localizeExercise(exo, lang);
        return {
          id: exo.id,
          index,
          difficulty: exo.difficulty,
          kind: exo.kind,
          prompt: localized.prompt,
          options: Array.isArray(exo.options_json)
            ? (exo.options_json as string[])
            : null,
          answer: exo.answer,
          explanation: localized.explanation,
          explanationFr: localized.explanation,
          status: exerciseStatusAtIndex(
            index,
            progress.lesson_completed,
            progress.next_exercise_index,
          ),
        };
      }),
    };
  }

  getLevels(): GrammarPracticeLevelsDto {
    return {
      levels: GRAMMAR_PRACTICE_LEVELS.map((level) => ({
        id: level.id,
        difficulty: level.difficulty,
        durationMinutes: level.durationMinutes,
        questionCount: level.questionCount,
      })),
    };
  }

  /**
   * Practice QCM for the current of-the-day topic only (not the full 365 pool).
   * With `difficulty`, returns a fixed slice: easy=10, medium=15, hard=20.
   */
  async getPracticeExercises(
    difficulty?: string,
    opts: GrammarAccessOpts = {},
    now: Date = new Date(),
  ): Promise<GrammarPracticeExercisesDto> {
    const lang = parseGrammarLang(opts.lang ?? DEFAULT_GRAMMAR_LANG);
    const hasDifficulty =
      difficulty !== undefined && difficulty !== null && difficulty !== '';
    if (hasDifficulty && !isGrammarPracticeDifficulty(difficulty)) {
      throw new BadRequestException('GRAMMAR_DIFFICULTY_INVALID');
    }

    const topic = await this.resolveTopicOfTheDay(now);
    const raw = await this.prisma.grammarExercise.findMany({
      where: {
        topic_id: topic.id,
        ...(hasDifficulty ? { difficulty } : {}),
      },
    });
    let ordered = sortGrammarExercises(raw);
    if (hasDifficulty && isGrammarPracticeDifficulty(difficulty)) {
      ordered = ordered.slice(0, practiceQuestionCountFor(difficulty));
    }

    return {
      exercises: ordered.map((exo) => {
        const localized = localizeExercise(exo, lang);
        return {
          id: exo.id,
          prompt: localized.prompt,
          options: Array.isArray(exo.options_json)
            ? (exo.options_json as string[])
            : null,
          answer: exo.answer,
          explanation: localized.explanation,
          explanationFr: localized.explanation,
          difficulty: exo.difficulty,
        };
      }),
    };
  }

  async submitPractice(
    studentId: string,
    dto: SubmitGrammarPracticeDto,
    opts: GrammarAccessOpts = {},
  ): Promise<SubmitGrammarPracticeResponseDto> {
    const answerEntries = Object.entries(dto.answers ?? {});
    if (answerEntries.length === 0) {
      throw new BadRequestException('GRAMMAR_PRACTICE_ANSWERS_REQUIRED');
    }
    if (dto.difficulty && !isGrammarPracticeDifficulty(dto.difficulty)) {
      throw new BadRequestException('GRAMMAR_DIFFICULTY_INVALID');
    }

    const exerciseIds = answerEntries.map(([id]) => id);
    const exercises = await this.prisma.grammarExercise.findMany({
      where: {
        id: { in: exerciseIds },
        topic: { published: true },
      },
      select: { id: true, answer: true },
    });
    const byId = new Map(exercises.map((exo) => [exo.id, exo]));
    for (const exerciseId of exerciseIds) {
      if (!byId.has(exerciseId)) {
        throw new BadRequestException('GRAMMAR_PRACTICE_UNKNOWN_EXERCISE');
      }
    }

    const answerKey: Record<string, string> = {};
    let correctCount = 0;
    for (const [exerciseId, answer] of answerEntries) {
      const exo = byId.get(exerciseId)!;
      answerKey[exerciseId] = exo.answer;
      if (this.answersMatch(answer, exo.answer)) {
        correctCount += 1;
      }
    }
    const total = answerEntries.length;
    const score = Math.round((correctCount / total) * 100);
    const completedAt = new Date();

    // Guests: score only — no students row for practice_attempt FK.
    if (opts.isGuest === true) {
      return {
        attemptId: dto.attemptId ?? `guest-practice-${Date.now()}`,
        score,
        correctCount,
        total,
        answerKey,
      };
    }

    const { attemptId, earlier } = await submitOnce(
      studentId,
      dto.attemptId,
      (id) =>
        this.prisma.grammarPracticeAttempt.findUnique({
          where: { attempt_id: id },
          select: {
            student_id: true,
            score: true,
            correct_count: true,
            total: true,
          },
        }),
      (id) =>
        this.prisma.$transaction(async (tx) => {
          await tx.grammarPracticeAttempt.create({
            data: {
              attempt_id: id,
              student_id: studentId,
              status: 'completed',
              score,
              correct_count: correctCount,
              total,
              difficulty: dto.difficulty ?? null,
              duration_seconds: dto.durationSeconds ?? null,
              answers: dto.answers,
              completed_at: completedAt,
            },
          });
        }),
    );

    if (earlier) {
      return {
        attemptId,
        score: earlier.score,
        correctCount: earlier.correct_count,
        total: earlier.total,
        answerKey,
      };
    }

    return { attemptId, score, correctCount, total, answerKey };
  }

  async getPracticeSessions(
    studentId: string,
    limit = 50,
  ): Promise<GrammarPracticeSessionDto[]> {
    const rows = await this.prisma.grammarPracticeAttempt.findMany({
      where: { student_id: studentId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
    return rows.map((row) => this.toPracticeSessionDto(row));
  }

  async getPracticeProgress(
    studentId: string,
  ): Promise<GrammarPracticeProgressDto> {
    const [aggregate, lastRows] = await Promise.all([
      this.prisma.grammarPracticeAttempt.aggregate({
        where: { student_id: studentId },
        _avg: { score: true },
        _count: { _all: true },
      }),
      this.prisma.grammarPracticeAttempt.findMany({
        where: { student_id: studentId },
        orderBy: { created_at: 'desc' },
        take: 1,
      }),
    ]);

    const attemptCount = aggregate._count._all;
    const averageScore =
      attemptCount === 0 || aggregate._avg.score == null
        ? null
        : Math.round(aggregate._avg.score);

    return {
      attemptCount,
      averageScore,
      lastAttempt:
        lastRows.length > 0 ? this.toPracticeSessionDto(lastRows[0]) : null,
    };
  }

  async submitExercise(
    studentId: string,
    exerciseId: string,
    answer: string,
    now: Date = new Date(),
    opts: GrammarAccessOpts = {},
  ): Promise<SubmitGrammarExerciseResponseDto> {
    const topic = await this.resolveTopicOfTheDay(now);
    const progress = await this.getOrInitProgress(studentId, topic.id, opts);

    if (!progress.lesson_completed) {
      throw new ConflictException({
        message: 'GRAMMAR_STEP_LOCKED',
        messageKey: 'grammarStepLocked',
        reason: 'LESSON_NOT_COMPLETED',
      });
    }

    const raw = await this.prisma.grammarExercise.findMany({
      where: { topic_id: topic.id },
    });
    const ordered = pickOfTheDayExercises(raw);
    const index = ordered.findIndex((e) => e.id === exerciseId);
    if (index < 0) {
      throw new NotFoundException('GRAMMAR_EXERCISE_NOT_FOUND');
    }

    if (index > progress.next_exercise_index) {
      throw new ConflictException({
        message: 'GRAMMAR_STEP_LOCKED',
        messageKey: 'grammarStepLocked',
        reason: 'STEP_AHEAD',
      });
    }

    const exo = ordered[index];
    const correct = this.answersMatch(answer, exo.answer);

    if (opts.isGuest !== true) {
      await this.prisma.grammarExerciseAttempt.create({
        data: {
          student_id: studentId,
          exercise_id: exo.id,
          answer,
          correct,
        },
      });
    }

    let nextExerciseIndex = progress.next_exercise_index;
    if (correct && index === progress.next_exercise_index) {
      nextExerciseIndex = index + 1;
      if (opts.isGuest === true) {
        progress.next_exercise_index = nextExerciseIndex;
        this.guestProgress.set(
          this.guestProgressKey(studentId, topic.id),
          progress,
        );
      } else {
        await this.prisma.grammarTopicProgress.update({
          where: { id: progress.id },
          data: { next_exercise_index: nextExerciseIndex },
        });
      }
    }

    const lang = parseGrammarLang(opts.lang ?? DEFAULT_GRAMMAR_LANG);
    const { explanation } = localizeExercise(exo, lang);
    return {
      correct,
      explanation,
      explanationFr: explanation,
      nextExerciseIndex,
    };
  }

  private answersMatch(submitted: string, expected: string): boolean {
    return submitted.trim().toLowerCase() === expected.trim().toLowerCase();
  }

  private toPracticeSessionDto(row: {
    attempt_id: string;
    score: number;
    correct_count: number;
    total: number;
    difficulty: string | null;
    duration_seconds: number | null;
    completed_at: Date | null;
    created_at: Date;
    status: string;
  }): GrammarPracticeSessionDto {
    const completedAt = (row.completed_at ?? row.created_at).toISOString();
    return {
      id: row.attempt_id,
      attemptId: row.attempt_id,
      score: row.score,
      maxScore: 100,
      correctCount: row.correct_count,
      total: row.total,
      difficulty: row.difficulty,
      durationSeconds: row.duration_seconds,
      status: 'completed',
      completedAt,
      date: completedAt,
    };
  }

  private dayDto(now: Date) {
    const bounds = grammarDayBounds(now);
    return {
      date: bounds.date,
      indexInEpoch: bounds.indexInEpoch,
      nextThemeAt: bounds.nextThemeAt.toISOString(),
    };
  }

  /**
   * Today's topic from the weekly Modelltest pool (not the global 365 catalogue).
   */
  private async resolveTopicOfTheDay(now: Date) {
    let weeklyNumber: number;
    try {
      weeklyNumber = await this.trainingAccess.weeklyModelltestNumber(now);
    } catch {
      throw new NotFoundException('GRAMMAR_POOL_EMPTY');
    }

    const mt = await this.prisma.modelltest.findUnique({
      where: { number: weeklyNumber },
      select: { id: true },
    });
    if (!mt) {
      throw new NotFoundException('GRAMMAR_POOL_EMPTY');
    }

    const links = await this.prisma.grammarTopicModelltest.findMany({
      where: {
        modelltest_id: mt.id,
        topic: { published: true },
      },
      include: { topic: { include: { examples: true } } },
      orderBy: [{ sort_order: 'asc' }, { topic: { slug: 'asc' } }],
    });
    const pool = links.map((link) => link.topic);
    if (pool.length === 0) {
      throw new NotFoundException('GRAMMAR_POOL_EMPTY');
    }
    try {
      return topicOfTheDay(pool, now);
    } catch {
      throw new NotFoundException('GRAMMAR_POOL_EMPTY');
    }
  }

  private guestProgressKey(studentId: string, topicId: string): string {
    return `${studentId}:${topicId}`;
  }

  private async getOrInitProgress(
    studentId: string,
    topicId: string,
    opts: GrammarAccessOpts = {},
  ): Promise<GrammarProgressRow> {
    // Guests have no `students` row — FK would 500 on create (same as Hören plays).
    if (opts.isGuest === true) {
      const key = this.guestProgressKey(studentId, topicId);
      const existing = this.guestProgress.get(key);
      if (existing) return existing;
      const created: GrammarProgressRow = {
        id: `guest-${key}`,
        lesson_completed: false,
        next_exercise_index: 0,
      };
      this.guestProgress.set(key, created);
      return created;
    }

    const existing = await this.prisma.grammarTopicProgress.findUnique({
      where: {
        student_id_topic_id: { student_id: studentId, topic_id: topicId },
      },
    });
    if (existing) return existing;
    return this.prisma.grammarTopicProgress.create({
      data: { student_id: studentId, topic_id: topicId },
    });
  }

  private toTopicDto(
    topic: Awaited<ReturnType<GrammarService['resolveTopicOfTheDay']>>,
    lang: GrammarLang,
  ): GrammarTopicDto {
    const localized = localizeGrammarTopic(
      {
        title_de: topic.title_de,
        title_fr: topic.title_fr,
        title_en: topic.title_en,
        rule_de: topic.rule_de,
        rule_fr: topic.rule_fr,
        rule_en: topic.rule_en,
        notes_fr: topic.notes_fr,
        notes_en: topic.notes_en,
        notes_de: topic.notes_de,
        examples: topic.examples,
      },
      lang,
    );
    return {
      id: topic.id,
      slug: topic.slug,
      lang: localized.lang,
      title: localized.title,
      category: topic.category,
      cefrLevels: topic.cefr_levels,
      rule: localized.rule,
      notes: localized.notes,
      examples: localized.examples,
      imageUrl: grammarImageUrlForSlug(topic.slug),
    };
  }

  private async safeWeeklyNumber(now: Date): Promise<number | undefined> {
    try {
      return await this.trainingAccess.weeklyModelltestNumber(now);
    } catch {
      return undefined;
    }
  }
}
