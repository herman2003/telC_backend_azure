import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ModelltestsService } from './modelltests.service';
import { MODELLTEST_PERIOD_EPOCH_MS } from './seven-day-period';

const MS_PER_DAY = 86_400_000;

const mockPrisma = {
  modelltest: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  examSection: {
    findMany: jest.fn(),
  },
};

const TRAINING_ROWS = [
  { id: 'mt1-uuid', number: 1, title: 'Modelltest 1', level: 'B1' as const },
  { id: 'mt2-uuid', number: 2, title: 'Modelltest 2', level: 'B1' as const },
];

function daysAfterEpoch(days: number): Date {
  return new Date(MODELLTEST_PERIOD_EPOCH_MS + days * MS_PER_DAY);
}

const MT1_ROW = {
  id: 'mt1-uuid',
  number: 1,
  title: 'Modelltest 1',
  level: 'B1' as const,
  created_at: new Date(),
  sprachbausteineExercises: [{ id: 'sb1-uuid' }],
  sprachbausteineTeil2Exercises: [{ id: 'sb2-uuid' }],
  lesenTeil1Exercises: [{ id: 'l1-uuid' }],
  lesenTeil2Exercises: [{ id: 'l2-uuid' }],
  lesenTeil3Exercises: [{ id: 'l3-uuid' }],
  writingExercises: [{ id: 'we1-uuid' }],
  listeningExercises: [{ id: 'he1-uuid' }],
  speakingExercises: [{ id: 'sp1-uuid' }],
};

const mockAccess = {
  isPrepPassActive: jest.fn(),
  assertMayAccess: jest.fn(),
  weeklyModelltestNumber: jest.fn(),
  requireStudentLevel: jest.fn(),
};

const mockLesen = { getExercise: jest.fn() };
const mockSprachbausteine = { getExercise: jest.fn() };
const mockListening = {
  getExamTeil: jest.fn(),
  getAnswerKey: jest.fn(),
};
const mockWriting = { getExerciseByModelltest: jest.fn() };
const mockSpeaking = { getTeils: jest.fn() };

