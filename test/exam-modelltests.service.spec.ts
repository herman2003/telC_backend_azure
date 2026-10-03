import { ForbiddenException } from '@nestjs/common';
import { ExamModelltestsService } from '../src/modules/centers/exam-modelltests.service';
import { PrismaService } from '../src/shared/services/prisma.service';

describe('ExamModelltestsService', () => {
  const identity = { centerId: 'center-1' };

  let centerFindUnique: jest.Mock;
  let modelltestFindMany: jest.Mock;
  let service: ExamModelltestsService;

  beforeEach(() => {
    centerFindUnique = jest.fn().mockResolvedValue({
      exam_slots_remaining: 1,
      exam_ai_slots_remaining: 0,
    });
    modelltestFindMany = jest.fn().mockResolvedValue([
      { number: 1, title: 'Modelltest 1' },
      { number: 2, title: 'Modelltest 2' },
    ]);

    const prisma = {
      center: {
        findUnique: centerFindUnique,
      },
      modelltest: {
        findMany: modelltestFindMany,
      },
    } as unknown as PrismaService;
    service = new ExamModelltestsService(prisma);
  });

  it('refuses browsing when no confirmed exam slots remain', async () => {
    centerFindUnique.mockResolvedValue({
      exam_slots_remaining: 0,
      exam_ai_slots_remaining: 0,
    });

    const refusal = await service
      .list(identity)
      .catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(ForbiddenException);
    expect((refusal as ForbiddenException).message).toBe('EXAM_SLOTS_REQUIRED');
    expect(modelltestFindMany).not.toHaveBeenCalled();
  });

  it('allows browsing with a remaining MANUAL exam slot', async () => {
    await expect(service.list(identity)).resolves.toEqual([
      { number: 1, title: 'Modelltest 1' },
      { number: 2, title: 'Modelltest 2' },
    ]);
  });

  it('allows browsing with a remaining AI exam slot', async () => {
    centerFindUnique.mockResolvedValue({
      exam_slots_remaining: 0,
      exam_ai_slots_remaining: 1,
    });

    await expect(service.list(identity)).resolves.toHaveLength(2);
  });

  it('returns only complete Modelltests in number order', async () => {
    await service.list(identity);

    expect(modelltestFindMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { lesenTeil1Exercises: { some: {} } },
          { lesenTeil2Exercises: { some: {} } },
          { lesenTeil3Exercises: { some: {} } },
          { sprachbausteineExercises: { some: {} } },
          { sprachbausteineTeil2Exercises: { some: {} } },
          { writingExercises: { some: {} } },
          { listeningExercises: { some: { part: 1 } } },
          { listeningExercises: { some: { part: 2 } } },
          { listeningExercises: { some: { part: 3 } } },
          { speakingExercises: { some: { part: 1 } } },
          { speakingExercises: { some: { part: 2 } } },
          { speakingExercises: { some: { part: 3 } } },
        ],
      },
      orderBy: { number: 'asc' },
      select: { number: true, title: true },
    });
  });
});
