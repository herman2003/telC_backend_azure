import { GenericExamContentService } from './generic-exam-content.service';

const mockPrisma = {
  examSection: { findMany: jest.fn() },
  examSectionWeight: { findMany: jest.fn() },
};

describe('GenericExamContentService', () => {
  let service: GenericExamContentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GenericExamContentService(mockPrisma as never);
  });

  describe('sectionsFor', () => {
    it('groups sections by skill, one empty list per skill the level lacks', async () => {
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

      const result = await service.sectionsFor('mt-1');

      expect(result.LESEN).toEqual([
        expect.objectContaining({
          sectionId: 'LESEN_1',
          aufgabentyp: 'EINZELAUSWAHL',
          maxPoints: 5,
          scoringMode: 'AUTO',
          items: [
            expect.objectContaining({
              itemNumber: 1,
              options: [{ key: 'a', content: 'Antwort', isCorrect: true }],
            }),
          ],
        }),
      ]);
      expect(result.SPRACHBAUSTEINE).toEqual([]);
    });
  });

  describe('isComplete', () => {
    it('is false when the level has no exam_section_weights rows at all', async () => {
      mockPrisma.examSectionWeight.findMany.mockResolvedValue([]);
      mockPrisma.examSection.findMany.mockResolvedValue([]);

      expect(await service.isComplete('A1', 'mt-1')).toBe(false);
    });

    it('is false when a weighted Teil has no matching section', async () => {
      mockPrisma.examSectionWeight.findMany.mockResolvedValue([
        { skill: 'HOEREN', teil: 1 },
        { skill: 'HOEREN', teil: 2 },
      ]);
      mockPrisma.examSection.findMany.mockResolvedValue([
        { skill: 'HOEREN', teil: 1 },
      ]);

      expect(await service.isComplete('A2', 'mt-1')).toBe(false);
    });

    it('is true when every weighted Teil has a matching section', async () => {
      mockPrisma.examSectionWeight.findMany.mockResolvedValue([
        { skill: 'HOEREN', teil: 1 },
        { skill: 'LESEN', teil: 1 },
      ]);
      mockPrisma.examSection.findMany.mockResolvedValue([
        { skill: 'HOEREN', teil: 1 },
        { skill: 'LESEN', teil: 1 },
        // An extra section not named by any weight is harmless.
        { skill: 'SPRECHEN', teil: 1 },
      ]);

      expect(await service.isComplete('A2', 'mt-1')).toBe(true);
    });
  });
});
