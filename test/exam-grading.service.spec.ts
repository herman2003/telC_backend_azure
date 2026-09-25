/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { ExamGradingService } from '../src/modules/centers/exam-grading.service';

/**
 * A mark a person gives.
 *
 * Only two: Schreiben, which a trainer reads, and Sprechen, which happened in
 * a room with an examiner. Everything else the server decided, and letting a
 * person overwrite it would make an exam negotiable.
 *
 * Every mark carries who gave it and when, because a grade is the one number
 * somebody may later be asked to defend.
 */
describe('ExamGradingService', () => {
  const identity = { centerId: 'center-1', centerUserId: 'owner-1' } as never;
  const ATTEMPT = 'attempt-1';

  let prisma: any;
  let service: ExamGradingService;

  beforeEach(() => {
    prisma = {
      examAttempt: {
        findFirst: jest.fn().mockResolvedValue({
          id: ATTEMPT,
          submitted_at: new Date(),
          session: { level: 'B1', center_id: 'center-1' },
        }),
      },
      examSectionWeight: {
        // telc's real weights: Schreiben is 45 and Sprechen 75. One number
        // for both made a legitimate oral mark look like a typo.
        findUnique: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve(
            where.level_skill_teil.skill === 'SPRECHEN'
              ? { max_points: 75 }
              : { max_points: 45 },
          ),
        ),
      },
      examSectionResult: {
        upsert: jest.fn().mockImplementation(({ create }) => ({
          ...create,
          graded_at: new Date(),
        })),
      },
    };
    service = new ExamGradingService(prisma);
  });

  describe('recording one', () => {
    it('stores the mark with who gave it', async () => {
      const recorded = await service.recordMark(identity, ATTEMPT, {
        skill: 'SCHREIBEN',
        teil: 1,
        points: 32,
      });

      expect(prisma.examSectionResult.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            attempt_id: ATTEMPT,
            skill: 'SCHREIBEN',
            teil: 1,
            points: 32,
            graded_by: 'owner-1',
          }),
        }),
      );
      expect(recorded).toMatchObject({ points: 32, gradedBy: 'owner-1' });
    });

    it('keeps the examiner\'s note, for the oral that happened elsewhere', async () => {
      await service.recordMark(identity, ATTEMPT, {
        skill: 'SPRECHEN',
        teil: 1,
        points: 50,
        note: 'Oral on 12 Oct, examiner K. Mbarga',
      });

      expect(prisma.examSectionResult.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            note: 'Oral on 12 Oct, examiner K. Mbarga',
          }),
        }),
      );
    });

    it('re-marks in place, and records who changed it', async () => {
      // A second opinion, or a correction after a complaint. The row is the
      // current mark; who gave it must move with it.
      await service.recordMark(identity, ATTEMPT, {
        skill: 'SCHREIBEN',
        teil: 1,
        points: 40,
      });

      expect(prisma.examSectionResult.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            attempt_id_skill_teil: {
              attempt_id: ATTEMPT,
              skill: 'SCHREIBEN',
              teil: 1,
            },
          },
          update: expect.objectContaining({
            points: 40,
            graded_by: 'owner-1',
            graded_at: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('what it refuses', () => {
    it.each(['LESEN', 'HOEREN', 'SPRACHBAUSTEINE'])(
      'refuses to let a person overwrite %s',
      async (skill) => {
        // The server marked these against an answer key. A person changing
        // one would make an exam negotiable.
        await expect(
          service.recordMark(identity, ATTEMPT, {
            skill: skill as never,
            teil: 1,
            points: 20,
          }),
        ).rejects.toThrow('SKILL_NOT_HUMAN_MARKED');
      },
    );

    it('refuses more points than the Teil is worth', async () => {
      await expect(
        service.recordMark(identity, ATTEMPT, {
          skill: 'SCHREIBEN',
          teil: 1,
          points: 46,
        }),
      ).rejects.toThrow('POINTS_ABOVE_MAXIMUM');
    });

    it('accepts full marks, which is not above the maximum', async () => {
      await expect(
        service.recordMark(identity, ATTEMPT, {
          skill: 'SCHREIBEN',
          teil: 1,
          points: 45,
        }),
      ).resolves.toMatchObject({ points: 45 });
    });

    it('refuses a negative mark', async () => {
      await expect(
        service.recordMark(identity, ATTEMPT, {
          skill: 'SCHREIBEN',
          teil: 1,
          points: -1,
        }),
      ).rejects.toThrow('POINTS_INVALID');
    });

    it('refuses a Teil this level does not have', async () => {
      prisma.examSectionWeight.findUnique.mockResolvedValue(null);

      await expect(
        service.recordMark(identity, ATTEMPT, {
          skill: 'SCHREIBEN',
          teil: 7,
          points: 10,
        }),
      ).rejects.toThrow('EXAM_SECTION_UNKNOWN');
    });

    it('refuses an attempt belonging to another center', async () => {
      // 404, never 403: a 403 would confirm the attempt exists.
      prisma.examAttempt.findFirst.mockResolvedValue(null);

      await expect(
        service.recordMark(identity, ATTEMPT, {
          skill: 'SCHREIBEN',
          teil: 1,
          points: 30,
        }),
      ).rejects.toThrow('EXAM_ATTEMPT_NOT_FOUND');
      expect(prisma.examSectionResult.upsert).not.toHaveBeenCalled();
    });

    it('scopes the lookup by center rather than checking afterwards', async () => {
      await service.recordMark(identity, ATTEMPT, {
        skill: 'SCHREIBEN',
        teil: 1,
        points: 30,
      });

      expect(prisma.examAttempt.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ATTEMPT, session: { center_id: 'center-1' } },
        }),
      );
    });

    it('refuses to mark an exam the candidate has not finished', async () => {
      // Marking a Schreiben still being written would score a draft.
      prisma.examAttempt.findFirst.mockResolvedValue({
        id: ATTEMPT,
        submitted_at: null,
        session: { level: 'B1', center_id: 'center-1' },
      });

      await expect(
        service.recordMark(identity, ATTEMPT, {
          skill: 'SCHREIBEN',
          teil: 1,
          points: 30,
        }),
      ).rejects.toThrow('EXAM_NOT_FINISHED');
    });
  });
});
