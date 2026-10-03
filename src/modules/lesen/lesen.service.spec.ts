import { UnprocessableEntityException } from '@nestjs/common';
import { LesenService } from './lesen.service';

describe('LesenService answer security', () => {
  const student = { studentId: 'student-1' };
  const prisma: any = {
    modelltest: { findUnique: jest.fn() },
    lesenTeil1Exercise: { findFirst: jest.fn(), findUnique: jest.fn() },
    lesenTeil2Exercise: { findFirst: jest.fn(), findUnique: jest.fn() },
    lesenTeil3Exercise: { findFirst: jest.fn(), findUnique: jest.fn() },
    lesenAttempt: { findUnique: jest.fn(), create: jest.fn() },
    student: { findUnique: jest.fn() },
    studentActivity: { create: jest.fn() },
    $transaction: jest.fn((work: any) => work(prisma)),
  };
  let service: LesenService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LesenService(prisma);
    prisma.modelltest.findUnique.mockResolvedValue({ id: 'mt-1' });
    prisma.lesenAttempt.findUnique.mockResolvedValue(null);
    prisma.lesenAttempt.create.mockResolvedValue({});
    prisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
    prisma.studentActivity.create.mockResolvedValue({});
  });

  // Fixtures shared by the exercise tests below. Teil 1's correct title is a
  // real titles[].id, Teil 2's correct option sits at sortOrder 0 ("6a"), and
  // Teil 3's situation points at the announcement that renders as "a".
  const teil1Row = {
    label: 'T1',
    instruction: 'I',
    createdAt: new Date(),
    texts: [
      {
        textNumber: 1,
        von: null,
        an: null,
        body: 'Body',
        correctTitleId: 'title-a',
      },
    ],
    titles: [{ id: 'title-a', content: 'Title', sortOrder: 0 }],
  };
  const teil2Row = {
    contentRevision: 'revision',
    label: 'T2',
    instruction: 'I',
    cautionNote: 'C',
    topSender: 'S',
    topReceiver: 'R',
    topBody: 'B',
    quotedThread: 'Q',
    questions: [
      {
        questionNumber: 6,
        prompt: 'P',
        options: [{ content: 'A', isCorrect: true, sortOrder: 0 }],
      },
    ],
  };
  const teil3Row = {
    label: 'T3',
    instruction: 'I',
    announcements: [{ id: 'ann-1', title: 'A', content: 'C', sortOrder: 0 }],
    situations: [
      {
        situationNumber: 11,
        content: 'S',
        noMatch: false,
        correctAnnouncementId: 'ann-1',
      },
    ],
  };

  function mockExerciseRows() {
    prisma.lesenTeil1Exercise.findFirst.mockResolvedValue(teil1Row);
    prisma.lesenTeil2Exercise.findFirst.mockResolvedValue(teil2Row);
    prisma.lesenTeil3Exercise.findFirst.mockResolvedValue(teil3Row);
  }

  // This test used to assert the opposite: that getExercise() leaked no
  // answers. Reversed deliberately — see
  // docs/adr/0001-answer-key-with-exercise.md. Kept on the same surface so the
  // next person to change it confronts the decision rather than rediscovering it.
  it('exposes the correct answer for Teile 1, 2 and 3', async () => {
    mockExerciseRows();
    const result = await service.getExercise(1);

    expect(result.teil1.texts[0].correctTitleId).toBe('title-a');
    expect(result.teil2.questions[0].correctOptionId).toBe('6a');
    expect(result.teil3.situations[0].correctAnswer).toBe('a');
  });

  it('marks a Teil 3 situation with no matching announcement as X', async () => {
    mockExerciseRows();
    prisma.lesenTeil3Exercise.findFirst.mockResolvedValue({
      ...teil3Row,
      situations: [
        {
          situationNumber: 12,
          content: 'S',
          noMatch: true,
          correctAnnouncementId: null,
        },
      ],
    });
    const result = await service.getExercise(1);

    expect(result.teil3.situations[0].correctAnswer).toBe('X');
  });

  it('never leaks raw database column names', async () => {
    mockExerciseRows();
    const json = JSON.stringify(await service.getExercise(1));

    // The answers are public now; the schema is not. These appearing would mean
    // a Prisma row was spread into the response instead of projected field by
    // field — which would also expose columns nobody reviewed.
    expect(json).not.toContain('isCorrect');
    expect(json).not.toContain('correctAnnouncementId');
    expect(json).not.toContain('sortOrder');
    expect(json).not.toContain('noMatch');
  });

  it('serves the same answers that submit scores against', async () => {
    // getExercise() and getSubmissionRules() now both produce this key, from
    // different queries. This is the test that stops the two drifting apart.
    mockExerciseRows();
    prisma.lesenTeil1Exercise.findUnique.mockResolvedValue(teil1Row);
    prisma.lesenTeil2Exercise.findUnique.mockResolvedValue(teil2Row);
    prisma.lesenTeil3Exercise.findUnique.mockResolvedValue(teil3Row);
    const exercise = await service.getExercise(1);
    const base = { id: 'a', exercise_type_id: 'reading', tested_at: 'now' };

    // A guest, so the comparison runs without storing three attempts.
    const guest = { studentId: 'guest-uuid', isGuest: true };

    const teil1 = await service.submit(guest, {
      ...base,
      teil_id: '1',
      answers: { '1': exercise.teil1.texts[0].correctTitleId },
    });
    const teil2 = await service.submit(guest, {
      ...base,
      teil_id: '2',
      answers: { '6': exercise.teil2.questions[0].correctOptionId },
    });
    const teil3 = await service.submit(guest, {
      ...base,
      teil_id: '3',
      answers: { '11': exercise.teil3.situations[0].correctAnswer },
    });

    expect(teil1.score).toBe(100);
    expect(teil2.score).toBe(100);
    expect(teil3.score).toBe(100);
  });

  it('scores Lesen submissions server-side and ignores score_percent', async () => {
    prisma.lesenTeil2Exercise.findUnique.mockResolvedValue({
      questions: [
        { questionNumber: 6, options: [{ isCorrect: true, sortOrder: 2 }] },
        {
          questionNumber: 7,
          options: [
            { isCorrect: true, sortOrder: 0 },
            { isCorrect: false, sortOrder: 1 },
          ],
        },
      ],
    });
    const result = await service.submit(student, {
      id: 'attempt',
      exercise_type_id: 'reading',
      teil_id: '2',
      tested_at: 'now',
      score_percent: 100,
      answers: { '6': '6c', '7': '7b' },
    });
    expect(result).toEqual({ attemptId: expect.any(String), score: 50 });

    // Lesen now keeps what it scores, with its summary, in one transaction.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.lesenAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attempt_id: result.attemptId,
        student_id: 'student-1',
        teil_id: '2',
        modelltest_id: 'mt-1',
        score: 50,
        answers: { '6': '6c', '7': '7b' },
      }),
    });
    expect(prisma.studentActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        skill: 'LESEN',
        teil: 2,
        score: 50,
        attempt_id: result.attemptId,
      }),
    });
  });

  it('scores a guest and keeps nothing', async () => {
    prisma.lesenTeil2Exercise.findUnique.mockResolvedValue({
      questions: [
        { questionNumber: 6, options: [{ isCorrect: true, sortOrder: 0 }] },
      ],
    });

    const result = await service.submit(
      { studentId: 'guest-uuid', isGuest: true },
      {
        id: 'attempt',
        exercise_type_id: 'reading',
        teil_id: '2',
        tested_at: 'now',
        answers: { '6': '6a' },
      },
    );

    expect(result).toEqual({ score: 100 });
    expect(prisma.lesenAttempt.create).not.toHaveBeenCalled();
  });

  it('rejects unknown question IDs and answer values outside the exercise options', async () => {
    prisma.lesenTeil2Exercise.findUnique.mockResolvedValue({
      questions: [
        {
          questionNumber: 6,
          options: [
            { isCorrect: true, sortOrder: 0 },
            { isCorrect: false, sortOrder: 1 },
          ],
        },
      ],
    });
    const base = {
      id: 'attempt',
      exercise_type_id: 'reading',
      teil_id: '2',
      tested_at: 'now',
    };

    await expect(
      service.submit(student, { ...base, answers: { '99': '99a' } }),
    ).rejects.toThrow(UnprocessableEntityException);
    await expect(
      service.submit(student, { ...base, answers: { '6': '6z' } }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects an unknown Modelltest and an unknown Teil', async () => {
    prisma.modelltest.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.submit(student, {
        id: 'attempt',
        exercise_type_id: 'reading',
        teil_id: '1',
        tested_at: 'now',
        answers: { '1': 'title-a' },
      }),
    ).rejects.toThrow('Modelltest not found');

    await expect(
      service.submit(student, {
        id: 'attempt',
        exercise_type_id: 'reading',
        teil_id: '4',
        tested_at: 'now',
        answers: { '1': 'a' },
      }),
    ).rejects.toThrow('Lesen Teil not found');
  });
});

