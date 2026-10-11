import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ListeningController } from '../src/modules/listening/listening.controller';
import { ListeningService } from '../src/modules/listening/listening.service';
import { TrainingAudioService } from '../src/modules/listening/training-audio.service';
import { JwtAuthGuard } from '../src/shared/guards/jwt-auth.guard';
import { StudentSubscriptionGuard } from '../src/shared/guards/student-subscription.guard';
import { PrepPassGuard } from '../src/shared/guards/prep-pass.guard';
import { createGlobalValidationPipe } from '../src/shared/pipes/global-validation.pipe';
import { PrismaService } from '../src/shared/services/prisma.service';
import { TrainingModelltestAccessService } from '../src/shared/services/training-modelltest-access.service';

describe('Listening API scoring and answer security (e2e)', () => {
  let app: INestApplication<App>;
  const exercise = {
    id: 'exercise-1',
    modelltest_id: 'modelltest-1',
    part: 1,
    content_revision: 'listening-v1',
    audio_url: 'https://example.test/audio.mp3',
    bundled_audio_asset: null,
    image_url: 'https://example.test/image.png',
    exam_plays_allowed: 1,
    questions: [
      {
        question_number: 41,
        prompt: 'Statement 41',
        correct_answer: '+',
        sort_order: 0,
      },
      {
        question_number: 42,
        prompt: 'Statement 42',
        correct_answer: '-',
        sort_order: 1,
      },
    ],
  };
  const prisma: any = {
    listeningExercise: { findFirst: jest.fn() },
    listeningAttempt: { create: jest.fn(), findUnique: jest.fn() },
    student: { findUnique: jest.fn() },
    studentActivity: { create: jest.fn() },
    $transaction: jest.fn((work: any) => work(prisma)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.listeningExercise.findFirst.mockResolvedValue(exercise);
    prisma.listeningAttempt.create.mockResolvedValue({});
    prisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
    prisma.studentActivity.create.mockResolvedValue({});

    const moduleRef = await Test.createTestingModule({
      controllers: [ListeningController],
      providers: [
        ListeningService,
        {
          provide: TrainingAudioService,
          useValue: { play: jest.fn() },
        },
        {
          provide: TrainingModelltestAccessService,
          useValue: { assertMayAccess: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: PrismaService, useValue: prisma },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          context.switchToHttp().getRequest().student = {
            studentId: 'student-1',
          };
          return true;
        },
      })
      // Entitlement / Prep Pass are their own specs; this file is about the
      // route behaving correctly for a student who may learn.
      .overrideGuard(StudentSubscriptionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PrepPassGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(createGlobalValidationPipe());
    await app.init();
  });

  afterEach(async () => app.close());

  it('does not expose correct answers or durable audio URLs when fetching an exercise', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/listening/exercise?teil=1&modelltest=1')
      .expect(200);

    expect(response.body).toMatchObject({
      audioId: 'exercise-1',
      playsAllowed: 1,
      contentRevision: 'listening-v1',
      imagePath: 'https://example.test/image.png',
      questions: [
        { id: 'q41', prompt: 'Statement 41' },
        { id: 'q42', prompt: 'Statement 42' },
      ],
    });
    expect(JSON.stringify(response.body)).not.toContain('correct_answer');
    expect(JSON.stringify(response.body)).not.toContain('audio_url');
    expect(JSON.stringify(response.body)).not.toContain(
      'https://example.test/audio.mp3',
    );
  });

  it('computes the score in the real service and persists it', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/listening/submit')
      .send({
        modelltestNumber: 1,
        type: '1',
        timed: false,
        content_revision: 'listening-v1',
        answers: { q41: '+', q42: '+' },
      })
      .expect(201);

    expect(response.body).toEqual({
      attemptId: expect.any(String),
      score: 50,
      answerKey: { q41: '+', q42: '-' },
    });
    expect(prisma.listeningAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ score: 50, student_id: 'student-1' }),
    });
  });

  it('returns an error instead of success when persistence fails', async () => {
    prisma.listeningAttempt.create.mockRejectedValue(
      new Error('database unavailable'),
    );

    await request(app.getHttpServer())
      .post('/api/listening/submit')
      .send({
        type: '1',
        timed: false,
        content_revision: 'listening-v1',
        answers: { q41: '+' },
      })
      .expect(500);
  });
});
