/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { ExamExportService } from '../src/modules/centers/exam-export.service';

/**
 * Getting a sitting out of Lerniqo.
 *
 * Rows, not a file. Both clients already render, so a server-side PDF would
 * be a library, a font and a memory limit for nothing — and agreed with the
 * Flutter team: the server ships numbers, the client formats them.
 *
 * Which means the numbers have to be finished. A client that computed a
 * percentage would eventually disagree with the screen.
 */
describe('ExamExportService', () => {
  const CENTER = 'center-1';

  const candidate = (over: Record<string, unknown> = {}) => ({
    studentId: 'student-1',
    attemptId: 'attempt-1',
    firstName: 'Marie',
    lastName: 'Ngono',
    email: 'marie@example.com',
    outcome: 'PASSED',
    written: { points: 158, maxPoints: 225, percent: 70, passed: true },
    oral: { points: 50, maxPoints: 75, percent: 67, passed: true },
    awaiting: [],
    releasedAt: null,
    ...over,
  });

  let results: any;
  let prisma: any;
  let service: ExamExportService;

  beforeEach(() => {
    prisma = {
      examSession: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'session-1',
          name: 'Examen B1 — Octobre',
          level: 'B1',
          opens_at: new Date('2026-10-05T09:00:00.000Z'),
          closes_at: new Date('2026-10-07T09:00:00.000Z'),
          modelltest: { number: 2, title: 'Modelltest 2' },
          center: { name: 'Centre Lerniqo Douala' },
        }),
      },
    };
    results = {
      forSession: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        candidates: [candidate()],
        summary: {
          candidates: 1,
          awaitingMarks: 0,
          released: 0,
          passed: 1,
          failed: 0,
        },
      }),
      forAttempts: jest.fn().mockResolvedValue([
        {
          attemptId: 'attempt-1',
          studentId: 'student-1',
          sections: [
            { skill: 'LESEN', teil: 1, points: 20, maxPoints: 25, percent: 80 },
            {
              skill: 'SPRECHEN',
              teil: 1,
              points: 50,
              maxPoints: 75,
              percent: 67,
            },
          ],
        },
      ]),
    };
    service = new ExamExportService(prisma, results);
  });

  describe('what it returns', () => {
    it('heads the file with who sat what, and when', async () => {
      // A spreadsheet found in two years has to say which exam it was.
      const exported = await service.forSession(CENTER, 'session-1');

      expect(exported.sitting).toMatchObject({
        name: 'Examen B1 — Octobre',
        level: 'B1',
        modelltest: 2,
        centerName: 'Centre Lerniqo Douala',
      });
    });

    it('gives one row per candidate, with the numbers already worked out', async () => {
      // The rule agreed with the Flutter team: the client formats, never
      // calculates. A percentage computed twice is a percentage that
      // eventually disagrees with the screen.
      const exported = await service.forSession(CENTER, 'session-1');

      expect(exported.rows).toHaveLength(1);
      expect(exported.rows[0]).toMatchObject({
        lastName: 'Ngono',
        writtenPoints: 158,
        writtenPercent: 70,
        oralPoints: 50,
        outcome: 'PASSED',
      });
    });

    it('breaks each candidate down Teil by Teil', async () => {
      const exported = await service.forSession(CENTER, 'session-1');

      expect(exported.rows[0].sections).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skill: 'LESEN', teil: 1, points: 20 }),
        ]),
      );
    });

    it('says plainly when a mark is missing rather than writing a zero', async () => {
      // A blank cell and a zero mean different things to whoever reads the
      // spreadsheet, and only one of them is true.
      results.forSession.mockResolvedValue({
        sessionId: 'session-1',
        candidates: [
          candidate({
            outcome: 'INCOMPLETE',
            awaiting: ['SPRECHEN'],
            oral: { points: 0, maxPoints: 75, percent: 0, passed: false },
          }),
        ],
        summary: {
          candidates: 1,
          awaitingMarks: 1,
          released: 0,
          passed: 0,
          failed: 0,
        },
      });

      const exported = await service.forSession(CENTER, 'session-1');

      expect(exported.rows[0]).toMatchObject({
        outcome: 'INCOMPLETE',
        oralPoints: null,
        awaiting: ['SPRECHEN'],
      });
    });

    it('carries a candidate who never turned up, with no numbers', async () => {
      results.forSession.mockResolvedValue({
        sessionId: 'session-1',
        candidates: [
          candidate({
            outcome: 'NOT_TAKEN',
            attemptId: null,
            written: null,
            oral: null,
          }),
        ],
        summary: {
          candidates: 1,
          awaitingMarks: 0,
          released: 0,
          passed: 0,
          failed: 0,
        },
      });

      const exported = await service.forSession(CENTER, 'session-1');

      expect(exported.rows[0]).toMatchObject({
        outcome: 'NOT_TAKEN',
        writtenPoints: null,
        sections: [],
      });
    });

    it('carries the summary, so a printed page can say 12 of 15 passed', async () => {
      const exported = await service.forSession(CENTER, 'session-1');

      expect(exported.summary).toMatchObject({ candidates: 1, passed: 1 });
    });
  });

  describe('what it refuses', () => {
    it('refuses a sitting belonging to another center', async () => {
      prisma.examSession.findFirst.mockResolvedValue(null);

      await expect(service.forSession(CENTER, 'session-1')).rejects.toThrow(
        'EXAM_SESSION_NOT_FOUND',
      );
      expect(results.forSession).not.toHaveBeenCalled();
    });

    it('scopes the sitting by center in the query', async () => {
      await service.forSession(CENTER, 'session-1');

      expect(prisma.examSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1', center_id: CENTER },
        }),
      );
    });
  });

  describe('how many queries', () => {
    it('does not read the sections one candidate at a time', async () => {
      // A file is the place an N+1 hurts most: nobody waits for a table, but
      // everybody waits for a download.
      await service.forSession(CENTER, 'session-1');

      expect(results.forAttempts).toHaveBeenCalledTimes(1);
    });
  });
});
