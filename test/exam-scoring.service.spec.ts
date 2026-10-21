/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { ExamScoringService } from '../src/modules/centers/exam-scoring.service';

/**
 * Scoring a submitted block.
 *
 * Two claims matter here and they pull against each other: an exam must be
 * marked by exactly the code training is marked by — one answer key, not two
 * that can drift — while never touching a student's training history, because
 * an exam is not practice and must not move their readiness score.
 */
describe('ExamScoringService', () => {
  const STUDENT = 'student-1';
  const ATTEMPT = 'exam-attempt-1';
  const MODELLTEST = 'mt-1';

  let prisma: any;
  let lesen: any;
  let sprachbausteine: any;
  let listening: any;
  let correction: any;
  let service: ExamScoringService;

  beforeEach(() => {
    prisma = {
      // deleteMany is how marking is made repeatable: a submit whose
      // marking failed has to be safe to re-run without doubling every Teil.
      lesenAttempt: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      sprachbausteineAttempt: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      // Reading this at all is the mistake the exam must not make.
      get studentActivity(): never {
        throw new Error('An exam must never write training activity');
      },
    };
    lesen = {
      getSubmissionRules: jest.fn().mockResolvedValue({
        answerKey: { '1': 'a', '2': 'b', '3': 'c', '4': 'd' },
        allowedAnswers: {},
      }),
    };
    sprachbausteine = {
      getAnswerKey: jest.fn().mockResolvedValue({
        answers: { '21': '21b', '22': '22a' },
        allowedAnswers: {},
        contentRevision: 'sb-1-v1',
      }),
    };
    listening = {
      getAnswerKey: jest
        .fn()
        .mockResolvedValue({ q1: 'a', q2: 'b', q3: 'c', q4: 'd', q5: 'e' }),
    };
    prisma.listeningAttempt = {
      create: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    correction = { runCorrection: jest.fn().mockResolvedValue(undefined) };
    service = new ExamScoringService(
      prisma,
      lesen,
      sprachbausteine,
      listening,
      correction,
    );
  });

  describe('what it scores', () => {
    it('marks each Teil of the block against the same key training uses', async () => {
      const scored = await service.scoreBlock({
        attemptId: ATTEMPT,
        studentId: STUDENT,
        modelltestId: MODELLTEST,
        modelltestNumber: 2,
        level: 'B1',
        gradingTier: 'MANUAL',
        block: 'LESEN_SPRACHBAUSTEINE',
        answers: {
          LESEN_1: { '1': 'a', '2': 'b', '3': 'x', '4': 'd' },
          SPRACHBAUSTEINE_1: { '21': '21b', '22': 'wrong' },
        },
      });

      expect(scored).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skill: 'LESEN', teil: '1', score: 75 }),
          expect.objectContaining({
            skill: 'SPRACHBAUSTEINE',
            teil: '1',
            score: 50,
          }),
        ]),
      );
    });

    it('scores a Teil the candidate never answered as zero, not as missing', async () => {
      // A block submitted with Teil 3 untouched is a candidate who ran out of
      // time. Leaving it absent would make the block look partly unmarked.
      const scored = await service.scoreBlock({
        attemptId: ATTEMPT,
        studentId: STUDENT,
        modelltestId: MODELLTEST,
        modelltestNumber: 2,
        level: 'B1',
        gradingTier: 'MANUAL',
        block: 'LESEN_SPRACHBAUSTEINE',
        answers: {},
      });

      expect(scored).toHaveLength(5);
      expect(scored.every((section) => section.score === 0)).toBe(true);
    });

    it('covers the five Teile telc puts in that block', async () => {
      const scored = await service.scoreBlock({
        attemptId: ATTEMPT,
        studentId: STUDENT,
        modelltestId: MODELLTEST,
        modelltestNumber: 2,
        level: 'B1',
        gradingTier: 'MANUAL',
        block: 'LESEN_SPRACHBAUSTEINE',
        answers: {},
      });

      expect(scored.map((s) => `${s.skill}_${s.teil}`)).toEqual([
        'LESEN_1',
        'LESEN_2',
        'LESEN_3',
        'SPRACHBAUSTEINE_1',
        'SPRACHBAUSTEINE_2',
      ]);
    });
  });

  describe('what it writes', () => {
    it('stamps every attempt row with the exam it belongs to', async () => {
      // The column that keeps an exam out of a student's own history and out
      // of the readiness score the center reads.
      await service.scoreBlock({
        attemptId: ATTEMPT,
        studentId: STUDENT,
        modelltestId: MODELLTEST,
        modelltestNumber: 2,
        level: 'B1',
        gradingTier: 'MANUAL',
        block: 'LESEN_SPRACHBAUSTEINE',
        answers: { LESEN_1: { '1': 'a' } },
      });

      expect(prisma.lesenAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            exam_attempt_id: ATTEMPT,
            student_id: STUDENT,
          }),
        }),
      );
      expect(prisma.sprachbausteineAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ exam_attempt_id: ATTEMPT }),
        }),
      );
    });

    it('never records training activity', async () => {
      // The prisma mock throws if `studentActivity` is so much as read, so
      // this passing is the claim. An exam that moved a student's readiness
      // would make the center's dashboard lie about their practice.
      await expect(
        service.scoreBlock({
          attemptId: ATTEMPT,
          studentId: STUDENT,
          modelltestId: MODELLTEST,
          modelltestNumber: 2,
          level: 'B1',
          gradingTier: 'MANUAL',
          block: 'LESEN_SPRACHBAUSTEINE',
          answers: { LESEN_1: { '1': 'a' } },
        }),
      ).resolves.toBeDefined();
    });

    it('writes one row per Teil, so a result can be read Teil by Teil', async () => {
      await service.scoreBlock({
        attemptId: ATTEMPT,
        studentId: STUDENT,
        modelltestId: MODELLTEST,
        modelltestNumber: 2,
        level: 'B1',
        gradingTier: 'MANUAL',
        block: 'LESEN_SPRACHBAUSTEINE',
        answers: {},
      });

      expect(prisma.lesenAttempt.create).toHaveBeenCalledTimes(3);
      expect(prisma.sprachbausteineAttempt.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('Hören', () => {
    it('marks each Teil against the key training marks with', async () => {
      const scored = await service.scoreBlock({
        attemptId: ATTEMPT,
        studentId: STUDENT,
        modelltestId: MODELLTEST,
        modelltestNumber: 2,
        level: 'B1',
        gradingTier: 'MANUAL',
        block: 'HOEREN',
        answers: { HOEREN_1: { q1: 'a', q2: 'b', q3: 'c', q4: 'd', q5: 'x' } },
      });

      expect(scored[0]).toMatchObject({
        skill: 'HOEREN',
        teil: '1',
        score: 80,
        pending: false,
      });
      expect(listening.getAnswerKey).toHaveBeenCalledWith(2, 1);
    });

    it('stamps the attempt rows with the exam, as the others do', async () => {
      await service.scoreBlock({
        attemptId: ATTEMPT,
        studentId: STUDENT,
        modelltestId: MODELLTEST,
        modelltestNumber: 2,
        level: 'B1',
        gradingTier: 'MANUAL',
        block: 'HOEREN',
        answers: {},
      });

      expect(prisma.listeningAttempt.create).toHaveBeenCalledTimes(3);
      expect(prisma.listeningAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            exam_attempt_id: ATTEMPT,
            // The Teil number alone, as training writes it. 'teil1' made the
            // history reader parse Number('teil1') and get NaN.
            exercise_id: '1',
          }),
        }),
      );
    });
  });

  describe('marking twice', () => {
    it('clears what a previous marking left, so a retry does not double it', async () => {
      // Marking is not in the same transaction as closing the block, so a
      // submit whose marking failed must be safe to re-run.
      await service.scoreBlock({
        attemptId: ATTEMPT,
        studentId: STUDENT,
        modelltestId: MODELLTEST,
        modelltestNumber: 2,
        level: 'B1',
        gradingTier: 'MANUAL',
        block: 'LESEN_SPRACHBAUSTEINE',
        answers: {},
      });

      expect(prisma.lesenAttempt.deleteMany).toHaveBeenCalledWith({
        where: { exam_attempt_id: ATTEMPT },
      });
      expect(prisma.sprachbausteineAttempt.deleteMany).toHaveBeenCalled();
    });

    it('leaves the other blocks alone', async () => {
      // Marking Hören must not wipe the Lesen rows already stored.
      await service.scoreBlock({
        attemptId: ATTEMPT,
        studentId: STUDENT,
        modelltestId: MODELLTEST,
        modelltestNumber: 2,
        level: 'B1',
        gradingTier: 'MANUAL',
        block: 'HOEREN',
        answers: {},
      });

      expect(prisma.listeningAttempt.deleteMany).toHaveBeenCalled();
      expect(prisma.lesenAttempt.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('the AI tier', () => {
    const writeSchreiben = (
      gradingTier: 'MANUAL' | 'AI',
      extra: Record<string, unknown> = {},
      writingExercise?: { findFirst: jest.Mock },
    ) => {
      prisma.writingAttempt = {
        create: jest.fn().mockResolvedValue({ attempt_id: 'writing-1' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      };
      prisma.writingExercise = writingExercise ?? {
        findFirst: jest.fn().mockResolvedValue({
          id: 'task-a',
          part: 1,
          title: 'Bitte um Informationen',
        }),
      };
      return service.scoreBlock({
        attemptId: ATTEMPT,
        studentId: STUDENT,
        modelltestId: MODELLTEST,
        modelltestNumber: 2,
        level: 'B1',
        gradingTier,
        block: 'SCHREIBEN',
        answers: { SCHREIBEN_1: { text: 'Sehr geehrte Damen und Herren', ...extra } },
      });
    };

    /**
     * The trainer has to know which Aufgabe the letter answers.
     *
     * telc B2 offers two Schreiben tasks and the candidate answers exactly
     * one. The attempt recorded only `exam-<modelltestId>`, so a trainer
     * opening the marking screen saw a letter with no way to tell which
     * prompt it was written for — and criterion I is precisely whether the
     * required points of that prompt were addressed.
     *
     * Storing the chosen task's own id also repairs the AI tier. The
     * placeholder was passed to runCorrection as its exerciseId, where
     * getExercise cannot resolve it, so the suggestion was generated with no
     * task at all and no Leitpunkte cap.
     */
    it('records the chosen task, not a placeholder', async () => {
      await writeSchreiben('MANUAL', { taskId: 'task-a' });

      expect(prisma.writingAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ exercise_id: 'task-a' }),
        }),
      );
    });

    it('falls back to the single task when the client names none', async () => {
      // B1 has one Schreiben task and clients that predate the choice send no
      // taskId. The attempt must still name a resolvable exercise.
      await writeSchreiben('MANUAL');

      expect(prisma.writingAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ exercise_id: 'task-a' }),
        }),
      );
    });

    it('gives the model a resolvable exercise id', async () => {
      await writeSchreiben('AI', { taskId: 'task-a' });

      expect(correction.runCorrection).toHaveBeenCalledWith(
        expect.objectContaining({ exerciseId: 'task-a' }),
      );
    });

    it('refuses a task that belongs to another Modelltest', async () => {
      // The id arrives from the candidate's client. Resolving it without
      // scoping to this Modelltest would let a submission name any task in
      // the catalogue and be marked against a prompt it never saw.
      const scopedMiss = { findFirst: jest.fn().mockResolvedValue(null) };

      await expect(
        writeSchreiben('MANUAL', { taskId: 'someone-elses-task' }, scopedMiss),
      ).rejects.toThrow();
      expect(scopedMiss.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ modelltest_id: MODELLTEST }),
        }),
      );
    });

    it('asks the model for a suggestion when the center bought it', async () => {
      await writeSchreiben('AI');

      expect(correction.runCorrection).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptId: 'writing-1',
          studentId: STUDENT,
          content: 'Sehr geehrte Damen und Herren',
        }),
      );
    });

    it('never sends the candidate the suggestion', async () => {
      // The correction service pushes score and feedback to the student's
      // socket when it finishes. In an exam that would hand a candidate
      // their Schreiben mark before a human had read it and before the
      // center released anything.
      await writeSchreiben('AI');

      expect(correction.runCorrection).toHaveBeenCalledWith(
        expect.objectContaining({ notify: false }),
      );
    });

    it('asks for nothing at all on a manual sitting', async () => {
      // Not "runs it and hides it". The difference is what the center paid
      // for, and a model call costs money.
      await writeSchreiben('MANUAL');

      expect(correction.runCorrection).not.toHaveBeenCalled();
    });

    it('still reports Schreiben as needing a person', async () => {
      // A suggestion is not a mark. The result stays INCOMPLETE until
      // somebody types a number.
      const scored = await writeSchreiben('AI');

      expect(scored[0]).toMatchObject({ score: null, pending: true });
    });

    it('does not let a model failure cost a candidate their Schreiben', async () => {
      correction.runCorrection.mockRejectedValue(new Error('model timeout'));

      await expect(writeSchreiben('AI')).resolves.toBeDefined();
      expect(prisma.writingAttempt.create).toHaveBeenCalled();
    });
  });

  describe('Schreiben', () => {
    it('stores the text and scores nothing, because a human marks it', async () => {
      const writing = {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      };
      prisma.writingAttempt = writing;
      prisma.writingExercise = {
        findFirst: jest.fn().mockResolvedValue({ id: 'task-a' }),
      };

      const scored = await service.scoreBlock({
        attemptId: ATTEMPT,
        studentId: STUDENT,
        modelltestId: MODELLTEST,
        modelltestNumber: 2,
        level: 'B1',
        gradingTier: 'MANUAL',
        block: 'SCHREIBEN',
        answers: { SCHREIBEN_1: { text: 'Sehr geehrte Damen und Herren' } },
      });

      expect(scored).toEqual([
        expect.objectContaining({
          skill: 'SCHREIBEN',
          teil: '1',
          score: null,
          pending: true,
        }),
      ]);
      expect(writing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ exam_attempt_id: ATTEMPT }),
        }),
      );
    });
  });
});
