import { NotFoundException } from '@nestjs/common';
import { ModelltestsService } from './modelltests.service';
import { MODELLTEST_PERIOD_EPOCH_MS } from './seven-day-period';

const MS_PER_DAY = 86_400_000;

const mockPrisma = {
  modelltest: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
};

const TRAINING_ROWS = [
  { id: 'mt1-uuid', number: 1, title: 'Modelltest 1' },
  { id: 'mt2-uuid', number: 2, title: 'Modelltest 2' },
];

function daysAfterEpoch(days: number): Date {
  return new Date(MODELLTEST_PERIOD_EPOCH_MS + days * MS_PER_DAY);
}

const MT1_ROW = {
  id: 'mt1-uuid',
  number: 1,
  title: 'Modelltest 1',
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

describe('ModelltestsService', () => {
  let service: ModelltestsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ModelltestsService(mockPrisma as any);
  });

  describe('getAll', () => {
    it('returns mapped list when DB has rows', async () => {
      mockPrisma.modelltest.findMany.mockResolvedValue([
        {
          id: 'mt1-uuid',
          number: 1,
          title: 'Modelltest 1',
          created_at: new Date(),
        },
        {
          id: 'mt2-uuid',
          number: 2,
          title: 'Modelltest 2',
          created_at: new Date(),
        },
      ]);

      const result = await service.getAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'mt1-uuid',
        number: 1,
        title: 'Modelltest 1',
      });
      expect(result[1]).toEqual({
        id: 'mt2-uuid',
        number: 2,
        title: 'Modelltest 2',
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

    it('keeps a single MT across periods', async () => {
      mockPrisma.modelltest.findMany.mockResolvedValue([TRAINING_ROWS[0]]);

      const a = await service.getOfTheWeek(daysAfterEpoch(0));
      const b = await service.getOfTheWeek(daysAfterEpoch(14));

      expect(a.number).toBe(1);
      expect(b.number).toBe(1);
    });

    it('throws NotFoundException when no training Modelltest exists', async () => {
      mockPrisma.modelltest.findMany.mockResolvedValue([]);

      await expect(
        service.getOfTheWeek(daysAfterEpoch(0)),
      ).rejects.toThrow(NotFoundException);
    });

    it('queries only training rows with a light select', async () => {
      mockPrisma.modelltest.findMany.mockResolvedValue(TRAINING_ROWS);

      await service.getOfTheWeek(daysAfterEpoch(0));

      expect(mockPrisma.modelltest.findMany).toHaveBeenCalledWith({
        where: { exam_only: false },
        orderBy: { number: 'asc' },
        select: { id: true, number: true, title: true },
      });
    });
  });
});
