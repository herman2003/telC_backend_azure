/**
 * The seeded exam rules for B2, against real Postgres.
 *
 * `exam_block_durations` and `exam_section_weights` are the only description
 * the backend has of what a level's exam is worth and how long it runs. A
 * sitting with no rows for its level raises EXAM_TIMINGS_MISSING or
 * EXAM_WEIGHTS_MISSING; a sitting with wrong rows reports a wrong result and
 * raises nothing. So the values are asserted here rather than trusted.
 *
 * telc Deutsch B2, Uebungstest 1 (2019): 300 points, written 225 and oral 75;
 * Leseverstehen 75, Sprachbausteine 30, Hoerverstehen 75, Schriftlicher
 * Ausdruck 45, Muendlicher Ausdruck 75. Blocks run 90 / ~20 / 30 minutes.
 *
 * B1 is asserted alongside it. These two levels share every point value and
 * differ only in the Hoeren duration, so a mistake that overwrote B1 with
 * B2's numbers would be invisible in the B2 assertions alone.
 */
import { PrismaService } from '../src/shared/services/prisma.service';

const prisma = new PrismaService();

type WeightRow = {
  skill: string;
  teil: number;
  max_points: number;
  part: string;
};

const weightsFor = (level: 'B1' | 'B2') =>
  prisma.examSectionWeight.findMany({
    where: { level },
    orderBy: [{ skill: 'asc' }, { teil: 'asc' }],
    select: { skill: true, teil: true, max_points: true, part: true },
  }) as Promise<WeightRow[]>;

const durationsFor = (level: 'B1' | 'B2') =>
  prisma.examBlockDuration.findMany({
    where: { level },
    orderBy: { position: 'asc' },
    select: { block: true, minutes: true, position: true },
  });

const sumOf = (rows: WeightRow[], part: 'WRITTEN' | 'ORAL') =>
  rows
    .filter((row) => row.part === part)
    .reduce((total, row) => total + row.max_points, 0);

/**
 * The ten rows telc's grid comes to, in the order the query returns them.
 *
 * `skill` is a Postgres enum, so `ORDER BY skill ASC` sorts by the enum's
 * declared order (HOEREN, LESEN, SPRACHBAUSTEINE, SCHREIBEN, SPRECHEN), not
 * alphabetically -- SPRACHBAUSTEINE comes before SCHREIBEN here even though
 * "SCH" < "SPR" in ASCII.
 */
const EXPECTED_WEIGHTS: WeightRow[] = [
  { skill: 'HOEREN', teil: 1, max_points: 25, part: 'WRITTEN' },
  { skill: 'HOEREN', teil: 2, max_points: 25, part: 'WRITTEN' },
  { skill: 'HOEREN', teil: 3, max_points: 25, part: 'WRITTEN' },
  { skill: 'LESEN', teil: 1, max_points: 25, part: 'WRITTEN' },
  { skill: 'LESEN', teil: 2, max_points: 25, part: 'WRITTEN' },
  { skill: 'LESEN', teil: 3, max_points: 25, part: 'WRITTEN' },
  { skill: 'SPRACHBAUSTEINE', teil: 1, max_points: 15, part: 'WRITTEN' },
  { skill: 'SPRACHBAUSTEINE', teil: 2, max_points: 15, part: 'WRITTEN' },
  { skill: 'SCHREIBEN', teil: 1, max_points: 45, part: 'WRITTEN' },
  { skill: 'SPRECHEN', teil: 1, max_points: 75, part: 'ORAL' },
];

describe('B2 exam rules', () => {
  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  describe('exam_section_weights', () => {
    it('B2 has the ten rows of the telc grid', async () => {
      expect(await weightsFor('B2')).toEqual(EXPECTED_WEIGHTS);
    });

    it('B2 sums to 225 written and 75 oral', async () => {
      const rows = await weightsFor('B2');
      expect(sumOf(rows, 'WRITTEN')).toBe(225);
      expect(sumOf(rows, 'ORAL')).toBe(75);
    });

    /**
     * Sprechen is one row of 75, not three of 25.
     *
     * telc marks the oral as one conversation against the M10 criteria, and
     * B1 is stored the same way, so a trainer's marking screen is identical
     * at both levels. The per-part breakdown lives in the M10 tables.
     */
    it('B2 Sprechen is a single oral row worth 75', async () => {
      const oral = (await weightsFor('B2')).filter(
        (row) => row.part === 'ORAL',
      );
      expect(oral).toEqual([
        { skill: 'SPRECHEN', teil: 1, max_points: 75, part: 'ORAL' },
      ]);
    });

    it('B1 still has its own ten rows, with the same values', async () => {
      expect(await weightsFor('B1')).toEqual(EXPECTED_WEIGHTS);
    });
  });

  describe('exam_block_durations', () => {
    it('B2 runs 90 / 20 / 30 in that order', async () => {
      expect(await durationsFor('B2')).toEqual([
        { block: 'LESEN_SPRACHBAUSTEINE', minutes: 90, position: 1 },
        { block: 'HOEREN', minutes: 20, position: 2 },
        { block: 'SCHREIBEN', minutes: 30, position: 3 },
      ]);
    });

    /** The single number that differs between the two levels. */
    it('Hoeren is 20 minutes at B2 and still 30 at B1', async () => {
      const [b1, b2] = await Promise.all([
        durationsFor('B1'),
        durationsFor('B2'),
      ]);
      expect(b1.find((row) => row.block === 'HOEREN')?.minutes).toBe(30);
      expect(b2.find((row) => row.block === 'HOEREN')?.minutes).toBe(20);
    });

    it('B1 still runs 90 / 30 / 30 in that order', async () => {
      expect(await durationsFor('B1')).toEqual([
        { block: 'LESEN_SPRACHBAUSTEINE', minutes: 90, position: 1 },
        { block: 'HOEREN', minutes: 30, position: 2 },
        { block: 'SCHREIBEN', minutes: 30, position: 3 },
      ]);
    });
  });
});
