import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ANSWER_KEY_FIELDS } from '../src/modules/centers/exam-content';
import { ExamModelltestsService } from '../src/modules/centers/exam-modelltests.service';
import { GenericExamContentService } from '../src/shared/services/generic-exam-content.service';
import { LesenService } from '../src/modules/lesen/lesen.service';
import { ListeningService } from '../src/modules/listening/listening.service';
import { SpeakingService } from '../src/modules/speaking/services/speaking.service';
import { SprachbausteineService } from '../src/modules/sprachbausteine/sprachbausteine.service';
import { WritingService } from '../src/modules/writing/writing.service';
import { PrismaService } from '../src/shared/services/prisma.service';

const STRUCTURAL_WHERE = {
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
};

describe('ExamModelltestsService', () => {
  const identity = { centerId: 'center-1' };

  let centerFindUnique: jest.Mock;
  let modelltestFindMany: jest.Mock;
  let modelltestFindFirst: jest.Mock;
  let modelltestFindUniqueOrThrow: jest.Mock;
  let listeningFindMany: jest.Mock;
  let lesenGetExercise: jest.Mock;
  let sbGetExercise: jest.Mock;
  let listeningGetExamTeil: jest.Mock;
  let writingGetExercise: jest.Mock;
  let speakingGetTeils: jest.Mock;
  let genericIsComplete: jest.Mock;
  let genericSectionsFor: jest.Mock;
  let service: ExamModelltestsService;

  beforeEach(() => {
    centerFindUnique = jest.fn().mockResolvedValue({
      exam_slots_remaining: 1,
      exam_ai_slots_remaining: 0,
    });
    // list(): structural (B1/B2) query vs generic (A1/A2) query, told apart
    // by which side of the where clause names the level.
    modelltestFindMany = jest.fn().mockImplementation((args: never) => {
      const where = (args as { where: { level?: { in?: string[] } } }).where;
      if (where.level?.in) return Promise.resolve([]);
      return Promise.resolve([
        { number: 1, title: 'Modelltest 1', level: 'B1' },
        { number: 2, title: 'Modelltest 2', level: 'B1' },
      ]);
    });
    modelltestFindFirst = jest.fn().mockResolvedValue({
      id: 'mt-2',
      number: 2,
      title: 'Modelltest 2',
      level: 'B1',
    });
    modelltestFindUniqueOrThrow = jest.fn();
    listeningFindMany = jest.fn().mockResolvedValue([
      { id: 'audio-1', audio_url: 'https://cdn.example/t1.mp3' },
      { id: 'audio-2', audio_url: 'https://cdn.example/t2.mp3' },
      { id: 'audio-3', audio_url: 'https://cdn.example/t3.mp3' },
    ]);
    lesenGetExercise = jest.fn().mockResolvedValue({
      teil1: { correctAnswer: 'secret-lesen', prompt: 'Lesen prompt' },
    });
    sbGetExercise = jest.fn().mockResolvedValue({
      teil1: { answerKey: { q1: 'a' }, prompt: 'SB prompt' },
    });
    listeningGetExamTeil = jest
      .fn()
      .mockImplementation((_n: number, part: number) => ({
        audioId: `audio-${part}`,
        playsAllowed: 1,
        imagePath: `/img/${part}.png`,
        contentRevision: `rev-${part}`,
        questions: [{ id: `q${part}`, prompt: `Hören ${part}` }],
        transcript: 'must never leave',
      }));
    writingGetExercise = jest.fn().mockResolvedValue({
      title: 'Schreiben',
      prompt: 'Write something',
    });
    speakingGetTeils = jest
      .fn()
      .mockResolvedValue([{ part: 1, title: 'Teil 1', topicTitle: 'Thema' }]);
    genericIsComplete = jest.fn().mockResolvedValue(false);
    genericSectionsFor = jest.fn();

    const prisma = {
      center: {
        findUnique: centerFindUnique,
      },
      modelltest: {
        findMany: modelltestFindMany,
        findFirst: modelltestFindFirst,
        findUniqueOrThrow: modelltestFindUniqueOrThrow,
      },
      listeningExercise: {
        findMany: listeningFindMany,
      },
    } as unknown as PrismaService;

    service = new ExamModelltestsService(
      prisma,
      {
        isComplete: genericIsComplete,
        sectionsFor: genericSectionsFor,
      } as unknown as GenericExamContentService,
      { getExercise: lesenGetExercise } as unknown as LesenService,
      { getExercise: sbGetExercise } as unknown as SprachbausteineService,
      { getExamTeil: listeningGetExamTeil } as unknown as ListeningService,
      {
        getExerciseByModelltest: writingGetExercise,
      } as unknown as WritingService,
      { getTeils: speakingGetTeils } as unknown as SpeakingService,
    );
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
      { number: 1, title: 'Modelltest 1', level: 'B1' },
      { number: 2, title: 'Modelltest 2', level: 'B1' },
    ]);
  });

  it('allows browsing with a remaining AI exam slot', async () => {
    centerFindUnique.mockResolvedValue({
      exam_slots_remaining: 0,
      exam_ai_slots_remaining: 1,
    });

    await expect(service.list(identity)).resolves.toHaveLength(2);
  });

  it('returns only complete B1/B2 Modelltests, same WHERE as before (equality)', async () => {
    await service.list(identity);

    expect(modelltestFindMany).toHaveBeenCalledWith({
      where: {
        level: { notIn: ['A1', 'A2'] },
        ...STRUCTURAL_WHERE,
      },
      select: { number: true, title: true, level: true },
    });
  });

  it('includes a complete A2 Modelltest in the catalogue, in number order', async () => {
    modelltestFindMany.mockImplementation((args: never) => {
      const where = (args as { where: { level?: { in?: string[] } } }).where;
      if (where.level?.in) {
        return Promise.resolve([
          { id: 'mt-8', number: 8, title: 'A2 Modelltest 1', level: 'A2' },
        ]);
      }
      return Promise.resolve([
        { number: 1, title: 'Modelltest 1', level: 'B1' },
      ]);
    });
    genericIsComplete.mockResolvedValue(true);

    const result = await service.list(identity);

    expect(result).toEqual([
      { number: 1, title: 'Modelltest 1', level: 'B1' },
      { number: 8, title: 'A2 Modelltest 1', level: 'A2' },
    ]);
    expect(genericIsComplete).toHaveBeenCalledWith('A2', 'mt-8');
  });

  it('excludes an incomplete A2 Modelltest from the catalogue', async () => {
    modelltestFindMany.mockImplementation((args: never) => {
      const where = (args as { where: { level?: { in?: string[] } } }).where;
      if (where.level?.in) {
        return Promise.resolve([
          { id: 'mt-9', number: 9, title: 'Draft A2 paper', level: 'A2' },
        ]);
      }
      return Promise.resolve([]);
    });
    genericIsComplete.mockResolvedValue(false);

    await expect(service.list(identity)).resolves.toEqual([]);
  });

  describe('getContent', () => {
    it('refuses preview when no exam slots remain', async () => {
      centerFindUnique.mockResolvedValue({
        exam_slots_remaining: 0,
        exam_ai_slots_remaining: 0,
      });

      const refusal = await service
        .getContent(identity, 2)
        .catch((error: unknown) => error);

      expect(refusal).toBeInstanceOf(ForbiddenException);
      expect((refusal as ForbiddenException).message).toBe(
        'EXAM_SLOTS_REQUIRED',
      );
      expect(modelltestFindFirst).not.toHaveBeenCalled();
    });

    it('404 when the Modelltest number does not exist at all', async () => {
      modelltestFindFirst.mockResolvedValue(null);

      const refusal = await service
        .getContent(identity, 99)
        .catch((error: unknown) => error);

      expect(refusal).toBeInstanceOf(NotFoundException);
      expect((refusal as NotFoundException).message).toBe(
        'MODELLTEST_NOT_FOUND',
      );
    });

    it('404 for a B1/B2 Modelltest that exists but is incomplete', async () => {
      // Stub lookup succeeds (the number exists); the structural
      // completeness lookup is what returns null for an incomplete row.
      modelltestFindFirst
        .mockResolvedValueOnce({ id: 'mt-2', level: 'B1' })
        .mockResolvedValueOnce(null);

      const refusal = await service
        .getContent(identity, 2)
        .catch((error: unknown) => error);

      expect(refusal).toBeInstanceOf(NotFoundException);
    });

    it('loads the real modelltests row by number with completeness filters', async () => {
      await service.getContent(identity, 2);

      expect(modelltestFindFirst).toHaveBeenNthCalledWith(1, {
        where: { number: 2 },
        select: { id: true, level: true },
      });
      expect(modelltestFindFirst).toHaveBeenNthCalledWith(2, {
        where: { number: 2, ...STRUCTURAL_WHERE },
        select: { id: true, number: true, title: true },
      });
      expect(lesenGetExercise).toHaveBeenCalledWith(2);
      expect(sbGetExercise).toHaveBeenCalledWith(2);
      expect(writingGetExercise).toHaveBeenCalledWith(2);
      expect(speakingGetTeils).toHaveBeenCalledWith(2);
      expect(listeningFindMany).toHaveBeenCalledWith({
        where: { modelltest_id: 'mt-2' },
        select: { id: true, audio_url: true },
      });
    });

    it('returns full sections without answer-key fields and with Hören audioUrl', async () => {
      const content = await service.getContent(identity, 2);

      expect(content).toMatchObject({
        number: 2,
        title: 'Modelltest 2',
      });
      expect(Object.keys(content.sections).sort()).toEqual(
        ['HOEREN', 'LESEN', 'SCHREIBEN', 'SPRECHEN', 'SPRACHBAUSTEINE'].sort(),
      );
      expect(content.sections.HOEREN).toEqual([
        expect.objectContaining({
          audioId: 'audio-1',
          audioUrl: 'https://cdn.example/t1.mp3',
          playsAllowed: 1,
        }),
        expect.objectContaining({
          audioId: 'audio-2',
          audioUrl: 'https://cdn.example/t2.mp3',
        }),
        expect.objectContaining({
          audioId: 'audio-3',
          audioUrl: 'https://cdn.example/t3.mp3',
        }),
      ]);

      const json = JSON.stringify(content);
      for (const field of ANSWER_KEY_FIELDS) {
        expect(json).not.toContain(`"${field}"`);
      }
      expect(json).not.toContain('secret-lesen');
      expect(json).not.toContain('must never leave');
    });

    it('serves an A2 Modelltest from the generic model, never the B1 skill services', async () => {
      modelltestFindFirst.mockResolvedValue({ id: 'mt-8', level: 'A2' });
      modelltestFindUniqueOrThrow.mockResolvedValue({
        number: 8,
        title: 'A2 Modelltest 1',
      });
      genericIsComplete.mockResolvedValue(true);
      genericSectionsFor.mockResolvedValue({
        HOEREN: [],
        LESEN: [
          {
            sectionId: 'LESEN_1',
            aufgabentyp: 'EINZELAUSWAHL',
            items: [
              {
                itemNumber: 1,
                solution: { key: 'a' },
                options: [{ key: 'a', content: 'x', isCorrect: true }],
              },
            ],
          },
        ],
        SPRACHBAUSTEINE: [],
        SCHREIBEN: [],
        SPRECHEN: [],
      });

      const content = await service.getContent(identity, 8);

      expect(content.number).toBe(8);
      expect(content.title).toBe('A2 Modelltest 1');
      expect(genericIsComplete).toHaveBeenCalledWith('A2', 'mt-8');
      expect(genericSectionsFor).toHaveBeenCalledWith('mt-8');

      const json = JSON.stringify(content);
      expect(json).not.toContain('"solution"');
      expect(json).not.toContain('"isCorrect"');
      expect(lesenGetExercise).not.toHaveBeenCalled();
      expect(writingGetExercise).not.toHaveBeenCalled();
    });

    it('404 for an A2 Modelltest that exists but is incomplete', async () => {
      modelltestFindFirst.mockResolvedValue({ id: 'mt-9', level: 'A2' });
      genericIsComplete.mockResolvedValue(false);

      const refusal = await service
        .getContent(identity, 9)
        .catch((error: unknown) => error);

      expect(refusal).toBeInstanceOf(NotFoundException);
      expect(genericSectionsFor).not.toHaveBeenCalled();
    });
  });
});
