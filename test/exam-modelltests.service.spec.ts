import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ANSWER_KEY_FIELDS } from '../src/modules/centers/exam-content';
import { ExamModelltestsService } from '../src/modules/centers/exam-modelltests.service';
import { LesenService } from '../src/modules/lesen/lesen.service';
import { ListeningService } from '../src/modules/listening/listening.service';
import { SpeakingService } from '../src/modules/speaking/services/speaking.service';
import { SprachbausteineService } from '../src/modules/sprachbausteine/sprachbausteine.service';
import { WritingService } from '../src/modules/writing/writing.service';
import { PrismaService } from '../src/shared/services/prisma.service';

describe('ExamModelltestsService', () => {
  const identity = { centerId: 'center-1' };

  let centerFindUnique: jest.Mock;
  let modelltestFindMany: jest.Mock;
  let modelltestFindFirst: jest.Mock;
  let listeningFindMany: jest.Mock;
  let lesenGetExercise: jest.Mock;
  let sbGetExercise: jest.Mock;
  let listeningGetExamTeil: jest.Mock;
  let writingGetExercise: jest.Mock;
  let speakingGetTeils: jest.Mock;
  let service: ExamModelltestsService;

  beforeEach(() => {
    centerFindUnique = jest.fn().mockResolvedValue({
      exam_slots_remaining: 1,
      exam_ai_slots_remaining: 0,
    });
    modelltestFindMany = jest.fn().mockResolvedValue([
      { number: 1, title: 'Modelltest 1', level: 'B1' },
      { number: 2, title: 'Modelltest 2', level: 'B1' },
    ]);
    modelltestFindFirst = jest.fn().mockResolvedValue({
      id: 'mt-2',
      number: 2,
      title: 'Modelltest 2',
    });
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

    const prisma = {
      center: {
        findUnique: centerFindUnique,
      },
      modelltest: {
        findMany: modelltestFindMany,
        findFirst: modelltestFindFirst,
      },
      listeningExercise: {
        findMany: listeningFindMany,
      },
    } as unknown as PrismaService;

    service = new ExamModelltestsService(
      prisma,
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
      select: { number: true, title: true, level: true },
    });
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

    it('404 when the Modelltest row is missing or incomplete', async () => {
      modelltestFindFirst.mockResolvedValue(null);

      const refusal = await service
        .getContent(identity, 99)
        .catch((error: unknown) => error);

      expect(refusal).toBeInstanceOf(NotFoundException);
      expect((refusal as NotFoundException).message).toBe(
        'MODELLTEST_NOT_FOUND',
      );
    });

    it('loads the real modelltests row by number with completeness filters', async () => {
      await service.getContent(identity, 2);

      expect(modelltestFindFirst).toHaveBeenCalledWith({
        where: {
          number: 2,
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
  });
});
