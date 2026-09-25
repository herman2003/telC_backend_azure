/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { ExamResultService } from '../src/modules/centers/exam-result.service';

/**
 * What a candidate scored, and whether they passed.
 *
 * telc passes the two halves separately — 60% of the written block AND 60% of
 * the oral — so someone strong on paper and silent in the room fails. No
 * combined average can say that, which is why this is not an average.
 *
 * The automatic marks are percentages per Teil; the weights turn them into
 * telc's points. A perfect Sprachbausteine is 30 points and a poor Lesen
 * costs 75, so the arithmetic has to happen in points and not in percent.
 */
describe('ExamResultService', () => {
  const ATTEMPT = 'attempt-1';

  /** telc B1, as seeded: 225 written, 75 oral. */
  const weights = [
    { skill: 'LESEN', teil: 1, max_points: 25, part: 'WRITTEN' },
    { skill: 'LESEN', teil: 2, max_points: 25, part: 'WRITTEN' },
    { skill: 'LESEN', teil: 3, max_points: 25, part: 'WRITTEN' },
    { skill: 'SPRACHBAUSTEINE', teil: 1, max_points: 15, part: 'WRITTEN' },
    { skill: 'SPRACHBAUSTEINE', teil: 2, max_points: 15, part: 'WRITTEN' },
    { skill: 'HOEREN', teil: 1, max_points: 25, part: 'WRITTEN' },
    { skill: 'HOEREN', teil: 2, max_points: 25, part: 'WRITTEN' },
    { skill: 'HOEREN', teil: 3, max_points: 25, part: 'WRITTEN' },
    { skill: 'SCHREIBEN', teil: 1, max_points: 45, part: 'WRITTEN' },
    { skill: 'SPRECHEN', teil: 1, max_points: 75, part: 'ORAL' },
  ];

  let prisma: any;
  let service: ExamResultService;

  /** Every automatic Teil at the same percentage, which keeps the sums easy
   *  to check by hand. */
  const autoAt = (percent: number) => ({
    lesen: [1, 2, 3].map((teil) => ({ teil_id: String(teil), score: percent })),
    sprachbausteine: [1, 2].map((teil) => ({
      teil_id: String(teil),
      score: percent,
    })),
    hoeren: [1, 2, 3].map((teil) => ({
      exercise_id: String(teil),
      score: percent,
    })),
  });

  const load = (percent: number, manual: unknown[] = []) => {
    const auto = autoAt(percent);
    prisma.lesenAttempt.findMany.mockResolvedValue(auto.lesen);
    prisma.sprachbausteineAttempt.findMany.mockResolvedValue(
      auto.sprachbausteine,
    );
    prisma.listeningAttempt.findMany.mockResolvedValue(auto.hoeren);
    prisma.examSectionResult.findMany.mockResolvedValue(manual);
  };

  beforeEach(() => {
    prisma = {
      examAttempt: {
        findUnique: jest.fn().mockResolvedValue({
          id: ATTEMPT,
          student_id: 'student-1',
          submitted_at: new Date(),
          released_at: null,
          session: { level: 'B1', center_id: 'center-1' },
        }),
      },
      examSectionWeight: { findMany: jest.fn().mockResolvedValue(weights) },
      examSectionResult: { findMany: jest.fn().mockResolvedValue([]) },
      lesenAttempt: { findMany: jest.fn().mockResolvedValue([]) },
      sprachbausteineAttempt: { findMany: jest.fn().mockResolvedValue([]) },
      listeningAttempt: { findMany: jest.fn().mockResolvedValue([]) },
      writingAttempt: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new ExamResultService(prisma);
  });

  describe('turning percentages into telc points', () => {
    it('weights each Teil rather than averaging them', async () => {
      // 100% of Lesen is 75 points; 100% of Sprachbausteine is 30. An average
      // would call those equal.
      load(100);

      const result = await service.forAttempt(ATTEMPT);

      const lesen = result.sections.filter((s) => s.skill === 'LESEN');
      expect(lesen.reduce((n, s) => n + (s.points ?? 0), 0)).toBe(75);
      const sb = result.sections.filter((s) => s.skill === 'SPRACHBAUSTEINE');
      expect(sb.reduce((n, s) => n + (s.points ?? 0), 0)).toBe(30);
    });

    it('rounds a Teil to whole points, because telc has no half marks', async () => {
      load(50);

      const result = await service.forAttempt(ATTEMPT);
      const teil = result.sections.find(
        (s) => s.skill === 'SPRACHBAUSTEINE' && s.teil === 1,
      )!;

      // 50% of 15 is 7.5.
      expect(teil.points).toBe(8);
    });
  });

  describe('the two halves', () => {
    it('counts the written block out of 225 and the oral out of 75', async () => {
      load(100, [{ skill: 'SCHREIBEN', teil: 1, points: 45 }, { skill: 'SPRECHEN', teil: 1, points: 75 }]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.written).toMatchObject({ points: 225, maxPoints: 225 });
      expect(result.oral).toMatchObject({ points: 75, maxPoints: 75 });
    });

    it('keeps Sprechen out of the written total', async () => {
      // A candidate who says nothing still passes the written half. Folding
      // the oral in would make one failure look like two.
      load(100, [{ skill: 'SCHREIBEN', teil: 1, points: 45 }]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.written.points).toBe(225);
      expect(result.oral.points).toBe(0);
    });
  });

  describe('pass or fail, on telc\'s rule', () => {
    it('passes only when BOTH halves reach sixty per cent', async () => {
      load(60, [{ skill: 'SCHREIBEN', teil: 1, points: 27 }, { skill: 'SPRECHEN', teil: 1, points: 45 }]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.outcome).toBe('PASSED');
    });

    it('fails a candidate who was excellent on paper and silent in the room', async () => {
      // The case an average would get wrong, and the reason telc marks the
      // halves separately.
      load(100, [
        { skill: 'SCHREIBEN', teil: 1, points: 45 },
        { skill: 'SPRECHEN', teil: 1, points: 30 },
      ]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.outcome).toBe('FAILED');
      expect(result.written.passed).toBe(true);
      expect(result.oral.passed).toBe(false);
    });

    it('fails the reverse case too', async () => {
      load(20, [
        { skill: 'SCHREIBEN', teil: 1, points: 9 },
        { skill: 'SPRECHEN', teil: 1, points: 75 },
      ]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.outcome).toBe('FAILED');
    });

    it('decides on exact points, not on what it shows', async () => {
      // 134.5 of 225 displays as 60% and is not 60%. Deciding on the rounded
      // number would pass a candidate who failed.
      load(60, [
        { skill: 'SCHREIBEN', teil: 1, points: 26 },
        { skill: 'SPRECHEN', teil: 1, points: 45 },
      ]);

      const result = await service.forAttempt(ATTEMPT);

      // 60% of each auto Teil: 15+15+15+9+9+15+15+15 = 108, +26 = 134 of 225.
      expect(result.written.points).toBe(134);
      expect(result.written.passed).toBe(false);
      expect(result.outcome).toBe('FAILED');
    });
  });

  describe('while marks are missing', () => {
    it('says incomplete rather than guessing a verdict', async () => {
      // Sprechen happens in a room, days later. Calling that a fail would
      // fail every candidate the moment they put their pen down.
      load(100, [{ skill: 'SCHREIBEN', teil: 1, points: 45 }]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.outcome).toBe('INCOMPLETE');
      expect(result.awaiting).toEqual(['SPRECHEN']);
    });

    it('names every mark it is still waiting for', async () => {
      load(100);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.awaiting).toEqual(['SCHREIBEN', 'SPRECHEN']);
    });

    it('still reports the halves, so a manager sees where they stand', async () => {
      load(100);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.written.points).toBe(180);
      expect(result.oral.points).toBe(0);
    });
  });
});
