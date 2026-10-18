/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { MODELLTEST_PERIOD_EPOCH_MS } from '../modelltests/seven-day-period';
import { GrammarService } from './grammar.service';

describe('GrammarService', () => {
  const now = new Date(MODELLTEST_PERIOD_EPOCH_MS);
  const topic = {
    id: 'topic-1',
    slug: 'nominativ-gram-a-001',
    category: 'Cases',
    title_de: 'Nominativ',
    title_fr: 'Nominatif',
    title_en: 'Nominative',
    cefr_levels: ['A1'],
    rule_de: 'Regel DE',
    rule_fr: 'Règle FR',
    rule_en: 'Rule EN',
    notes_fr: 'Note FR',
    notes_en: 'Note EN',
    notes_de: 'Hinweis DE',
    examples: [
      { de: 'Der Hund bellt.', fr: 'Le chien aboie.', en: 'The dog barks.' },
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
      prompt_de: 'Q0 DE',
      prompt_fr: 'Q0',
      prompt_en: 'Q0 EN',
      options_json: ['a', 'b'],
      answer: 'a',
      explanation_fr: 'ok',
      explanation_en: 'ok EN',
      explanation_de: 'ok DE',
    },
    {
      id: 'ex-1',
      topic_id: 'topic-1',
      kind: 'mcq',
      difficulty: 'medium',
      sort_order: 0,
      prompt_de: 'Q1 DE',
      prompt_fr: 'Q1',
      prompt_en: 'Q1 EN',
      options_json: ['a', 'b'],
      answer: 'b',
      explanation_fr: 'ok',
      explanation_en: 'ok EN',
      explanation_de: 'ok DE',
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
      modelltest: {
        findUnique: jest.fn().mockResolvedValue({ id: 'mt-2' }),
      },
      grammarTopicModelltest: {
        findMany: jest.fn().mockResolvedValue([{ topic }]),
      },
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
    expect(prisma.grammarTopic.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { published: true },
        include: { examples: true },
      }),
    );
    expect(prisma.grammarTopicModelltest.findMany).not.toHaveBeenCalled();
  });

  it('throws GRAMMAR_POOL_EMPTY when no published topics', async () => {
    prisma.grammarTopic.findMany.mockResolvedValue([]);
    await expect(service.getOfTheDay('student-1', now)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('localizes of-the-day topic to fr by default', async () => {
    const dto = await service.getOfTheDay('student-1', now);
    expect(dto.topic.lang).toBe('fr');
    expect(dto.topic.title).toBe('Nominatif');
    expect(dto.topic.rule).toBe('Règle FR');
    expect(dto.topic.notes).toBe('Note FR');
    expect(dto.topic.examples[0]).toEqual({
      de: 'Der Hund bellt.',
      gloss: 'Le chien aboie.',
    });
  });

  it('localizes of-the-day topic when lang=en', async () => {
    const dto = await service.getOfTheDay('student-1', now, { lang: 'en' });
    expect(dto.topic.lang).toBe('en');
    expect(dto.topic.title).toBe('Nominative');
    expect(dto.topic.rule).toBe('Rule EN');
    expect(dto.topic.notes).toBe('Note EN');
    expect(dto.topic.examples[0].gloss).toBe('The dog barks.');
  });

  it('localizes of-the-day topic when lang=de', async () => {
    const dto = await service.getOfTheDay('student-1', now, { lang: 'de' });
    expect(dto.topic.lang).toBe('de');
    expect(dto.topic.title).toBe('Nominativ');
    expect(dto.topic.rule).toBe('Regel DE');
    expect(dto.topic.notes).toBe('Hinweis DE');
    expect(dto.topic.examples[0].gloss).toBeNull();
  });

  it('propagates lang to getTopicById', async () => {
    const dto = await service.getTopicById('student-1', 'topic-1', now, {
      lang: 'de',
    });
    expect(dto.topic.lang).toBe('de');
    expect(dto.topic.rule).toBe('Regel DE');
  });

  it('includes local imageUrl when GRAMMAR_IMAGES_PUBLIC_BASE_URL is set', async () => {
    const prev = process.env.GRAMMAR_IMAGES_PUBLIC_BASE_URL;
    process.env.GRAMMAR_IMAGES_PUBLIC_BASE_URL =
      'http://localhost:3000/static/grammar-images';
    try {
      const dto = await service.getOfTheDay('student-1', now);
      expect(dto.topic.imageUrl).toBe(
        'http://localhost:3000/static/grammar-images/001_nominativ-gram-a-001.jpg',
      );
    } finally {
      if (prev === undefined) delete process.env.GRAMMAR_IMAGES_PUBLIC_BASE_URL;
      else process.env.GRAMMAR_IMAGES_PUBLIC_BASE_URL = prev;
    }
  });

  it('leaves imageUrl null when GRAMMAR_IMAGES_PUBLIC_BASE_URL is unset', async () => {
    const prev = process.env.GRAMMAR_IMAGES_PUBLIC_BASE_URL;
    delete process.env.GRAMMAR_IMAGES_PUBLIC_BASE_URL;
    try {
      const dto = await service.getOfTheDay('student-1', now);
      expect(dto.topic.imageUrl).toBeNull();
    } finally {
      if (prev === undefined) delete process.env.GRAMMAR_IMAGES_PUBLIC_BASE_URL;
      else process.env.GRAMMAR_IMAGES_PUBLIC_BASE_URL = prev;
    }
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
    expect(list.exercises[0].answer).toBe('a');
    expect(list.exercises[0].prompt).toBe('Q0');
  });

  it('localizes of-the-day exercise prompts when lang=en', async () => {
    prisma.grammarTopicProgress.findUnique.mockResolvedValue(progressRow);
    const list = await service.getExercisesOfTheDay('student-1', now, {
      lang: 'en',
    });
    expect(list.exercises[0].prompt).toBe('Q0 EN');
    expect(list.exercises[0].answer).toBe('a');
    expect(list.exercises[0].explanation).toBe('ok EN');
  });

  it('localizes of-the-day exercise prompts when lang=de', async () => {
    prisma.grammarTopicProgress.findUnique.mockResolvedValue(progressRow);
    const list = await service.getExercisesOfTheDay('student-1', now, {
      lang: 'de',
    });
    expect(list.exercises[0].prompt).toBe('Q0 DE');
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
    expect(right.explanation).toBe('ok');
    expect(right.explanationFr).toBe('ok');
  });

  it('submitExercise localizes explanation when lang=en', async () => {
    progressRow.lesson_completed = true;
    progressRow.next_exercise_index = 0;
    prisma.grammarTopicProgress.findUnique.mockResolvedValue(progressRow);

    const res = await service.submitExercise('student-1', 'ex-0', 'a', now, {
      lang: 'en',
    });
    expect(res.explanation).toBe('ok EN');
    expect(res.explanationFr).toBe('ok EN');
  });

  it('404 when pool empty', async () => {
    prisma.grammarTopic.findMany.mockResolvedValue([]);
    await expect(service.getOfTheDay('student-1', now)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getLevels returns 5/7/10 minute hints and 10/15/20 question counts', () => {
    const dto = service.getLevels();
    expect(dto.levels).toEqual([
      { id: '1', difficulty: 'easy', durationMinutes: 5, questionCount: 10 },
      { id: '2', difficulty: 'medium', durationMinutes: 7, questionCount: 15 },
      { id: '3', difficulty: 'hard', durationMinutes: 10, questionCount: 20 },
    ]);
  });

  it('getPracticeExercises includes answer, explanation, and prompt', async () => {
    const cloze = {
      id: 'ex-cloze',
      topic_id: 'topic-1',
      kind: 'cloze',
      difficulty: 'hard',
      sort_order: 1,
      prompt_de: 'Ergänze ___',
      prompt_fr: 'Complète ___',
      prompt_en: 'Complete ___',
      options_json: null,
      answer: 'den',
      explanation_fr: 'Akkusativ',
      explanation_en: 'Accusative',
      explanation_de: 'Akkusativ DE',
    };
    prisma.grammarExercise.findMany.mockResolvedValue([...exercises, cloze]);

    const dto = await service.getPracticeExercises();
    expect(dto.exercises).toHaveLength(3);
    expect(dto.exercises[0]).toMatchObject({
      id: 'ex-0',
      prompt: 'Q0',
      options: ['a', 'b'],
      answer: 'a',
      explanation: 'ok',
      explanationFr: 'ok',
      difficulty: 'easy',
    });
    expect(dto.exercises[2]).toMatchObject({
      id: 'ex-cloze',
      prompt: 'Complète ___',
      options: null,
      answer: 'den',
      explanation: 'Akkusativ',
      explanationFr: 'Akkusativ',
      difficulty: 'hard',
    });
    expect(prisma.grammarExercise.findMany).toHaveBeenCalledWith({
      where: { topic_id: 'topic-1' },
    });
  });

  it('getPracticeExercises localizes prompt and explanation when lang=en', async () => {
    prisma.grammarExercise.findMany.mockResolvedValue([exercises[0]]);
    const dto = await service.getPracticeExercises(undefined, { lang: 'en' });
    expect(dto.exercises[0]).toMatchObject({
      prompt: 'Q0 EN',
      explanation: 'ok EN',
      explanationFr: 'ok EN',
    });
  });

  it('getPracticeExercises filters by difficulty=easy for today’s topic only', async () => {
    const manyEasy = Array.from({ length: 14 }, (_, i) => ({
      ...exercises[0],
      id: `ex-easy-${i}`,
      sort_order: i,
    }));
    prisma.grammarExercise.findMany.mockResolvedValue(manyEasy);
    const dto = await service.getPracticeExercises('easy');
    expect(dto.exercises.every((e) => e.difficulty === 'easy')).toBe(true);
    expect(dto.exercises).toHaveLength(10);
    expect(dto.exercises[0].id).toBe('ex-easy-0');
    expect(prisma.grammarExercise.findMany).toHaveBeenCalledWith({
      where: { topic_id: 'topic-1', difficulty: 'easy' },
    });
  });

  it('getPracticeExercises caps medium at 15 and hard at 20', async () => {
    const manyMedium = Array.from({ length: 20 }, (_, i) => ({
      ...exercises[1],
      id: `ex-m-${i}`,
      sort_order: i,
    }));
    prisma.grammarExercise.findMany.mockResolvedValue(manyMedium);
    const medium = await service.getPracticeExercises('medium');
    expect(medium.exercises).toHaveLength(15);

    const manyHard = Array.from({ length: 25 }, (_, i) => ({
      ...exercises[1],
      id: `ex-h-${i}`,
      difficulty: 'hard',
      sort_order: i,
    }));
    prisma.grammarExercise.findMany.mockResolvedValue(manyHard);
    const hard = await service.getPracticeExercises('hard');
    expect(hard.exercises).toHaveLength(20);
  });

  it('getPracticeExercises rejects invalid difficulty', async () => {
    await expect(service.getPracticeExercises('insane')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.grammarExercise.findMany).not.toHaveBeenCalled();
  });

  it('of-the-day exercises include answer and explanation like practice / ADR 0001', async () => {
    prisma.grammarTopicProgress.findUnique.mockResolvedValue(progressRow);
    const list = await service.getExercisesOfTheDay('student-1', now);
    expect(list.exercises[0]).toMatchObject({
      id: 'ex-0',
      prompt: 'Q0',
      answer: 'a',
      explanation: 'ok',
      explanationFr: 'ok',
    });
    expect(list.exercises[1]).toMatchObject({
      answer: 'b',
      explanation: 'ok',
    });
  });

  it('of-the-day exercises localize explanation when lang=en', async () => {
    prisma.grammarTopicProgress.findUnique.mockResolvedValue(progressRow);
    const list = await service.getExercisesOfTheDay('student-1', now, {
      lang: 'en',
    });
    expect(list.exercises[0]).toMatchObject({
      prompt: 'Q0 EN',
      answer: 'a',
      explanation: 'ok EN',
      explanationFr: 'ok EN',
    });
  });

  describe('free practice submit / progress', () => {
    beforeEach(() => {
      prisma.grammarPracticeAttempt = {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
        aggregate: jest.fn().mockResolvedValue({
          _avg: { score: null },
          _count: { _all: 0 },
        }),
      };
      prisma.$transaction = jest
        .fn()
        .mockImplementation(async (fn: (tx: typeof prisma) => Promise<void>) =>
          fn(prisma),
        );
      prisma.grammarExercise.findMany.mockResolvedValue(exercises);
    });

    it('submitPractice scores answers and persists a session attempt', async () => {
      const res = await service.submitPractice('student-1', {
        answers: { 'ex-0': 'a', 'ex-1': 'wrong' },
        difficulty: 'easy',
        durationSeconds: 120,
      });

      expect(res.score).toBe(50);
      expect(res.correctCount).toBe(1);
      expect(res.total).toBe(2);
      expect(res.attemptId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(res.answerKey).toEqual({ 'ex-0': 'a', 'ex-1': 'b' });
      expect(prisma.grammarPracticeAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          student_id: 'student-1',
          score: 50,
          correct_count: 1,
          total: 2,
          difficulty: 'easy',
          duration_seconds: 120,
          answers: { 'ex-0': 'a', 'ex-1': 'wrong' },
          status: 'completed',
        }),
      });
      expect(prisma.grammarTopicProgress.update).not.toHaveBeenCalled();
      expect(prisma.grammarExerciseAttempt.create).not.toHaveBeenCalled();
    });

    it('submitPractice is idempotent when the same attemptId is retried', async () => {
      const attemptId = '11111111-1111-4111-8111-111111111111';
      prisma.grammarPracticeAttempt.findUnique.mockResolvedValue({
        student_id: 'student-1',
        score: 50,
        correct_count: 1,
        total: 2,
      });

      const res = await service.submitPractice('student-1', {
        answers: { 'ex-0': 'a', 'ex-1': 'wrong' },
        attemptId,
      });

      expect(res.attemptId).toBe(attemptId);
      expect(res.score).toBe(50);
      expect(prisma.grammarPracticeAttempt.create).not.toHaveBeenCalled();
    });

    it('submitPractice rejects empty answers', async () => {
      await expect(
        service.submitPractice('student-1', { answers: {} }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('submitPractice rejects unknown exercise ids', async () => {
      await expect(
        service.submitPractice('student-1', {
          answers: { 'ex-0': 'a', missing: 'x' },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('getPracticeSessions maps stored rows', async () => {
      const completedAt = new Date('2026-10-13T12:00:00.000Z');
      prisma.grammarPracticeAttempt.findMany.mockResolvedValue([
        {
          attempt_id: 'att-1',
          score: 80,
          correct_count: 4,
          total: 5,
          difficulty: 'medium',
          duration_seconds: 300,
          completed_at: completedAt,
          created_at: completedAt,
          status: 'completed',
        },
      ]);

      const rows = await service.getPracticeSessions('student-1');
      expect(rows).toEqual([
        {
          id: 'att-1',
          attemptId: 'att-1',
          score: 80,
          maxScore: 100,
          correctCount: 4,
          total: 5,
          difficulty: 'medium',
          durationSeconds: 300,
          status: 'completed',
          completedAt: completedAt.toISOString(),
          date: completedAt.toISOString(),
        },
      ]);
    });

    it('getPracticeProgress returns aggregate summary', async () => {
      prisma.grammarPracticeAttempt.aggregate.mockResolvedValue({
        _avg: { score: 66.6 },
        _count: { _all: 3 },
      });
      prisma.grammarPracticeAttempt.findMany.mockResolvedValue([
        {
          attempt_id: 'att-last',
          score: 90,
          correct_count: 9,
          total: 10,
          difficulty: 'hard',
          duration_seconds: 600,
          completed_at: new Date('2026-10-13T15:00:00.000Z'),
          created_at: new Date('2026-10-13T15:00:00.000Z'),
          status: 'completed',
        },
      ]);

      const progress = await service.getPracticeProgress('student-1');
      expect(progress.attemptCount).toBe(3);
      expect(progress.averageScore).toBe(67);
      expect(progress.lastAttempt?.attemptId).toBe('att-last');
      expect(progress.lastAttempt?.score).toBe(90);
    });
  });
});
