/**
 * A2 Modelltest 1 (Task 5 of docs/plans/active/multi-level-phase-3-generic-model.md)
 * is real telc content, seeded by prisma/migrations/20261023120000_seed_a2_modelltest1
 * and picture URLs by 20261024120000_a1_a2_mt1_image_urls.
 * Every answer was cross-checked by hand against the PDF's own Lösungsschlüssel
 * (page 42) before this test was written.
 *
 * This is the generic model's equivalent of the B1 golden-master fixtures: a
 * future schema or importer refactor that silently corrupts this content
 * fails here, not in production.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaService } from '../../src/shared/services/prisma.service';
import { GenericExamContentService } from '../../src/shared/services/generic-exam-content.service';
import { withoutAnswerKey } from '../../src/modules/centers/exam-content';

const prisma = new PrismaService();
const content = new GenericExamContentService(prisma);
const MODELLTEST_NUMBER = 8;

afterAll(async () => {
  await prisma.$disconnect();
});

describe('A2 Modelltest 1 content (real, not synthetic)', () => {
  it('is level A2, in the training catalogue, 60 points total', async () => {
    const modelltest = await prisma.modelltest.findUnique({
      where: { number: MODELLTEST_NUMBER },
    });

    expect(modelltest?.level).toBe('A2');
    expect(modelltest?.exam_only).toBe(false);

    const sections = await prisma.examSection.findMany({
      where: { modelltest_id: modelltest!.id },
    });
    expect(sections).toHaveLength(11);
    expect(sections.reduce((sum, s) => sum + s.max_points, 0)).toBe(60);
  });

  it('carries the Exam Day Hören delivery contract and grade bands', async () => {
    const modelltest = await prisma.modelltest.findUnique({
      where: { number: MODELLTEST_NUMBER },
      select: { format: true },
    });

    const format = modelltest?.format as {
      hoerenDelivery?: {
        deliveryMode: string;
        pauseAllowed: boolean;
        playsAllowed: number;
        recordings: {
          teil: number;
          audioUrl: string | null;
          durationSeconds: number | null;
        }[];
      };
      gradeBands?: unknown[];
    } | null;
    const delivery = format?.hoerenDelivery;
    expect(delivery?.deliveryMode).toBe('PER_TEIL_RECORDINGS');
    expect(delivery?.pauseAllowed).toBe(false);
    expect(delivery?.playsAllowed).toBe(1);
    // One uploaded recording per Teil, MP3 (the Flutter player sends audio/mpeg).
    expect(delivery?.recordings.map((r) => r.teil)).toEqual([1, 2, 3]);
    for (const recording of delivery?.recordings ?? []) {
      expect(recording.audioUrl).toMatch(
        /\/a2-hoeren-mt\/a2-mt-1-hoeren\/a2-modelltest-1-hoeren-teil\d\.mp3$/,
      );
      expect(recording.durationSeconds).toBeGreaterThan(0);
    }
    expect(format?.gradeBands).toHaveLength(5);
  });

  it("matches the PDF's Lösungsschlüssel on a sample of auto-scored items", async () => {
    const modelltest = await prisma.modelltest.findUnique({
      where: { number: MODELLTEST_NUMBER },
    });
    const items = await prisma.examItem.findMany({
      where: { section: { modelltest_id: modelltest!.id } },
      include: { section: { select: { skill: true, teil: true } } },
      orderBy: { item_number: 'asc' },
    });

    const find = (skill: string, teil: number, itemNumber: number) =>
      items.find(
        (i) =>
          i.section.skill === skill &&
          i.section.teil === teil &&
          i.item_number === itemNumber,
      );

    // Hören Teil 1, item 1 -- the phone number.
    expect(
      (find('HOEREN', 1, 1)?.solution as { acceptedAnswers: string[] })
        .acceptedAnswers,
    ).toContain('168 85 38');

    // Hören Teil 3, item 11 -- Leiterin Export sits gegenüber dem Chefbüro (b).
    expect(
      (find('HOEREN', 3, 11)?.solution as { choiceKey: string }).choiceKey,
    ).toBe('b');

    // Lesen Teil 2, item 7 -- "Maria Luisa ist gegen die Hochzeit" is falsch.
    expect((find('LESEN', 2, 7)?.solution as { value: boolean }).value).toBe(
      false,
    );

    // Lesen Teil 3, item 13 -- the Kochkurs situation has no matching ad.
    expect(
      (find('LESEN', 3, 13)?.solution as { choiceKey: string | null })
        .choiceKey,
    ).toBeNull();

    // Schreiben Teil 1, item 4 -- Familienstand.
    expect(
      (find('SCHREIBEN', 1, 4)?.solution as { acceptedAnswers: string[] })
        .acceptedAnswers,
    ).toEqual(['verheiratet']);
  });

  it('EINZELAUSWAHL options mark exactly the official answer as correct', async () => {
    const modelltest = await prisma.modelltest.findUnique({
      where: { number: MODELLTEST_NUMBER },
    });
    // Lesen Teil 1, item 1: "ein Buch für Ihre 12-jährige Nichte" -> 2. Stock (b).
    const item = await prisma.examItem.findFirst({
      where: {
        section: { modelltest_id: modelltest!.id, skill: 'LESEN', teil: 1 },
        item_number: 1,
      },
      include: { options: true },
    });

    expect(item?.options.find((o) => o.key === 'b')?.is_correct).toBe(true);
    expect(item?.options.filter((o) => o.is_correct)).toHaveLength(1);
  });

  it('serves R2 picture URLs that match the source file, without the answer key', async () => {
    const source = JSON.parse(
      readFileSync(
        resolve(__dirname, '..', '..', 'content', 'a2-modelltest-1-source.json'),
        'utf8',
      ),
    ) as {
      assets: { imageUrl: string }[];
      sections: {
        HOEREN: {
          content: { items: { number: number; imageUrl: string }[] };
        }[];
        LESEN: {
          sectionId: string;
          content: {
            stimulus?: { imageUrl: string };
            choices?: { key: string; imageUrl: string }[];
          };
        }[];
      };
    };

    const modelltest = await prisma.modelltest.findUniqueOrThrow({
      where: { number: MODELLTEST_NUMBER },
      select: { id: true, assets: true },
    });
    const dbAssets = modelltest.assets as { imageUrl: string }[];
    expect(dbAssets).toHaveLength(23);
    expect(dbAssets.map((a) => a.imageUrl).sort()).toEqual(
      source.assets.map((a) => a.imageUrl).sort(),
    );

    const hoeren1 = await content.sectionFor(modelltest.id, 'HOEREN', 1);
    expect(hoeren1?.items.map((i) => i.imageUrl)).toEqual(
      source.sections.HOEREN[0].content.items.map((i) => i.imageUrl),
    );

    const lesen1 = await content.sectionFor(modelltest.id, 'LESEN', 1);
    expect((lesen1?.material as { stimulus: { imageUrl: string } }).stimulus.imageUrl).toBe(
      source.sections.LESEN.find((s) => s.sectionId === 'LESEN_1')!.content
        .stimulus!.imageUrl,
    );

    const lesen3 = await content.sectionFor(modelltest.id, 'LESEN', 3);
    expect(
      (lesen3?.material as { choices: { imageUrl: string }[] }).choices.map(
        (c) => c.imageUrl,
      ),
    ).toEqual(
      source.sections.LESEN.find((s) => s.sectionId === 'LESEN_3')!.content
        .choices!.map((c) => c.imageUrl),
    );

    const served = withoutAnswerKey({ HOEREN: [hoeren1], LESEN: [lesen1, lesen3] });
    const whole = JSON.stringify(served);
    expect(whole).toContain('a2-modelltest-1-hoeren-1-item1-note.png');
    expect(whole).toContain('a2-modelltest-1-lesen-1-directory.png');
    expect(whole).not.toContain('"solution"');
    expect(whole).not.toContain('"isCorrect"');
  });
});
