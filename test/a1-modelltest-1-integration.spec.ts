/**
 * A1 Modelltest 1 and the A1 exam rules, against real Postgres
 * (prisma/migrations/20261024100000_seed_a1_modelltest1 +
 * 20261024100100_seed_a1_exam_rules).
 *
 * The rows are what Exam Day reads; a wrong weight reports a wrong result
 * and raises nothing, so the values are asserted rather than trusted.
 */
import { GenericExamContentService } from '../src/shared/services/generic-exam-content.service';
import { PrismaService } from '../src/shared/services/prisma.service';
import {
  markGenericSection,
  pointsOf,
} from '../src/modules/centers/generic-section-scoring';

const prisma = new PrismaService();
const content = new GenericExamContentService(prisma);

let modelltestId: string;

beforeAll(async () => {
  const row = await prisma.modelltest.findUnique({
    where: { number: 9 },
    select: { id: true, level: true },
  });
  expect(row?.level).toBe('A1');
  modelltestId = row!.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('A1 exam rules', () => {
  it('times Hören at 20 minutes, then Lesen und Schreiben at 45', async () => {
    const rows = await prisma.examBlockDuration.findMany({
      where: { level: 'A1' },
      orderBy: { position: 'asc' },
      select: { block: true, minutes: true },
    });

    expect(rows).toEqual([
      { block: 'HOEREN', minutes: 20 },
      { block: 'LESEN_SCHREIBEN', minutes: 45 },
    ]);
  });

  it('weights each Teil as telc does, 60 points in all', async () => {
    const rows = await prisma.examSectionWeight.findMany({
      where: { level: 'A1' },
      orderBy: [{ skill: 'asc' }, { teil: 'asc' }],
      select: { skill: true, teil: true, max_points: true, block: true },
    });

    expect(rows.map((r) => [r.skill, r.teil, r.max_points, r.block])).toEqual([
      ['HOEREN', 1, 6, 'HOEREN'],
      ['HOEREN', 2, 4, 'HOEREN'],
      ['HOEREN', 3, 5, 'HOEREN'],
      ['LESEN', 1, 5, 'LESEN_SCHREIBEN'],
      ['LESEN', 2, 5, 'LESEN_SCHREIBEN'],
      ['LESEN', 3, 5, 'LESEN_SCHREIBEN'],
      ['SCHREIBEN', 1, 5, 'LESEN_SCHREIBEN'],
      ['SCHREIBEN', 2, 10, 'LESEN_SCHREIBEN'],
      ['SPRECHEN', 1, 3, null],
      ['SPRECHEN', 2, 6, null],
      ['SPRECHEN', 3, 6, null],
    ]);
  });
});

describe('A1 Modelltest 1 rows', () => {
  it('is exam-complete at A1', async () => {
    await expect(content.isComplete('A1', modelltestId)).resolves.toBe(true);
  });

  it('keeps the Lesen texts with the items they belong to', async () => {
    const lesen1 = await content.sectionFor(modelltestId, 'LESEN', 1);
    const texts = (lesen1?.material as { texts: { forItems: number[] }[] })
      .texts;

    expect(texts.map((t) => t.forItems)).toEqual([
      [1, 2],
      [3, 4, 5],
    ]);
  });

  it('stores the payment choices as the field’s options', async () => {
    const form = await content.sectionFor(modelltestId, 'SCHREIBEN', 1);
    const payment = form?.items.find((item) => item.itemNumber === 4);

    expect(payment?.options.map((o) => [o.key, o.isCorrect])).toEqual([
      ['Bar', true],
      ['Kreditkarte', false],
    ]);
  });

  it('keeps both Sprechen Teil 2 topics', async () => {
    const teil2 = await content.sectionFor(modelltestId, 'SPRECHEN', 2);
    const rounds = (teil2?.material as { rounds: { topic: string }[] }).rounds;

    expect(rounds.map((r) => r.topic)).toEqual([
      'Essen und Trinken',
      'Einkaufen',
    ]);
    expect(teil2?.items).toEqual([]);
  });

  it('gives full marks to the key’s own answers: Hören 15, Lesen 15, form 5', async () => {
    const bySkill = await content.sectionsFor(modelltestId);
    const weights = await prisma.examSectionWeight.findMany({
      where: { level: 'A1' },
    });
    const totals: Record<string, number> = {};

    for (const [skill, sections] of Object.entries(bySkill)) {
      for (const section of sections) {
        if (section.scoringMode !== 'AUTO') continue;
        const answers = Object.fromEntries(
          section.items.map((item) => {
            const solution = item.solution as {
              key?: string;
              value?: boolean;
              acceptedAnswers?: string[];
            };
            return [
              String(item.itemNumber),
              solution.key ?? solution.value ?? solution.acceptedAnswers?.[0],
            ];
          }),
        );
        const mark = markGenericSection(section, answers);
        const weight = weights.find(
          (w) => w.skill === skill && w.teil === section.teil,
        );
        expect(mark.unrecognised).toEqual([]);
        totals[skill] =
          (totals[skill] ?? 0) + pointsOf(mark, weight!.max_points);
      }
    }

    expect(totals).toEqual({ HOEREN: 15, LESEN: 15, SCHREIBEN: 5 });
  });

  it('sends a misspelt form answer to the examiner, not to wrong', async () => {
    const form = await content.sectionFor(modelltestId, 'SCHREIBEN', 1);
    const mark = markGenericSection(form!, {
      '1': '4',
      '2': '2',
      '3': 'Seheim',
      '4': 'Bar',
      '5': 'Sonntag',
    });

    expect(mark.correct).toBe(4);
    expect(mark.unrecognised).toEqual([{ itemNumber: 3, answer: 'Seheim' }]);
  });

  it('marks the wrong payment choice wrong, with nothing for the examiner', async () => {
    const form = await content.sectionFor(modelltestId, 'SCHREIBEN', 1);
    const mark = markGenericSection(form!, {
      '1': '4',
      '2': '2',
      '3': 'Seeheim',
      '4': 'Kreditkarte',
      '5': 'Sonntag',
    });

    expect(mark.correct).toBe(4);
    expect(mark.unrecognised).toEqual([]);
  });
});
