/**
 * Grammar of-the-day against real Postgres: lesson → linear exercises.
 */
import { ConflictException } from '@nestjs/common';
import { MODELLTEST_PERIOD_EPOCH_MS } from '../src/modules/modelltests/seven-day-period';
import { GrammarService } from '../src/modules/grammar/grammar.service';
import { PrismaService } from '../src/shared/services/prisma.service';
import { TrainingModelltestAccessService } from '../src/shared/services/training-modelltest-access.service';

const prisma = new PrismaService();
const SLUG = `grammar-int-${Date.now()}`;

async function wipe() {
  await prisma.grammarTopic.deleteMany({
    where: { slug: { startsWith: 'grammar-int-' } },
  });
  await prisma.student.deleteMany({
    where: { email: { startsWith: 'grammar-int-' } },
  });
}

beforeEach(wipe);

afterAll(async () => {
  await wipe();
  await prisma.onModuleDestroy();
});

describe('grammar of-the-day integration', () => {
  it('walks lesson complete then unlocks on success only', async () => {
    const student = await prisma.student.create({
      data: {
        email: `grammar-int-${Date.now()}@test.local`,
        email_verified: true,
      },
    });

    // Single published topic so of-the-day is deterministic regardless of dayIndex.
    const topic = await prisma.grammarTopic.create({
      data: {
        slug: SLUG,
        category: 'Cases',
        title_de: 'Nominativ',
        title_fr: 'Nominatif',
        title_en: 'Nominative',
        cefr_levels: ['A1'],
        rule_de: 'Regel',
        rule_fr: 'Rule',
        rule_en: 'Rule',
        published: true,
        sort_order: 0,
        examples: {
          create: [
            {
              de: 'Der Hund bellt.',
              en: 'The dog barks.',
              fr: 'The dog barks.',
            },
          ],
        },
        exercises: {
          create: [
            {
              kind: 'mcq',
              difficulty: 'easy',
              sort_order: 0,
              prompt_fr: 'Q0',
              options_json: ['oui', 'non'],
              answer: 'oui',
              explanation_fr: 'ok',
            },
            {
              kind: 'mcq',
              difficulty: 'medium',
              sort_order: 0,
              prompt_fr: 'Q1',
              options_json: ['a', 'b'],
              answer: 'a',
              explanation_fr: 'ok',
            },
          ],
        },
      },
    });

    const mt = await prisma.modelltest.findFirst({
      where: { exam_only: false },
      orderBy: { number: 'asc' },
    });
    if (!mt) {
      throw new Error('Need at least one training Modelltest for integration');
    }
    await prisma.grammarTopicModelltest.create({
      data: {
        topic_id: topic.id,
        modelltest_id: mt.id,
        sort_order: 0,
      },
    });

    const trainingAccess = {
      weeklyModelltestNumber: jest.fn().mockResolvedValue(mt.number),
    } as unknown as TrainingModelltestAccessService;

    const service = new GrammarService(prisma, trainingAccess);
    const now = new Date(MODELLTEST_PERIOD_EPOCH_MS);

    const day = await service.getOfTheDay(student.id, now);
    expect(day.topic.id).toBe(topic.id);
    expect(day.progress.lessonCompleted).toBe(false);

    await service.completeLesson(student.id, now);

    const aheadId = (await service.getExercisesOfTheDay(student.id, now))
      .exercises[1].id;
    await expect(
      service.submitExercise(student.id, aheadId, 'a', now),
    ).rejects.toBeInstanceOf(ConflictException);

    const list = await service.getExercisesOfTheDay(student.id, now);
    expect(list.exercises[0].status).toBe('unlocked');
    expect(list.exercises[1].status).toBe('locked');

    const wrong = await service.submitExercise(
      student.id,
      list.exercises[0].id,
      'non',
      now,
    );
    expect(wrong.correct).toBe(false);
    expect(wrong.nextExerciseIndex).toBe(0);

    const right = await service.submitExercise(
      student.id,
      list.exercises[0].id,
      'oui',
      now,
    );
    expect(right.correct).toBe(true);
    expect(right.nextExerciseIndex).toBe(1);

    const after = await service.getExercisesOfTheDay(student.id, now);
    expect(after.exercises[0].status).toBe('completed');
    expect(after.exercises[1].status).toBe('unlocked');
  });
});
