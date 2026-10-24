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
  let genericContent: any;
  let service: ExamGradingService;

  beforeEach(() => {
    prisma = {
      examAttempt: {
        findFirst: jest.fn().mockResolvedValue({
          id: ATTEMPT,
          submitted_at: new Date(),
          blocks: [{ block: 'SCHREIBEN', submitted_at: new Date() }],
          session: { level: 'B1', center_id: 'center-1' },
        }),
      },
      examSectionWeight: {
        // telc's real weights: Schreiben is 45 and Sprechen 75. One number
        // for both made a legitimate oral mark look like a typo.
        findUnique: jest
          .fn()
          .mockImplementation(({ where }) =>
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
    genericContent = { sectionFor: jest.fn().mockResolvedValue(null) };
    service = new ExamGradingService(prisma, genericContent);
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

    it("keeps the examiner's note, for the oral that happened elsewhere", async () => {
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

    it("accepts a half-point mark, telc's own Bewertungsbogen M10 grid", async () => {
      // B1 Sprechen Teil 1: Vorstellen (1/0.5/0) + Zusatzfragen (2/1/0) can
      // legitimately sum to 1.5 -- this used to be unrepresentable.
      const recorded = await service.recordMark(identity, ATTEMPT, {
        skill: 'SPRECHEN',
        teil: 1,
        points: 1.5,
      });

      expect(prisma.examSectionResult.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ points: 1.5 }),
        }),
      );
      expect(recorded).toMatchObject({ points: 1.5 });
    });

    it('refuses a mark finer than half a point', async () => {
      await expect(
        service.recordMark(identity, ATTEMPT, {
          skill: 'SPRECHEN',
          teil: 1,
          points: 1.3,
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

    it('refuses to mark a Schreiben still being written', async () => {
      // Scoring a draft. The block is what says whether it is finished.
      prisma.examAttempt.findFirst.mockResolvedValue({
        id: ATTEMPT,
        submitted_at: null,
        blocks: [{ block: 'SCHREIBEN', submitted_at: null }],
        session: { level: 'B1', center_id: 'center-1' },
      });

      await expect(
        service.recordMark(identity, ATTEMPT, {
          skill: 'SCHREIBEN',
          teil: 1,
          points: 30,
        }),
      ).rejects.toThrow('BLOCK_NOT_SUBMITTED');
    });

    it('marks a Schreiben whose block is in, even if the exam is unfinished', async () => {
      // Someone who wrote their Schreiben and then walked out before Hören.
      // The Schreiben is finished; it can be marked.
      prisma.examAttempt.findFirst.mockResolvedValue({
        id: ATTEMPT,
        submitted_at: null,
        blocks: [{ block: 'SCHREIBEN', submitted_at: new Date() }],
        session: { level: 'B1', center_id: 'center-1' },
      });

      await expect(
        service.recordMark(identity, ATTEMPT, {
          skill: 'SCHREIBEN',
          teil: 1,
          points: 30,
        }),
      ).resolves.toMatchObject({ points: 30 });
    });

    it('marks Sprechen whatever happened in the app', async () => {
      // The oral happened in a room with an examiner. Blocking it because a
      // candidate abandoned the written exam would leave a mark that exists
      // on paper with nowhere to go, and a result stuck INCOMPLETE for ever.
      prisma.examAttempt.findFirst.mockResolvedValue({
        id: ATTEMPT,
        submitted_at: null,
        blocks: [],
        session: { level: 'B1', center_id: 'center-1' },
      });

      await expect(
        service.recordMark(identity, ATTEMPT, {
          skill: 'SPRECHEN',
          teil: 1,
          points: 50,
        }),
      ).resolves.toMatchObject({ points: 50 });
    });
  });

  describe('A1/A2', () => {
    const a2Attempt = (
      blocks: { block: string; submitted_at: Date | null; answers?: unknown }[],
    ) => ({
      id: ATTEMPT,
      submitted_at: null,
      blocks,
      session: { level: 'A2', center_id: 'center-1', modelltest_id: 'mt-8' },
    });
    // telc A2: Schreiben Teil 2 is 10 points and sits in LESEN_SCHREIBEN;
    // Hören Teil 1 is 5; Sprechen has no block.
    const a2Weight = ({ where }: { where: any }) => {
      const { skill, teil } = where.level_skill_teil;
      if (skill === 'SPRECHEN')
        return Promise.resolve({ max_points: 6, block: null });
      if (skill === 'HOEREN')
        return Promise.resolve({ max_points: 5, block: 'HOEREN' });
      if (skill === 'SCHREIBEN' && teil === 2) {
        return Promise.resolve({ max_points: 10, block: 'LESEN_SCHREIBEN' });
      }
      return Promise.resolve({ max_points: 5, block: 'LESEN_SCHREIBEN' });
    };

    const normalization = {
      trim: true,
      ignoreCase: true,
      unicodeNormalization: 'NFC',
      numericAnswersStrict: true,
      fuzzyMatchingAllowed: false,
      unrecognizedAnswerPolicy: 'MANUAL_REVIEW',
    };
    // A2 Hören Teil 1 is free text; Schreiben Teil 2 and Sprechen are a
    // person's by nature.
    const hoeren1 = {
      id: 'h1',
      sectionId: 'HOEREN_1',
      aufgabentyp: 'KURZANTWORT',
      teil: 1,
      scoringMode: 'AUTO',
      material: {},
      items: [
        {
          itemNumber: 5,
          prompt: 'Wann?',
          solution: {
            acceptedAnswers: ['Donnerstagnachmittag'],
            normalization,
          },
          options: [],
        },
      ],
    };
    const hoerenAnswered = (answer: string) => ({
      block: 'HOEREN',
      submitted_at: new Date(),
      answers: { HOEREN_1: { '5': answer } },
    });

    beforeEach(() => {
      prisma.examSectionWeight.findUnique.mockImplementation(a2Weight);
      prisma.examSectionResult.findUnique = jest.fn().mockResolvedValue(null);
      genericContent.sectionFor.mockImplementation(
        (_m: string, skill: string, teil: number) =>
          Promise.resolve(
            skill === 'HOEREN' && teil === 1
              ? hoeren1
              : { scoringMode: 'MANUAL', items: [] },
          ),
      );
      prisma.examAttempt.findFirst.mockResolvedValue(
        a2Attempt([
          hoerenAnswered('Donerstagnachmittag'),
          { block: 'LESEN_SCHREIBEN', submitted_at: new Date() },
        ]),
      );
    });

    it('marks Schreiben once the shared Lesen-und-Schreiben block is in', async () => {
      // There is no SCHREIBEN block at A1/A2. Looking for one made every
      // A2 Schreiben unmarkable, and every A2 result INCOMPLETE for ever.
      await expect(
        service.recordMark(identity, ATTEMPT, {
          skill: 'SCHREIBEN',
          teil: 2,
          points: 7.5,
        }),
      ).resolves.toMatchObject({ teil: 2, points: 7.5, maxPoints: 10 });
    });

    it('refuses Schreiben while that block is still being written', async () => {
      prisma.examAttempt.findFirst.mockResolvedValue(
        a2Attempt([
          hoerenAnswered('Donerstagnachmittag'),
          { block: 'LESEN_SCHREIBEN', submitted_at: null },
        ]),
      );

      await expect(
        service.recordMark(identity, ATTEMPT, {
          skill: 'SCHREIBEN',
          teil: 2,
          points: 5,
        }),
      ).rejects.toThrow('BLOCK_NOT_SUBMITTED');
    });

    it('marks an automatic Teil the answer key could not decide', async () => {
      // A2 Hören Teil 1 is free text; an unrecognised answer leaves it
      // without a SERVER mark, waiting for a person.
      await expect(
        service.recordMark(identity, ATTEMPT, {
          skill: 'HOEREN',
          teil: 1,
          points: 4,
        }),
      ).resolves.toMatchObject({ skill: 'HOEREN', points: 4, maxPoints: 5 });
    });

    it('refuses an automatic Teil the key decided, even with no SERVER row yet', async () => {
      // A scoring that failed or is still running, or an attempt scored
      // before marks were frozen: the answer was recognised, so the Teil is
      // the key's, not a person's to set.
      prisma.examAttempt.findFirst.mockResolvedValue(
        a2Attempt([
          hoerenAnswered('Donnerstagnachmittag'),
          { block: 'LESEN_SCHREIBEN', submitted_at: new Date() },
        ]),
      );

      await expect(
        service.recordMark(identity, ATTEMPT, {
          skill: 'HOEREN',
          teil: 1,
          points: 5,
        }),
      ).rejects.toThrow('SECTION_DECIDED_BY_KEY');
      expect(prisma.examSectionResult.upsert).not.toHaveBeenCalled();
    });

    it('refuses to overwrite a mark the server froze', async () => {
      prisma.examSectionResult.findUnique.mockResolvedValue({
        graded_by: 'SERVER',
      });

      await expect(
        service.recordMark(identity, ATTEMPT, {
          skill: 'HOEREN',
          teil: 1,
          points: 5,
        }),
      ).rejects.toThrow('SECTION_MARKED_BY_SERVER');
      expect(prisma.examSectionResult.upsert).not.toHaveBeenCalled();
    });

    it('lets an examiner correct their own mark', async () => {
      prisma.examSectionResult.findUnique.mockResolvedValue({
        graded_by: 'owner-1',
      });

      await expect(
        service.recordMark(identity, ATTEMPT, {
          skill: 'SCHREIBEN',
          teil: 2,
          points: 8,
        }),
      ).resolves.toMatchObject({ points: 8 });
    });

    it('marks Sprechen with no block at all, as at B1/B2', async () => {
      prisma.examAttempt.findFirst.mockResolvedValue(a2Attempt([]));

      await expect(
        service.recordMark(identity, ATTEMPT, {
          skill: 'SPRECHEN',
          teil: 2,
          points: 4.5,
        }),
      ).resolves.toMatchObject({ points: 4.5, maxPoints: 6 });
    });

    it('refuses a Teil this level does not have', async () => {
      prisma.examSectionWeight.findUnique.mockResolvedValue(null);

      await expect(
        service.recordMark(identity, ATTEMPT, {
          skill: 'SPRACHBAUSTEINE',
          teil: 1,
          points: 1,
        }),
      ).rejects.toThrow('EXAM_SECTION_UNKNOWN');
    });
  });
});
