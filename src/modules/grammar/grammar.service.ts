import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { TrainingModelltestAccessService } from '../../shared/services/training-modelltest-access.service';
import { grammarDayBounds, topicOfTheDay } from './grammar-day';
import {
  exerciseStatusAtIndex,
  sortGrammarExercises,
} from './grammar-exercise-order';
import type {
  CompleteLessonResponseDto,
  GrammarExercisesOfTheDayDto,
  GrammarOfTheDayDto,
  GrammarTopicDto,
  SubmitGrammarExerciseResponseDto,
} from './dto/grammar.dto';

@Injectable()
export class GrammarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trainingAccess: TrainingModelltestAccessService,
  ) {}

  async getOfTheDay(
    studentId: string,
    now: Date = new Date(),
  ): Promise<GrammarOfTheDayDto> {
    const topic = await this.resolveTopicOfTheDay(now);
    const [progress, exercisesTotal, modelltestNumber] = await Promise.all([
      this.getOrInitProgress(studentId, topic.id),
      this.prisma.grammarExercise.count({ where: { topic_id: topic.id } }),
      this.safeWeeklyNumber(now),
    ]);

    return {
      modelltestNumber,
      day: this.dayDto(now),
      topic: this.toTopicDto(topic),
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
  ): Promise<GrammarOfTheDayDto> {
    const ofTheDay = await this.getOfTheDay(studentId, now);
    if (ofTheDay.topic.id !== topicId) {
      throw new NotFoundException('GRAMMAR_TOPIC_NOT_TODAY');
    }
    return ofTheDay;
  }

  async completeLesson(
    studentId: string,
    now: Date = new Date(),
  ): Promise<CompleteLessonResponseDto> {
    const topic = await this.resolveTopicOfTheDay(now);
    const progress = await this.getOrInitProgress(studentId, topic.id);

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
  ): Promise<GrammarExercisesOfTheDayDto> {
    const topic = await this.resolveTopicOfTheDay(now);
    const progress = await this.getOrInitProgress(studentId, topic.id);
    const raw = await this.prisma.grammarExercise.findMany({
      where: { topic_id: topic.id },
    });
    const ordered = sortGrammarExercises(raw);

    return {
      topicId: topic.id,
      topicSlug: topic.slug,
      day: this.dayDto(now),
      lessonCompleted: progress.lesson_completed,
      exercises: ordered.map((exo, index) => ({
        id: exo.id,
        index,
        difficulty: exo.difficulty,
        kind: exo.kind,
        promptDe: exo.prompt_de,
        promptFr: exo.prompt_fr,
        options: Array.isArray(exo.options_json)
          ? (exo.options_json as string[])
          : null,
        status: exerciseStatusAtIndex(
          index,
          progress.lesson_completed,
          progress.next_exercise_index,
        ),
      })),
    };
  }

  async submitExercise(
    studentId: string,
    exerciseId: string,
    answer: string,
    now: Date = new Date(),
  ): Promise<SubmitGrammarExerciseResponseDto> {
    const topic = await this.resolveTopicOfTheDay(now);
    const progress = await this.getOrInitProgress(studentId, topic.id);

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
    const ordered = sortGrammarExercises(raw);
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
    const correct =
      answer.trim().toLowerCase() === exo.answer.trim().toLowerCase();

    await this.prisma.grammarExerciseAttempt.create({
      data: {
        student_id: studentId,
        exercise_id: exo.id,
        answer,
        correct,
      },
    });

    let nextExerciseIndex = progress.next_exercise_index;
    if (correct && index === progress.next_exercise_index) {
      nextExerciseIndex = index + 1;
      await this.prisma.grammarTopicProgress.update({
        where: { id: progress.id },
        data: { next_exercise_index: nextExerciseIndex },
      });
    }

    return {
      correct,
      explanationFr: correct ? exo.explanation_fr : exo.explanation_fr,
      nextExerciseIndex,
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

  private async resolveTopicOfTheDay(now: Date) {
    const pool = await this.prisma.grammarTopic.findMany({
      where: { published: true },
      include: { examples: true },
      orderBy: [{ sort_order: 'asc' }, { slug: 'asc' }],
    });
    if (pool.length === 0) {
      throw new NotFoundException('GRAMMAR_POOL_EMPTY');
    }
    try {
      return topicOfTheDay(pool, now);
    } catch {
      throw new NotFoundException('GRAMMAR_POOL_EMPTY');
    }
  }

  private async getOrInitProgress(studentId: string, topicId: string) {
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
  ): GrammarTopicDto {
    return {
      id: topic.id,
      slug: topic.slug,
      titleFr: topic.title_fr,
      titleDe: topic.title_de,
      titleEn: topic.title_en,
      category: topic.category,
      cefrLevels: topic.cefr_levels,
      ruleFr: topic.rule_fr,
      ruleDe: topic.rule_de,
      ruleEn: topic.rule_en,
      notesFr: topic.notes_fr,
      examples: topic.examples.map((e) => ({
        de: e.de,
        fr: e.fr,
        en: e.en,
      })),
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
