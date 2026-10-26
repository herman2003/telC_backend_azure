import { NotFoundException } from '@nestjs/common';
import { SpeakingService } from '../src/modules/speaking/services/speaking.service';
import type { SpeakingExerciseResponseDto } from '../src/modules/speaking/dto';

describe('SpeakingService', () => {
  const prisma = {
    modelltest: { findUnique: jest.fn() },
    speakingExercise: { findMany: jest.fn() },
    speakingAttempt: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const genericContent = { sectionsFor: jest.fn() };
  let service: SpeakingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SpeakingService(prisma as any, genericContent as any);
    prisma.modelltest.findUnique.mockResolvedValue({ id: 'mt-1' });
    prisma.speakingExercise.findMany.mockResolvedValue([
      {
        part: 1,
        title: 'Teil 1',
        subtitle: 'Subtitle',
        topic_title: 'Topic',
        topic_description: 'Description',
        topic_points: ['A', 'B'],
        instructions: 'Instructions',
        duration_minutes: 10,
        prep_duration_seconds: 300,
        image_url: 'image',
        exam_image_url: null,
      },
    ]);
  });

  describe('getExerciseByModelltest', () => {
    it('returns generic SPRECHEN sections for A2 with three Teile', async () => {
      prisma.modelltest.findUnique.mockResolvedValue({
        id: 'a2-mt',
        level: 'A2',
      });
      const sprechenSections = [1, 2, 3].map((teil) => ({
        id: `sprechen-${teil}`,
        sectionId: `SPRECHEN_${teil}`,
        aufgabentyp: 'SPRECHEN_AUFGABE',
        teil,
        label: `Sprechen ${teil}`,
        instruction: `Instruction ${teil}`,
        maxPoints: 10,
        scoringMode: 'MANUAL',
        contentRevision: `a2-sprechen-${teil}-v1`,
        material: teil === 1 ? { topicCard: '/cards/a2-1.png' } : {},
        items: [],
      }));
      genericContent.sectionsFor.mockResolvedValue({
        LESEN: [],
        HOEREN: [],
        SPRACHBAUSTEINE: [],
        SCHREIBEN: [],
        SPRECHEN: sprechenSections,
      });

      const result = (await service.getExerciseByModelltest(
        10,
      )) as SpeakingExerciseResponseDto;

      expect(genericContent.sectionsFor).toHaveBeenCalledWith('a2-mt');
      expect(result.contentRevision).toBe('a2-sprechen-1-v1');
      expect(result.issuedAt).toEqual(expect.any(String));
      expect(result.sections).toHaveLength(3);
      expect(result.sections[0].sectionId).toBe('SPRECHEN_1');
      expect(result.sections[0].material).toEqual({
        topicCard: '/cards/a2-1.png',
      });
      expect(prisma.speakingExercise.findMany).not.toHaveBeenCalled();
    });

    it('404s for B1 (use GET /teils)', async () => {
      prisma.modelltest.findUnique.mockResolvedValue({
        id: 'b1-mt',
        level: 'B1',
      });

      await expect(service.getExerciseByModelltest(1)).rejects.toMatchObject({
        response: { messageKey: 'speakingExerciseNotFound' },
      });
      expect(genericContent.sectionsFor).not.toHaveBeenCalled();
    });

    it('404s when A2 has no generic SPRECHEN sections', async () => {
      prisma.modelltest.findUnique.mockResolvedValue({
        id: 'a2-mt',
        level: 'A2',
      });
      genericContent.sectionsFor.mockResolvedValue({
        LESEN: [],
        HOEREN: [],
        SPRACHBAUSTEINE: [],
        SCHREIBEN: [],
        SPRECHEN: [],
      });

      await expect(service.getExerciseByModelltest(10)).rejects.toMatchObject({
        response: { messageKey: 'speakingExerciseNotFound' },
      });
    });

    it('404s when the Modelltest does not exist', async () => {
      prisma.modelltest.findUnique.mockResolvedValue(null);
      await expect(service.getExerciseByModelltest(99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  it('selects and maps speaking content by Modelltest', async () => {
    const result = await service.getTeils(2);
    expect(prisma.modelltest.findUnique).toHaveBeenCalledWith({
      where: { number: 2 },
      select: { id: true },
    });
    expect(prisma.speakingExercise.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { modelltest_id: 'mt-1' } }),
    );
    expect(result[0]).toMatchObject({
      id: 1,
      part: 1,
      topicTitle: 'Topic',
      topicPoints: ['A', 'B'],
      imagePath: 'image',
    });
  });

  it('returns 404 for an invalid Modelltest', async () => {
    prisma.modelltest.findUnique.mockResolvedValue(null);
    await expect(service.getTeils(99)).rejects.toThrow(NotFoundException);
  });

  it('reads history from kept evaluations, in the old fields and the shared ones', async () => {
    prisma.speakingAttempt.findMany.mockResolvedValue([
      {
        attempt_id: 'attempt-1',
        teil_number: 1,
        modelltest_id: 'mt-1',
        score: 78,
        evaluation: { strengths: 'Gut', areas_for_improvement: 'Grammatik' },
        duration_seconds: 150,
        created_at: new Date('2026-09-01T10:00:00Z'),
      },
    ]);
    expect((await service.getSessions('student-1'))[0]).toEqual({
      sessionId: 'attempt-1',
      teilNumber: 1,
      completedAt: '2026-09-01T10:00:00.000Z',
      overallScore: 78,
      strengths: 'Gut',
      areasForImprovement: 'Grammatik',
      attemptId: 'attempt-1',
      skill: 'sprechen',
      teil: 1,
      score: 78,
      maxScore: 100,
      status: 'completed',
      durationSeconds: 150,
      modelltestId: 'mt-1',
    });
  });

  it("adds the student's numbers per Teil, for this Modelltest only", async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        teil: 1,
        attempts: 2,
        best_score: 80,
        last_score: 70,
        last_at: new Date('2026-09-02T10:00:00Z'),
      },
    ]);

    const [teil1] = await service.getTeils(1, 'student-1');

    expect(teil1).toMatchObject({
      part: 1,
      attempts: 2,
      bestScore: 80,
      lastScore: 70,
    });
    // The Modelltest id is one of the query's bound values.
    expect(JSON.stringify(prisma.$queryRaw.mock.calls[0])).toContain('mt-1');
  });
});
