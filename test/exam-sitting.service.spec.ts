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
        count: jest.fn().mockResolvedValue(0),
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

      // The exact claim: the deadline is ninety minutes after the START,
      // both read from one instant. serverNow is a different, later instant —
      // it is the clock at the moment of answering — so comparing against it
      // is a claim about how long the call took.
      expect(started.deadlineAt.getTime() - started.startedAt.getTime()).toBe(
        90 * 60 * 1000,
      );
      expect(started.remainingSeconds).toBe(90 * 60);
      expect(started.serverNow.getTime()).toBeGreaterThanOrEqual(
        started.startedAt.getTime(),
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

  describe('saving as the candidate goes', () => {
    const running = (over: Record<string, unknown> = {}) => ({
      id: 'attempt-1',
      student_id: STUDENT,
      started_at: new Date(),
      submitted_at: null,
      session: openSession(),
      blocks: [
        {
          block: 'LESEN_SPRACHBAUSTEINE',
          started_at: new Date(Date.now() - 10 * 60 * 1000),
          deadline_at: new Date(Date.now() + 80 * 60 * 1000),
          submitted_at: null,
          answers: { '1': 'a' },
          ...over,
        },
      ],
    });

    beforeEach(() => {
      prisma.examAttempt.findUnique.mockResolvedValue(running());
      prisma.examAttempt.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    });

    it('stores the whole answer set, not a delta', async () => {
      // A client that has to merge is a client that can lose an answer.
      await service.saveAnswers(STUDENT, 'attempt-1', 'LESEN_SPRACHBAUSTEINE', {
        '1': 'b',
        '2': 'c',
      });

      expect(prisma.examAttemptBlock.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { answers: { '1': 'b', '2': 'c' } } }),
      );
    });

    it('refuses to save once the time has gone', async () => {
      prisma.examAttempt.findUnique.mockResolvedValue(
        running({ deadline_at: new Date(Date.now() - 1000) }),
      );

      await expect(
        service.saveAnswers(STUDENT, 'attempt-1', 'LESEN_SPRACHBAUSTEINE', {}),
      ).rejects.toThrow('BLOCK_EXPIRED');
    });

    it('carries the deadline into the statement, not only the check', async () => {
      // An autosave in flight when the clock runs out must not land after it.
      await service.saveAnswers(
        STUDENT,
        'attempt-1',
        'LESEN_SPRACHBAUSTEINE',
        {},
      );

      expect(prisma.examAttemptBlock.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            submitted_at: null,
            deadline_at: { gt: expect.any(Date) },
          }),
        }),
      );
    });

    it('refuses to save into a block that was submitted', async () => {
      prisma.examAttempt.findUnique.mockResolvedValue(
        running({ submitted_at: new Date() }),
      );

      await expect(
        service.saveAnswers(STUDENT, 'attempt-1', 'LESEN_SPRACHBAUSTEINE', {}),
      ).rejects.toThrow('BLOCK_ALREADY_SUBMITTED');
    });
  });

  describe('submitting a block', () => {
    const running = (over: Record<string, unknown> = {}) => ({
      id: 'attempt-1',
      student_id: STUDENT,
      started_at: new Date(),
      submitted_at: null,
      session: openSession(),
      blocks: [
        {
          block: 'LESEN_SPRACHBAUSTEINE',
          started_at: new Date(Date.now() - 10 * 60 * 1000),
          deadline_at: new Date(Date.now() + 80 * 60 * 1000),
          submitted_at: null,
          answers: { '1': 'saved' },
          ...over,
        },
      ],
    });

    beforeEach(() => {
      prisma.examAttempt.findUnique.mockResolvedValue(running());
      prisma.examAttempt.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    });

    it('takes the answers sent with a submit made in time', async () => {
      const result = await service.submitBlock(
        STUDENT,
        'attempt-1',
        'LESEN_SPRACHBAUSTEINE',
        { '1': 'final' },
      );

      expect(result).toMatchObject({ late: false, answers: { '1': 'final' } });
    });

    it('accepts a late submit but scores what was saved in time', async () => {
      // The app auto-submits at 00:00 and that request can arrive a moment
      // later. Refusing would leave the block open and unscored for ever;
      // taking the late answers would hand back time nobody had.
      prisma.examAttempt.findUnique.mockResolvedValue(
        running({ deadline_at: new Date(Date.now() - 1000) }),
      );

      const result = await service.submitBlock(
        STUDENT,
        'attempt-1',
        'LESEN_SPRACHBAUSTEINE',
        { '1': 'too-late' },
      );

      expect(result).toMatchObject({ late: true, answers: { '1': 'saved' } });
    });

    it('closes the block with a claim, so two submits close it once', async () => {
      prisma.examAttemptBlock.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.submitBlock(STUDENT, 'attempt-1', 'LESEN_SPRACHBAUSTEINE'),
      ).rejects.toThrow('BLOCK_ALREADY_SUBMITTED');
    });

    it('leaves the attempt open while blocks remain', async () => {
      prisma.examAttemptBlock.count.mockResolvedValue(1);

      await service.submitBlock(STUDENT, 'attempt-1', 'LESEN_SPRACHBAUSTEINE');

      expect(prisma.examAttempt.updateMany).not.toHaveBeenCalled();
    });

    it('finishes the attempt when its last block is in', async () => {
      // Derived from the blocks rather than announced by the client, so an
      // app that stops early leaves an attempt visibly unfinished.
      prisma.examAttemptBlock.count.mockResolvedValue(3);

      await service.submitBlock(STUDENT, 'attempt-1', 'LESEN_SPRACHBAUSTEINE');

      expect(prisma.examAttempt.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'attempt-1', submitted_at: null },
        }),
      );
    });

    it('refuses to submit a block that never started', async () => {
      prisma.examAttempt.findUnique.mockResolvedValue({
        ...running(),
        blocks: [],
      });

      await expect(
        service.submitBlock(STUDENT, 'attempt-1', 'HOEREN'),
      ).rejects.toThrow('BLOCK_NOT_STARTED');
    });
  });

  describe('a sitting the center called off', () => {
    const cancelled = () => ({
      id: 'attempt-1',
      student_id: STUDENT,
      started_at: new Date(),
      submitted_at: null,
      session: openSession({ cancelled_at: new Date() }),
      blocks: [
        {
          block: 'LESEN_SPRACHBAUSTEINE',
          started_at: new Date(),
          deadline_at: new Date(Date.now() + HOUR),
          submitted_at: null,
          answers: {},
        },
      ],
    });

    beforeEach(() => {
      prisma.examAttempt.findUnique.mockResolvedValue(cancelled());
      prisma.examAttempt.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    });

    it('stops a candidate already inside it', async () => {
      // Cancelling has to reach the people sitting it. Otherwise a center
      // calls an exam off and candidates carry on taking it.
      await expect(
        service.startBlock(STUDENT, 'attempt-1', 'HOEREN'),
      ).rejects.toThrow('EXAM_CANCELLED');
    });

    it('stops them saving into it', async () => {
      await expect(
        service.saveAnswers(STUDENT, 'attempt-1', 'LESEN_SPRACHBAUSTEINE', {}),
      ).rejects.toThrow('EXAM_CANCELLED');
    });

    it('stops them submitting it', async () => {
      await expect(
        service.submitBlock(STUDENT, 'attempt-1', 'LESEN_SPRACHBAUSTEINE'),
      ).rejects.toThrow('EXAM_CANCELLED');
    });

    it('refuses to hand back the attempt as startable', async () => {
      await expect(service.start(STUDENT, 'session-1')).rejects.toThrow(
        'EXAM_CANCELLED',
      );
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
