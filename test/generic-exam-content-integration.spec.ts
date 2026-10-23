/**
 * GenericExamContentService.isComplete, against real Postgres: proves the
 * real A2 Modelltest 1 (Task 5, seeded by
 * prisma/migrations/20261023120000_seed_a2_modelltest1 +
 * 20261023130000_seed_a2_exam_rules) is actually exam-complete now that
 * both exam_section_weights and exam_sections exist for A2 -- the two
 * pieces Task 6 depends on, from two different commits.
 */
import { GenericExamContentService } from '../src/shared/services/generic-exam-content.service';
import { PrismaService } from '../src/shared/services/prisma.service';

const prisma = new PrismaService();
const service = new GenericExamContentService(prisma);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GenericExamContentService.isComplete, against real Postgres', () => {
  it('is true for the real A2 Modelltest 1', async () => {
    const modelltest = await prisma.modelltest.findUnique({
      where: { number: 8 },
      select: { id: true },
    });
    expect(modelltest).not.toBeNull();

    await expect(service.isComplete('A2', modelltest!.id)).resolves.toBe(true);
  });

  it('is false for a Modelltest id that has no exam_sections at all', async () => {
    await expect(
      service.isComplete('A2', '00000000-0000-0000-0000-000000000000'),
    ).resolves.toBe(false);
  });
});