describe('ModelltestsService', () => {
  let service: ModelltestsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAccess.isPrepPassActive.mockResolvedValue(true);
    mockAccess.assertMayAccess.mockResolvedValue(undefined);
    mockAccess.weeklyModelltestNumber.mockResolvedValue(1);
    mockAccess.requireStudentLevel.mockResolvedValue('B1');
    service = new ModelltestsService(
      mockPrisma as never,
      mockAccess as never,
      mockLesen as never,
      mockSprachbausteine as never,
      mockListening as never,
      mockWriting as never,
      mockSpeaking as never,
    );
  });

  describe('getAll', () => {
    it('returns mapped list when DB has rows', async () => {
      mockPrisma.modelltest.findMany.mockResolvedValue([
        {
          id: 'mt1-uuid',
          number: 1,
          title: 'Modelltest 1',
          level: 'B1',
          created_at: new Date(),
        },
        {
          id: 'mt2-uuid',
          number: 2,
          title: 'Modelltest 2',
          level: 'B1',
          created_at: new Date(),
        },
      ]);

      const result = await service.getAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'mt1-uuid',
        number: 1,
        title: 'Modelltest 1',
        level: 'B1',
      });
      expect(result[1]).toEqual({
        id: 'mt2-uuid',
        number: 2,
        title: 'Modelltest 2',
        level: 'B1',
      });
      // Exam-only material is withheld from the training catalogue, so a
      // sitting can use a Modelltest nobody has worked through.
      expect(mockPrisma.modelltest.findMany).toHaveBeenCalledWith({
        where: { exam_only: false },
        orderBy: { number: 'asc' },
      });
    });

    it('returns empty array when DB has no rows', async () => {
      mockPrisma.modelltest.findMany.mockResolvedValue([]);

      const result = await service.getAll();

      expect(result).toEqual([]);
    });

    it('hides Modelltest 3+ from guests', async () => {
      mockPrisma.modelltest.findMany.mockResolvedValue([
        {
          id: 'mt1',
          number: 1,
          title: 'Modelltest 1',
          level: 'B1',
          created_at: new Date(),
        },
        {
          id: 'mt2',
          number: 2,
          title: 'Modelltest 2',
          level: 'B1',
          created_at: new Date(),
        },
        {
          id: 'mt3',
          number: 3,
          title: 'Modelltest 3',
          level: 'B1',
          created_at: new Date(),
        },
      ]);

      const result = await service.getAll({ isGuest: true });

      expect(result.map((r) => r.number)).toEqual([1, 2]);
    });

    it('returns the full pool when the student holds Prep Pass', async () => {
      mockPrisma.modelltest.findMany.mockResolvedValue(TRAINING_ROWS);
      mockAccess.isPrepPassActive.mockResolvedValue(true);

      const result = await service.getAll({ studentId: 's1' });

      expect(mockAccess.requireStudentLevel).toHaveBeenCalledWith('s1');
      expect(mockPrisma.modelltest.findMany).toHaveBeenCalledWith({
        where: { exam_only: false, level: 'B1' },
        orderBy: { number: 'asc' },
      });
      expect(result.map((r) => r.number)).toEqual([1, 2]);
    });

    it('returns only the weekly Modelltest for Start without Prep Pass', async () => {
      mockPrisma.modelltest.findMany.mockResolvedValue(TRAINING_ROWS);
      mockAccess.isPrepPassActive.mockResolvedValue(false);
      mockAccess.weeklyModelltestNumber.mockResolvedValue(2);

      const result = await service.getAll({ studentId: 's1' });

      expect(mockAccess.weeklyModelltestNumber).toHaveBeenCalledWith('s1');
      expect(result).toEqual([
        { id: 'mt2-uuid', number: 2, title: 'Modelltest 2', level: 'B1' },
      ]);
    });
  });

  describe('getByNumber', () => {
    it('returns detail DTO with grouped exercise IDs when found', async () => {
      mockPrisma.modelltest.findFirst.mockResolvedValue(MT1_ROW);

      const result = await service.getByNumber(1);

      expect(result.id).toBe('mt1-uuid');
      expect(result.number).toBe(1);
      expect(result.title).toBe('Modelltest 1');
      expect(result.exercises).toEqual({
        sprachbausteineT1: ['sb1-uuid'],
        sprachbausteineT2: ['sb2-uuid'],
        lesenT1: ['l1-uuid'],
        lesenT2: ['l2-uuid'],
        lesenT3: ['l3-uuid'],
        writing: ['we1-uuid'],
        listening: ['he1-uuid'],
        speaking: ['sp1-uuid'],
      });
      expect(mockPrisma.modelltest.findFirst).toHaveBeenCalledWith({
        // By number alone a student could reach exam material anyway.
        where: { number: 1, exam_only: false },
        include: {
          sprachbausteineExercises: { select: { id: true } },
          sprachbausteineTeil2Exercises: { select: { id: true } },
          lesenTeil1Exercises: { select: { id: true } },
          lesenTeil2Exercises: { select: { id: true } },
          lesenTeil3Exercises: { select: { id: true } },
          writingExercises: { select: { id: true } },
          listeningExercises: { select: { id: true } },
          speakingExercises: { select: { id: true } },
        },
      });
    });

    it('throws NotFoundException when number does not exist', async () => {
      mockPrisma.modelltest.findFirst.mockResolvedValue(null);

      await expect(service.getByNumber(99)).rejects.toThrow(NotFoundException);
    });

    it('blocks guests from Modelltest 3 detail', async () => {
      await expect(service.getByNumber(3, { isGuest: true })).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.modelltest.findFirst).not.toHaveBeenCalled();
    });

    it('refuses Start-only detail for a non-weekly Modelltest', async () => {
      mockAccess.assertMayAccess.mockRejectedValue(
        new ForbiddenException({
          message: 'PREP_PASS_REQUIRED',
          messageKey: 'prepPassRequired',
          reason: 'NOT_HELD',
        }),
      );

      await expect(
        service.getByNumber(2, { studentId: 's1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockAccess.assertMayAccess).toHaveBeenCalledWith('s1', 2);
      expect(mockPrisma.modelltest.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('getOfTheWeek', () => {
    it('returns the same MT on day 0 and day 6 of a period', async () => {
      mockPrisma.modelltest.findMany.mockResolvedValue(TRAINING_ROWS);

      const day0 = await service.getOfTheWeek(daysAfterEpoch(0));
      const day6 = await service.getOfTheWeek(daysAfterEpoch(6));

      expect(day0.number).toBe(1);
      expect(day6.number).toBe(1);
      expect(day0.periodStart).toBe(day6.periodStart);
      expect(day0.periodEnd).toBe(day6.periodEnd);
    });

    it('rotates to the next MT on day 7', async () => {
      mockPrisma.modelltest.findMany.mockResolvedValue(TRAINING_ROWS);

      const day0 = await service.getOfTheWeek(daysAfterEpoch(0));
      const day7 = await service.getOfTheWeek(daysAfterEpoch(7));

      expect(day0.number).toBe(1);
      expect(day7.number).toBe(2);
    });

    it('rotates guests only among allowlisted Modelltests', async () => {
      mockPrisma.modelltest.findMany.mockResolvedValue([
        ...TRAINING_ROWS,
        { id: 'mt3-uuid', number: 3, title: 'Modelltest 3', level: 'B1' },
      ]);

      const day0 = await service.getOfTheWeek(daysAfterEpoch(0), {
        isGuest: true,
      });
      const day7 = await service.getOfTheWeek(daysAfterEpoch(7), {
        isGuest: true,
      });
      const day14 = await service.getOfTheWeek(daysAfterEpoch(14), {
        isGuest: true,
      });

      expect(day0.number).toBe(1);
      expect(day7.number).toBe(2);
      expect(day14.number).toBe(1);
    });

    it('keeps a single MT across periods', async () => {
      mockPrisma.modelltest.findMany.mockResolvedValue([TRAINING_ROWS[0]]);

      const a = await service.getOfTheWeek(daysAfterEpoch(0));
      const b = await service.getOfTheWeek(daysAfterEpoch(14));

      expect(a.number).toBe(1);
      expect(b.number).toBe(1);
    });

    it('throws NotFoundException when no training Modelltest exists', async () => {
      mockPrisma.modelltest.findMany.mockResolvedValue([]);

      await expect(service.getOfTheWeek(daysAfterEpoch(0))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('queries only training rows with a light select', async () => {
      mockPrisma.modelltest.findMany.mockResolvedValue(TRAINING_ROWS);

      await service.getOfTheWeek(daysAfterEpoch(0));

      expect(mockPrisma.modelltest.findMany).toHaveBeenCalledWith({
        where: { exam_only: false },
        orderBy: { number: 'asc' },
        select: { id: true, number: true, title: true, level: true },
      });
    });

    it('scopes of-the-week to the student CEFR level', async () => {
      mockPrisma.modelltest.findMany.mockResolvedValue(TRAINING_ROWS);

      await service.getOfTheWeek(daysAfterEpoch(0), { studentId: 's1' });

      expect(mockAccess.requireStudentLevel).toHaveBeenCalledWith('s1');
      expect(mockPrisma.modelltest.findMany).toHaveBeenCalledWith({
        where: { exam_only: false, level: 'B1' },
        orderBy: { number: 'asc' },
        select: { id: true, number: true, title: true, level: true },
      });
    });
  });

  describe('getOfTheWeekContent', () => {
    beforeEach(() => {
      mockPrisma.modelltest.findMany.mockResolvedValue(TRAINING_ROWS);
      mockLesen.getExercise.mockResolvedValue({
        teil1: { texts: [{ correctTitleId: 'title-a' }] },
      });
      mockSprachbausteine.getExercise.mockResolvedValue({
        teil1: { gaps: [{ correctOptionId: 'opt-1' }] },
      });
      mockListening.getExamTeil.mockImplementation(
        async (_n: number, part: number) => ({
          audioId: `audio-${part}`,
          playsAllowed: 1,
          questions: [{ id: `q${part}`, prompt: '…' }],
        }),
      );
      mockListening.getAnswerKey.mockImplementation(
        async (_n: number, part: number) => ({ [`q${part}`]: 'a' }),
      );
      mockWriting.getExerciseByModelltest.mockResolvedValue({
        id: 'w1',
        stimulus: '…',
      });
      mockSpeaking.getTeils.mockResolvedValue([{ part: 1, title: 'Teil 1' }]);
    });

    it('refuses guests (keys must not ship on demo tokens)', async () => {
      await expect(
        service.getOfTheWeekContent(daysAfterEpoch(0), { isGuest: true }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ message: 'GUESTS_NOT_ALLOWED' }),
      });
      expect(mockLesen.getExercise).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when no training Modelltest exists', async () => {
      mockPrisma.modelltest.findMany.mockResolvedValue([]);

      await expect(
        service.getOfTheWeekContent(daysAfterEpoch(0)),
      ).rejects.toThrow(NotFoundException);
      expect(mockLesen.getExercise).not.toHaveBeenCalled();
      expect(mockListening.getExamTeil).not.toHaveBeenCalled();
    });

    it('assembles all five sections for the weekly Modelltest with Hören keys', async () => {
      const result = await service.getOfTheWeekContent(daysAfterEpoch(0));

      expect(result.number).toBe(1);
      expect(result.sections.LESEN).toEqual({
        teil1: { texts: [{ correctTitleId: 'title-a' }] },
      });
      expect(result.sections.SPRACHBAUSTEINE).toEqual({
        teil1: { gaps: [{ correctOptionId: 'opt-1' }] },
      });
      expect(result.sections.HOEREN).toHaveLength(3);
      expect(result.sections.HOEREN[0]).toEqual(
        expect.objectContaining({
          audioId: 'audio-1',
          answerKey: { q1: 'a' },
        }),
      );
      expect(JSON.stringify(result.sections.HOEREN)).not.toContain('audioUrl');
      expect(result.sections.SCHREIBEN).toEqual({ id: 'w1', stimulus: '…' });
      expect(result.sections.SPRECHEN).toEqual([
        { part: 1, title: 'Teil 1' },
      ]);
      expect(mockLesen.getExercise).toHaveBeenCalledWith(1);
      expect(mockSprachbausteine.getExercise).toHaveBeenCalledWith(1);
      expect(mockWriting.getExerciseByModelltest).toHaveBeenCalledWith(1);
      expect(mockSpeaking.getTeils).toHaveBeenCalledWith(1);
      for (const part of [1, 2, 3]) {
        expect(mockListening.getExamTeil).toHaveBeenCalledWith(1, part);
        expect(mockListening.getAnswerKey).toHaveBeenCalledWith(1, part);
      }
    });

    it('reads the generic model for an A2 Modelltest, never the B1 skill services', async () => {
      mockPrisma.modelltest.findMany.mockResolvedValue([
        { id: 'a2-mt-uuid', number: 100, title: 'A2 Modelltest 1', level: 'A2' },
      ]);
      mockPrisma.examSection.findMany.mockResolvedValue([
        {
          skill: 'LESEN',
          teil: 1,
          aufgabentyp: 'EINZELAUSWAHL',
          label: 'Lesen Teil 1',
          instruction: 'Kreuzen Sie an.',
          max_points: 5,
          scoring_mode: 'AUTO',
          material: { stimulus: null },
          items: [
            {
              item_number: 1,
              prompt: 'Frage?',
              solution: { key: 'a' },
              options: [{ key: 'a', content: 'Antwort', is_correct: true }],
            },
          ],
        },
      ]);

      const result = await service.getOfTheWeekContent(daysAfterEpoch(0));

      expect(result.number).toBe(100);
      expect(result.sections.LESEN).toEqual([
        expect.objectContaining({
          sectionId: 'LESEN_1',
          aufgabentyp: 'EINZELAUSWAHL',
          maxPoints: 5,
          scoringMode: 'AUTO',
        }),
      ]);
      // A2 has no Sprachbausteine -- an empty list, not a crash or null.
      expect(result.sections.SPRACHBAUSTEINE).toEqual([]);
      expect(mockPrisma.examSection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { modelltest_id: 'a2-mt-uuid' } }),
      );
      expect(mockLesen.getExercise).not.toHaveBeenCalled();
      expect(mockSprachbausteine.getExercise).not.toHaveBeenCalled();
      expect(mockListening.getExamTeil).not.toHaveBeenCalled();
      expect(mockWriting.getExerciseByModelltest).not.toHaveBeenCalled();
      expect(mockSpeaking.getTeils).not.toHaveBeenCalled();
    });
  });
});
