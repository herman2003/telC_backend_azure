/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { ExamSittingService } from '../src/modules/centers/exam-sitting.service';
import { ExamSessionPolicyService } from '../src/modules/centers/exam-session-policy.service';

/**
 * A candidate sitting an exam: starting it, and starting each timed block.
 *
 * The rules here are about refusals and about ordering, which is what a mock
 * can say something about. That a deadline survives a refresh is a claim
 * about a stored instant, and lives in the integration spec.
 */
describe('ExamSittingService', () => {
  const STUDENT = 'student-1';
  const HOUR = 60 * 60 * 1000;

  const openSession = (over: Record<string, unknown> = {}) => ({
    id: 'session-1',
    level: 'B1',
    modelltest_id: 'mt-1',
    opens_at: new Date(Date.now() - HOUR),
    closes_at: new Date(Date.now() + HOUR),
    published_at: new Date(Date.now() - 48 * HOUR),
    cancelled_at: null,
    force_closed_at: null,
    ...over,
  });

  const durations = [
    { block: 'LESEN_SPRACHBAUSTEINE', minutes: 90, position: 1 },
    { block: 'HOEREN', minutes: 30, position: 2 },
    { block: 'SCHREIBEN', minutes: 30, position: 3 },
  ];

  let prisma: any;
  let service: ExamSittingService;

  beforeEach(() => {
    prisma = {
      examSessionParticipant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'participant-1' }),
      },
      examSession: { findUnique: jest.fn().mockResolvedValue(openSession()) },
      examAttempt: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'attempt-1',
          started_at: new Date(),
          submitted_at: null,
          // The real select carries the session, because the view needs the
          // level to know what the blocks are.
          session: openSession(),
          blocks: [],
          ...data,
        })),
      },
      examBlockDuration: { findMany: jest.fn().mockResolvedValue(durations) },
      examAttemptBlock: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'block-1',
          ...data,
        })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new ExamSittingService(prisma, new ExamSessionPolicyService());
  });

  describe('starting the exam', () => {
    it('lets an admitted candidate start while the sitting is open', async () => {
      const attempt = await service.start(STUDENT, 'session-1');

      expect(attempt).toMatchObject({ id: 'attempt-1' });
      expect(prisma.examAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            session_id: 'session-1',
            student_id: STUDENT,
          }),
        }),
      );
    });

    it('refuses a student nobody admitted', async () => {
      // The access rule. Having an account, or even a seat at the center
      // running the exam, opens nothing.
      prisma.examSessionParticipant.findUnique.mockResolvedValue(null);

      await expect(service.start(STUDENT, 'session-1')).rejects.toThrow(
        'NOT_A_PARTICIPANT',
      );
      expect(prisma.examAttempt.create).not.toHaveBeenCalled();
    });

    it.each([
      ['it has not opened', { opens_at: new Date(Date.now() + HOUR) }],
      ['its window passed', { closes_at: new Date(Date.now() - 1) }],
      ['the center closed it', { force_closed_at: new Date() }],
      ['it was cancelled', { cancelled_at: new Date() }],
      ['it is still a draft', { published_at: null }],
    ])('refuses to start when %s', async (_case, over) => {
      prisma.examSession.findUnique.mockResolvedValue(openSession(over));

      await expect(service.start(STUDENT, 'session-1')).rejects.toThrow(
        'EXAM_NOT_OPEN',
      );
    });

    it('returns the first attempt rather than making a second', async () => {
      // An exam you can restart is not an exam.
      prisma.examAttempt.findUnique.mockResolvedValue({
        id: 'attempt-1',
        student_id: STUDENT,
        started_at: new Date(),
        submitted_at: null,
        session: openSession(),
        blocks: [],
      });

      await expect(service.start(STUDENT, 'session-1')).resolves.toMatchObject({
        id: 'attempt-1',
      });
      expect(prisma.examAttempt.create).not.toHaveBeenCalled();
    });
  });

  describe('starting a block', () => {
    const attemptRow = (blocks: unknown[] = []) => ({
      id: 'attempt-1',
      student_id: STUDENT,
      started_at: new Date(),
      submitted_at: null,
      session: openSession(),
      blocks,
    });

    beforeEach(() => {
      prisma.examAttempt.findUnique.mockResolvedValue(attemptRow());
    });

    it('gives the first block telc ninety minutes, as an instant', async () => {
      const started = await service.startBlock(
        STUDENT,
        'attempt-1',
        'LESEN_SPRACHBAUSTEINE',
      );

      expect(started.remainingSeconds).toBe(90 * 60);
      expect(started.deadlineAt.getTime() - started.serverNow.getTime()).toBe(
        90 * 60 * 1000,
      );
    });

    it('refuses a block out of turn', async () => {
      // telc runs them in order, and Hören before Lesen is a different exam.
      await expect(
        service.startBlock(STUDENT, 'attempt-1', 'HOEREN'),
      ).rejects.toThrow('BLOCK_OUT_OF_ORDER');
    });

    it('allows the next block once the one before it is submitted', async () => {
      prisma.examAttempt.findUnique.mockResolvedValue(
        attemptRow([
          {
            block: 'LESEN_SPRACHBAUSTEINE',
            started_at: new Date(Date.now() - 2 * HOUR),
            deadline_at: new Date(Date.now() - HOUR),
            submitted_at: new Date(Date.now() - HOUR),
          },
        ]),
      );

      await expect(
        service.startBlock(STUDENT, 'attempt-1', 'HOEREN'),
      ).resolves.toMatchObject({ remainingSeconds: 30 * 60 });
    });

    it('refuses to start a second block while one is still running', async () => {
      prisma.examAttempt.findUnique.mockResolvedValue(
        attemptRow([
          {
            block: 'LESEN_SPRACHBAUSTEINE',
            started_at: new Date(),
            deadline_at: new Date(Date.now() + HOUR),
            submitted_at: null,
          },
        ]),
      );

      await expect(
        service.startBlock(STUDENT, 'attempt-1', 'HOEREN'),
      ).rejects.toThrow('BLOCK_IN_PROGRESS');
    });

    it('hands back the same deadline when a block is started twice', async () => {
      // A refresh looks exactly like a second start. Issuing a fresh deadline
      // would hand back the time already spent.
      const deadline = new Date(Date.now() + 42 * 60 * 1000);
      prisma.examAttempt.findUnique.mockResolvedValue(
        attemptRow([
          {
            block: 'LESEN_SPRACHBAUSTEINE',
            started_at: new Date(Date.now() - 48 * 60 * 1000),
            deadline_at: deadline,
            submitted_at: null,
          },
        ]),
      );

      const resumed = await service.startBlock(
        STUDENT,
        'attempt-1',
        'LESEN_SPRACHBAUSTEINE',
      );

      expect(resumed.deadlineAt).toEqual(deadline);
      expect(prisma.examAttemptBlock.create).not.toHaveBeenCalled();
    });

    it('refuses to reopen a block that was submitted', async () => {
      prisma.examAttempt.findUnique.mockResolvedValue(
        attemptRow([
          {
            block: 'LESEN_SPRACHBAUSTEINE',
            started_at: new Date(Date.now() - 2 * HOUR),
            deadline_at: new Date(Date.now() - HOUR),
            submitted_at: new Date(Date.now() - HOUR),
          },
        ]),
      );

      await expect(
        service.startBlock(STUDENT, 'attempt-1', 'LESEN_SPRACHBAUSTEINE'),
      ).rejects.toThrow('BLOCK_ALREADY_SUBMITTED');
    });

    it('lets a candidate finish an exam whose window closed mid-sitting', async () => {
      // The window governs STARTING the exam. Someone who began at 08:59 and
      // is on Schreiben at 09:01 must be allowed to finish what they began.
      prisma.examAttempt.findUnique.mockResolvedValue({
        ...attemptRow([
          {
            block: 'LESEN_SPRACHBAUSTEINE',
            started_at: new Date(Date.now() - 2 * HOUR),
            deadline_at: new Date(Date.now() - HOUR),
            submitted_at: new Date(Date.now() - HOUR),
          },
        ]),
        session: openSession({ closes_at: new Date(Date.now() - 60_000) }),
      });

      await expect(
        service.startBlock(STUDENT, 'attempt-1', 'HOEREN'),
      ).resolves.toMatchObject({ remainingSeconds: 30 * 60 });
    });

    it('refuses an attempt belonging to another student', async () => {
      // 404, never 403: a 403 would confirm the attempt exists.
      prisma.examAttempt.findUnique.mockResolvedValue({
        ...attemptRow(),
        student_id: 'someone-else',
      });

      await expect(
        service.startBlock(STUDENT, 'attempt-1', 'LESEN_SPRACHBAUSTEINE'),
      ).rejects.toThrow('EXAM_ATTEMPT_NOT_FOUND');
    });
  });

  describe('how much time is left', () => {
    it('reports the remaining seconds from the stored instant', async () => {
      prisma.examAttempt.findUnique.mockResolvedValue({
        id: 'attempt-1',
        student_id: STUDENT,
        started_at: new Date(),
        submitted_at: null,
        session: openSession(),
        blocks: [
          {
            block: 'LESEN_SPRACHBAUSTEINE',
            started_at: new Date(Date.now() - 38 * 60 * 1000),
            deadline_at: new Date(Date.now() + 52 * 60 * 1000),
            submitted_at: null,
          },
        ],
      });

      const view = await service.getAttempt(STUDENT, 'attempt-1');

      expect(view.blocks[0]).toMatchObject({
        block: 'LESEN_SPRACHBAUSTEINE',
        remainingSeconds: 52 * 60,
        state: 'RUNNING',
      });
      expect(view.serverNow).toBeInstanceOf(Date);
    });

    it('reports zero rather than a negative for a block whose time went', async () => {
      prisma.examAttempt.findUnique.mockResolvedValue({
        id: 'attempt-1',
        student_id: STUDENT,
        started_at: new Date(),
        submitted_at: null,
        session: openSession(),
        blocks: [
          {
            block: 'LESEN_SPRACHBAUSTEINE',
            started_at: new Date(Date.now() - 2 * HOUR),
            deadline_at: new Date(Date.now() - HOUR),
            submitted_at: null,
          },
        ],
      });

      const view = await service.getAttempt(STUDENT, 'attempt-1');

      expect(view.blocks[0]).toMatchObject({
        remainingSeconds: 0,
        state: 'EXPIRED',
      });
    });
  });
});
