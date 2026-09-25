/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { ExamReleaseService } from '../src/modules/centers/exam-release.service';

/**
 * Letting a candidate see their result.
 *
 * Nothing reaches a student until the center says so, and the center may say
 * so more than once — the written marks now, the verdict after the oral.
 *
 * What is released is a snapshot, not a view. A candidate told they passed
 * must not find that changed because somebody re-marked afterwards; if the
 * center wants them to see a correction, it releases again, deliberately.
 */
describe('ExamReleaseService', () => {
  const identity = { centerId: 'center-1', centerUserId: 'owner-1' } as never;

  const resultOf = (over: Record<string, unknown> = {}) => ({
    attemptId: 'attempt-1',
    studentId: 'student-1',
    outcome: 'PASSED',
    written: { points: 150, maxPoints: 225, percent: 67, passed: true },
    oral: { points: 50, maxPoints: 75, percent: 67, passed: true },
    sections: [{ skill: 'LESEN', teil: 1, points: 20, maxPoints: 25 }],
    awaiting: [],
    ...over,
  });

  let prisma: any;
  let results: any;
  let service: ExamReleaseService;

  beforeEach(() => {
    prisma = {
      examSession: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'session-1',
          attempts: [{ id: 'attempt-1' }, { id: 'attempt-2' }],
        }),
      },
      examAttempt: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'attempt-1',
          released_at: null,
          released_result: null,
          session: { center_id: 'center-1' },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    results = { forAttempt: jest.fn().mockResolvedValue(resultOf()) };
    service = new ExamReleaseService(prisma, results);
  });

  describe('releasing a sitting', () => {
    it('stores what each candidate was told, not a pointer to it', async () => {
      // The snapshot is the point. A view would change under a candidate the
      // moment anyone re-marked anything.
      await service.releaseSession(identity, 'session-1');

      expect(prisma.examAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            released_at: expect.any(Date),
            released_result: expect.objectContaining({ outcome: 'PASSED' }),
          }),
        }),
      );
    });

    it('releases every candidate in the sitting', async () => {
      const released = await service.releaseSession(identity, 'session-1');

      expect(prisma.examAttempt.update).toHaveBeenCalledTimes(2);
      expect(released.released).toBe(2);
    });

    it('refuses to release results that are still incomplete', async () => {
      // Releasing before the oral is marked is a real thing a center may
      // want, and a thing it should have to say out loud. A candidate who
      // later asks why they were told "pending" deserves an answer better
      // than "the dashboard sent it".
      results.forAttempt.mockResolvedValue(
        resultOf({ outcome: 'INCOMPLETE', awaiting: ['SPRECHEN'] }),
      );

      await expect(
        service.releaseSession(identity, 'session-1'),
      ).rejects.toThrow('RESULTS_INCOMPLETE');
      expect(prisma.examAttempt.update).not.toHaveBeenCalled();
    });

    it('says how many are incomplete, so the warning can name a number', async () => {
      results.forAttempt.mockResolvedValue(
        resultOf({ outcome: 'INCOMPLETE', awaiting: ['SPRECHEN'] }),
      );

      await expect(
        service.releaseSession(identity, 'session-1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          message: 'RESULTS_INCOMPLETE',
          incomplete: 2,
        }),
      });
    });

    it('releases them anyway when the center says so', async () => {
      // The written marks now, the verdict after the oral — for the
      // candidate who needs a score before the oral has happened.
      results.forAttempt.mockResolvedValue(
        resultOf({ outcome: 'INCOMPLETE', awaiting: ['SPRECHEN'] }),
      );

      const released = await service.releaseSession(identity, 'session-1', {
        allowIncomplete: true,
      });

      expect(released).toMatchObject({ released: 2, incomplete: 2 });
    });

    it('needs no permission when every mark is in', async () => {
      const released = await service.releaseSession(identity, 'session-1');

      expect(released).toMatchObject({ released: 2, incomplete: 0 });
    });

    it('replaces an earlier release rather than adding to it', async () => {
      // Re-releasing after a correction is deliberate and visible: the
      // candidate sees the new result, and released_at says when it changed.
      await service.releaseSession(identity, 'session-1');

      expect(prisma.examAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'attempt-1' },
        }),
      );
    });

    it('refuses a sitting belonging to another center', async () => {
      prisma.examSession.findFirst.mockResolvedValue(null);

      await expect(
        service.releaseSession(identity, 'session-1'),
      ).rejects.toThrow('EXAM_SESSION_NOT_FOUND');
      expect(prisma.examAttempt.update).not.toHaveBeenCalled();
    });

    it('scopes the sitting by center in the query', async () => {
      await service.releaseSession(identity, 'session-1');

      expect(prisma.examSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1', center_id: 'center-1' },
        }),
      );
    });
  });

  describe('releasing one candidate', () => {
    it('releases just them', async () => {
      await service.releaseAttempt(identity, 'attempt-1');

      expect(prisma.examAttempt.update).toHaveBeenCalledTimes(1);
    });

    it('refuses an attempt belonging to another center', async () => {
      prisma.examAttempt.findFirst.mockResolvedValue(null);

      await expect(
        service.releaseAttempt(identity, 'attempt-1'),
      ).rejects.toThrow('EXAM_ATTEMPT_NOT_FOUND');
    });
  });

  describe('what a student may read', () => {
    it('gives them exactly what was released', async () => {
      prisma.examAttempt.findFirst.mockResolvedValue({
        id: 'attempt-1',
        student_id: 'student-1',
        released_at: new Date('2026-10-12T10:00:00.000Z'),
        released_result: { outcome: 'PASSED', written: { percent: 67 } },
      });

      const mine = await service.forStudent('student-1', 'attempt-1');

      expect(mine).toMatchObject({
        outcome: 'PASSED',
        releasedAt: new Date('2026-10-12T10:00:00.000Z'),
      });
    });

    it('does not recompute, so a re-mark cannot change what they were told', async () => {
      prisma.examAttempt.findFirst.mockResolvedValue({
        id: 'attempt-1',
        student_id: 'student-1',
        released_at: new Date(),
        released_result: { outcome: 'FAILED' },
      });

      const mine = await service.forStudent('student-1', 'attempt-1');

      expect(mine.outcome).toBe('FAILED');
      expect(results.forAttempt).not.toHaveBeenCalled();
    });

    it('says there is nothing yet when the center has not released', async () => {
      // Not a partial result, not "pending marks": as far as the candidate is
      // concerned the exam has no result at all until the center says it has.
      prisma.examAttempt.findFirst.mockResolvedValue({
        id: 'attempt-1',
        student_id: 'student-1',
        released_at: null,
        released_result: null,
      });

      await expect(
        service.forStudent('student-1', 'attempt-1'),
      ).rejects.toThrow('RESULT_NOT_RELEASED');
    });

    it('refuses to show one student another student\'s result', async () => {
      prisma.examAttempt.findFirst.mockResolvedValue(null);

      await expect(
        service.forStudent('student-1', 'someone-elses'),
      ).rejects.toThrow('EXAM_ATTEMPT_NOT_FOUND');
    });
  });
});
