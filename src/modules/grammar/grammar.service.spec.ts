/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { MODELLTEST_PERIOD_EPOCH_MS } from '../modelltests/seven-day-period';
import { GrammarService } from './grammar.service';

describe('GrammarService', () => {
  const now = new Date(MODELLTEST_PERIOD_EPOCH_MS);
  const topic = {
    id: 'topic-1',
    slug: 'nominativ-gram-a-001',
    category: 'Cases',
    title_de: 'Nominativ',
    title_fr: 'Nominativ',
    title_en: 'Nominativ',
    cefr_levels: ['A1'],
    rule_de: 'Regel DE',
    rule_fr: 'Rule EN',
    rule_en: 'Rule EN',
    notes_fr: null,
    examples: [
      { de: 'Der Hund bellt.', fr: 'The dog barks.', en: 'The dog barks.' },
    ],
    sort_order: 0,
    published: true,
  };

  const exercises = [
    {
      id: 'ex-0',
      topic_id: 'topic-1',
      kind: 'mcq',
      difficulty: 'easy',
      sort_order: 0,
      prompt_de: null,
      prompt_fr: 'Q0',
      options_json: ['a', 'b'],
      answer: 'a',
      explanation_fr: 'ok',
    },
    {
      id: 'ex-1',
      topic_id: 'topic-1',
      kind: 'mcq',
      difficulty: 'medium',
      sort_order: 0,
      prompt_de: null,
      prompt_fr: 'Q1',
      options_json: ['a', 'b'],
      answer: 'b',
      explanation_fr: 'ok',
    },
  ];

  let prisma: any;
  let trainingAccess: { weeklyModelltestNumber: jest.Mock };
  let service: GrammarService;
  let progressRow: {
    id: string;
    lesson_completed: boolean;
    next_exercise_index: number;
  };

  beforeEach(() => {
    progressRow = {
      id: 'prog-1',
      lesson_completed: false,
      next_exercise_index: 0,
    };
    prisma = {
      grammarTopic: {
        findMany: jest.fn().mockResolvedValue([topic]),
      },
      grammarTopicProgress: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'prog-1',
          ...data,
          lesson_completed: false,
          next_exercise_index: 0,
        })),
        update: jest.fn().mockImplementation(async ({ data }) => {
          progressRow = { ...progressRow, ...data };
          return progressRow;
        }),
      },
      grammarExercise: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue(exercises),
      },
      grammarExerciseAttempt: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    trainingAccess = {
      weeklyModelltestNumber: jest.fn().mockResolvedValue(2),
    };
    service = new GrammarService(prisma, trainingAccess as any);
  });

  it('returns of-the-day without exercise answers', async () => {
    const dto = await service.getOfTheDay('student-1', now);
    expect(dto.topic.id).toBe('topic-1');
    expect(dto.modelltestNumber).toBe(2);
    expect(dto.progress.lessonCompleted).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(dto, 'exercises')).toBe(false);
  });

  it('completeLesson unlocks the path', async () => {
    prisma.grammarTopicProgress.findUnique.mockResolvedValue(progressRow);
    const res = await service.completeLesson('student-1', now);
    expect(res.lessonCompleted).toBe(true);
    expect(prisma.grammarTopicProgress.update).toHaveBeenCalled();
  });

  it('lists exercises with locked status before lesson complete', async () => {
    prisma.grammarTopicProgress.findUnique.mockResolvedValue(progressRow);
    const list = await service.getExercisesOfTheDay('student-1', now);
    expect(list.exercises.every((e) => e.status === 'locked')).toBe(true);
    expect(list.exercises[0]).not.toHaveProperty('answer');
  });

  it('refuses submit when the lesson is not completed', async () => {
    prisma.grammarTopicProgress.findUnique.mockResolvedValue(progressRow);
    await expect(
      service.submitExercise('student-1', 'ex-0', 'a', now),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses submit for a step ahead of the cursor', async () => {
    progressRow.lesson_completed = true;
    progressRow.next_exercise_index = 0;
    prisma.grammarTopicProgress.findUnique.mockResolvedValue(progressRow);
    await expect(
      service.submitExercise('student-1', 'ex-1', 'b', now),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('advances the cursor only on a correct answer', async () => {
    progressRow.lesson_completed = true;
    progressRow.next_exercise_index = 0;
    prisma.grammarTopicProgress.findUnique.mockResolvedValue(progressRow);

    const wrong = await service.submitExercise(
      'student-1',
      'ex-0',
      'nope',
      now,
    );
    expect(wrong.correct).toBe(false);
    expect(wrong.nextExerciseIndex).toBe(0);

    const right = await service.submitExercise('student-1', 'ex-0', 'a', now);
    expect(right.correct).toBe(true);
    expect(right.nextExerciseIndex).toBe(1);
  });

  it('404 when pool empty', async () => {
    prisma.grammarTopic.findMany.mockResolvedValue([]);
    await expect(service.getOfTheDay('student-1', now)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
