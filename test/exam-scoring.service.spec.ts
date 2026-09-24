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
  let service: ExamScoringService;

  beforeEach(() => {
    prisma = {
      lesenAttempt: { create: jest.fn().mockResolvedValue({}) },
      sprachbausteineAttempt: { create: jest.fn().mockResolvedValue({}) },
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
    service = new ExamScoringService(prisma, lesen, sprachbausteine);
  });

  describe('what it scores', () => {
    it('marks each Teil of the block against the same key training uses', async () => {
      const scored = await service.scoreBlock({
        attemptId: ATTEMPT,
        studentId: STUDENT,
        modelltestId: MODELLTEST,
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
        block: 'LESEN_SPRACHBAUSTEINE',
        answers: {},
      });

      expect(prisma.lesenAttempt.create).toHaveBeenCalledTimes(3);
      expect(prisma.sprachbausteineAttempt.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('Schreiben', () => {
    it('stores the text and scores nothing, because a human marks it', async () => {
      const writing = { create: jest.fn().mockResolvedValue({}) };
      prisma.writingAttempt = writing;

      const scored = await service.scoreBlock({
        attemptId: ATTEMPT,
        studentId: STUDENT,
        modelltestId: MODELLTEST,
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
