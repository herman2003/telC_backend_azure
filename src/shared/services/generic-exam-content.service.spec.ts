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
          content_revision: 'a2-lesen-1-v1',
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
              imageUrl: null,
              options: [
                {
                  key: 'a',
                  content: 'Antwort',
                  isCorrect: true,
                  imageUrl: null,
                },
              ],
            }),
          ],
        }),
      ]);
      expect(result.SPRACHBAUSTEINE).toEqual([]);
    });

    it('merges material.optionImages and material.itemImages onto items', async () => {
      mockPrisma.examSection.findMany.mockResolvedValue([
        {
          skill: 'HOEREN',
          teil: 1,
          aufgabentyp: 'EINZELAUSWAHL',
          label: 'Hören Teil 1',
          instruction: 'Kreuzen Sie an.',
          max_points: 1,
          scoring_mode: 'AUTO',
          content_revision: 'a1-hoeren-1-v1',
          material: {
            optionImages: {
              '1': {
                a: 'https://cdn.example/a.png',
                b: 'https://cdn.example/b.png',
              },
            },
          },
          items: [
            {
              item_number: 1,
              prompt: 'Was kostet der Pullover?',
              solution: { key: 'a' },
              options: [
                { key: 'a', content: '30 €', is_correct: true },
                { key: 'b', content: '95 €', is_correct: false },
              ],
            },
          ],
        },
        {
          skill: 'HOEREN',
          teil: 1,
          aufgabentyp: 'KURZANTWORT',
          label: 'Hören notes',
          instruction: 'Ergänzen Sie.',
          max_points: 1,
          scoring_mode: 'AUTO',
          content_revision: 'a2-hoeren-1-v1',
          material: {
            itemImages: { '1': 'https://cdn.example/note.png' },
          },
          items: [
            {
              item_number: 1,
              prompt: 'Rufnummer',
              solution: { acceptedAnswers: ['1'] },
              options: [],
            },
          ],
        },
      ]);

      // Two HOEREN rows with the same teil is unrealistic; call sectionFor
      // paths separately by mocking findFirst via sectionsFor grouping.
      const result = await service.sectionsFor('mt-1');
      const pictures = result.HOEREN[0];
      expect(pictures.items[0].options.map((o) => o.imageUrl)).toEqual([
        'https://cdn.example/a.png',
        'https://cdn.example/b.png',
      ]);
      expect(result.HOEREN[1].items[0].imageUrl).toBe(
        'https://cdn.example/note.png',
      );
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