describe('LesenService history (D29)', () => {
  const prisma: any = {
    lesenAttempt: { findMany: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([
      {
        teil: 3,
        attempts: 1,
        best_score: 67,
        last_score: 67,
        last_at: new Date('2026-09-18T09:00:00Z'),
      },
    ]),
  };
  const service = new LesenService(prisma);

  it('lists stored attempts in the shape the other modules use', async () => {
    prisma.lesenAttempt.findMany.mockResolvedValue([
      {
        attempt_id: 'a-1',
        teil_id: '3',
        modelltest_id: 'mt-1',
        score: 67,
        duration_seconds: null,
        created_at: new Date('2020-01-02T09:00:00Z'),
      },
    ]);

    const [item] = await service.getSessions('student-1', 3);

    expect(item).toMatchObject({
      id: 'a-1',
      attemptId: 'a-1',
      skill: 'lesen',
      teil: 3,
      score: 67,
      maxScore: 100,
      status: 'completed',
      date: '2020-01-02T09:00:00.000Z',
      dateLabel: '02.01.2020',
    });
    expect(prisma.lesenAttempt.findMany.mock.calls[0][0].where).toEqual({
      student_id: 'student-1',
      // Training only: an exam attempt shares this table.
      erasure_id: null,
      exam_attempt_id: null,
      teil_id: '3',
    });
  });

  it('lists the three Teils with the numbers of the ones done', async () => {
    const teils = await service.getTeils('student-1');

    expect(teils.map((teil) => teil.progress)).toEqual([0, 0, 100]);
    expect(teils[2]).toMatchObject({ id: '3', attempts: 1, bestScore: 67 });
  });
});
