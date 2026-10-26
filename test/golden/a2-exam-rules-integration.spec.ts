/**
 * exam_section_weights/exam_block_durations had zero A2 rows until this
 * migration (20261023130000_seed_a2_exam_rules) -- found while scoping
 * Phase 3 Task 6. Without them, progress.service.ts's weightsFor('A2')
 * throws EXAM_WEIGHTS_MISSING for every real A2 student, and
 * exam-grading.service.ts cannot mark an A2 Teil at all.
 *
 * Verified against the real telc A2 PDF (same source as Task 5's content),
 * not guessed. A1 is deliberately not seeded or asserted here -- see the
 * migration's own comment.
 */
import { PrismaService } from '../../src/shared/services/prisma.service';

const prisma = new PrismaService();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('A2 exam_section_weights / exam_block_durations', () => {
  it('sums to 60 points across all four skills', async () => {
    const rows = await prisma.examSectionWeight.findMany({
      where: { level: 'A2' },
    });

    expect(rows).toHaveLength(11);
    expect(rows.reduce((sum, r) => sum + r.max_points, 0)).toBe(60);
  });

  it('matches the official telc A2 per-Teil points exactly', async () => {
    const rows = await prisma.examSectionWeight.findMany({
      where: { level: 'A2' },
      select: { skill: true, teil: true, max_points: true, part: true },
      orderBy: [{ skill: 'asc' }, { teil: 'asc' }],
    });

    expect(rows).toEqual([
      { skill: 'HOEREN', teil: 1, max_points: 5, part: 'WRITTEN' },
      { skill: 'HOEREN', teil: 2, max_points: 5, part: 'WRITTEN' },
      { skill: 'HOEREN', teil: 3, max_points: 5, part: 'WRITTEN' },
      { skill: 'LESEN', teil: 1, max_points: 5, part: 'WRITTEN' },
      { skill: 'LESEN', teil: 2, max_points: 5, part: 'WRITTEN' },
      { skill: 'LESEN', teil: 3, max_points: 5, part: 'WRITTEN' },
      { skill: 'SCHREIBEN', teil: 1, max_points: 5, part: 'WRITTEN' },
      { skill: 'SCHREIBEN', teil: 2, max_points: 10, part: 'WRITTEN' },
      { skill: 'SPRECHEN', teil: 1, max_points: 3, part: 'ORAL' },
      { skill: 'SPRECHEN', teil: 2, max_points: 6, part: 'ORAL' },
      { skill: 'SPRECHEN', teil: 3, max_points: 6, part: 'ORAL' },
    ]);
  });

  it('puts Lesen and Schreiben in one timed block, unlike B1/B2', async () => {
    const rows = await prisma.examSectionWeight.findMany({
      where: { level: 'A2', part: 'WRITTEN' },
      select: { skill: true, block: true },
    });

    expect(
      rows.filter((r) => r.skill === 'LESEN' || r.skill === 'SCHREIBEN'),
    ).not.toHaveLength(0);
    expect(
      rows
        .filter((r) => r.skill === 'LESEN' || r.skill === 'SCHREIBEN')
        .every((r) => r.block === 'LESEN_SCHREIBEN'),
    ).toBe(true);
    expect(
      rows.filter((r) => r.skill === 'HOEREN').every((r) => r.block === 'HOEREN'),
    ).toBe(true);
  });

  it('has no block for Sprechen (ORAL) -- same as B1/B2', async () => {
    const rows = await prisma.examSectionWeight.findMany({
      where: { level: 'A2', skill: 'SPRECHEN' },
      select: { block: true },
    });

    expect(rows.every((r) => r.block === null)).toBe(true);
  });

  it('seeds 2 block durations (Hören, Lesen+Schreiben) totaling 70 minutes', async () => {
    const rows = await prisma.examBlockDuration.findMany({
      where: { level: 'A2' },
      orderBy: { position: 'asc' },
    });

    expect(rows.map((r) => [r.block, r.minutes])).toEqual([
      ['HOEREN', 20],
      ['LESEN_SCHREIBEN', 50],
    ]);
  });

  it('leaves B1/B2 weights exactly as they were (equality, Principle 2)', async () => {
    const b1 = await prisma.examSectionWeight.findMany({
      where: { level: 'B1' },
    });
    const b2 = await prisma.examSectionWeight.findMany({
      where: { level: 'B2' },
    });

    expect(b1).toHaveLength(10);
    expect(b2).toHaveLength(10);
    expect(b1.reduce((sum, r) => sum + r.max_points, 0)).toBe(300);
    expect(b2.reduce((sum, r) => sum + r.max_points, 0)).toBe(300);
  });
});
