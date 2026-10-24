/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { WritingService } from '../src/modules/writing/writing.service';
import { WritingDailyQuotaService } from '../src/modules/writing/writing-daily-quota.service';
import { PrismaService } from '../src/shared/services/prisma.service';
import type { WritingExerciseStimulus } from '../src/modules/writing/dto';

const FAKE_EXERCISE = {
  id: 'uuid-exercise-1',
  content_revision: 'v1',
  title: 'E-Mail / Brief',
  subtitle: 'Formeller Brief',
  task_type: 'brief',
  intro: 'Sie sehen folgende Anzeige:',
  stimulus: {
    heading: 'Büroräume in Neubaukomplex zu vermieten!',
    body: 'In unserem neu gebauten Bürogebäude sind noch Räume frei',
    features: [
      'Gebäude mit 6 Stockwerken',
      'zentrale Lage',
      'helle, großzügige Büros, zwischen 15 und 25 m²',
      'Kaffeeküche',
      'Konferenzräume',
      'vier Aufzüge',
      'moderne Anschlüsse in allen Räumen (z. B. Internet/DSL-Anschlüsse)',
      'Hausmeisterservice rund um die Uhr',
      'moderne Sicherheitstechnik',
    ],
    callToAction:
      'Vereinbaren Sie einen Besichtigungstermin oder fordern Sie weitere Informationen an:',
    contact: {
      name: 'CenterBüros GmbH',
      lines: ['Neuer Wall 120', '50160 Köln'],
    },
  },
  task_instructions:
    'Sie arbeiten in einem Übersetzerbüro. Ihr Chef möchte größere Büroräume mieten.',
  bullet_points: [
    'Beschreiben Sie Ihr Unternehmen.',
    'Was für Räume brauchen Sie?',
    'Wie viele Räume brauchen Sie?',
    'Wann brauchen Sie die Räume?',
    'Fragen Sie nach den Kosten.',
  ],
  closing_reminder:
    'Bevor Sie den Brief schreiben, überlegen Sie sich die passende Reihenfolge der Punkte.',
  modelltest_id: 'uuid-modelltest-1',
  created_at: new Date(),
};

describe('WritingService', () => {
  let service: WritingService;

  const mockPrismaService = {
    writingExercise: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    writingAttempt: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockQueue = {
    add: jest.fn().mockResolvedValue(undefined),
  };

  const mockDailyQuota = {
    assertMaySubmit: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WritingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: WritingDailyQuotaService, useValue: mockDailyQuota },
        { provide: 'WRITING_CORRECTION_QUEUE', useValue: mockQueue },
      ],
    }).compile();

    service = module.get<WritingService>(WritingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getExerciseByModelltest', () => {
    /**
     * B1 asks for one letter. B2 offers two tasks and the candidate answers
     * exactly one, both carrying the same choiceGroupId.
     *
     * The response keeps its existing shape so a client that knows nothing of
     * a choice still renders the first task: `choices` is an addition, present
     * only when there is in fact a choice to make. The answer is submitted
     * with the chosen task's own id, which the submit path already resolves.
     */
    it('returns one task and no choice for B1', async () => {
      mockPrismaService.writingExercise.findMany.mockResolvedValue([
        { ...FAKE_EXERCISE, part: 1, choice_group_id: null },
      ]);

      const result = await service.getExerciseByModelltest(1);

      expect(result.part).toBe(1);
      expect(result.title).toBe('E-Mail / Brief');
      expect(result.choices).toBeUndefined();
      expect(result.choiceGroupId).toBeUndefined();
    });

    it('offers both tasks of a B2 choice, first one at the top level', async () => {
      mockPrismaService.writingExercise.findMany.mockResolvedValue([
        {
          ...FAKE_EXERCISE,
          id: 'uuid-b2-a',
          part: 1,
          title: 'Bitte um Informationen',
          choice_group_id: 'b2-modelltest-1-schreiben',
        },
        {
          ...FAKE_EXERCISE,
          id: 'uuid-b2-b',
          part: 2,
          title: 'Beschwerde',
          choice_group_id: 'b2-modelltest-1-schreiben',
        },
      ]);

      const result = await service.getExerciseByModelltest(7);

      // Unchanged shape: the first task is still the response itself.
      expect(result.id).toBe('uuid-b2-a');
      expect(result.part).toBe(1);
      expect(result.choiceGroupId).toBe('b2-modelltest-1-schreiben');

      // And both are offered, each addressable by its own id.
      expect(result.choices).toHaveLength(2);
      expect(result.choices?.map((task) => task.id)).toEqual([
        'uuid-b2-a',
        'uuid-b2-b',
      ]);
      expect(result.choices?.map((task) => task.part)).toEqual([1, 2]);
      expect(result.choices?.map((task) => task.title)).toEqual([
        'Bitte um Informationen',
        'Beschwerde',
      ]);
      // No recursion: a task inside the choice carries no choice of its own.
      expect(result.choices?.every((task) => task.choices === undefined)).toBe(
        true,
      );
    });

    it('reports the real part rather than always 1', async () => {
      mockPrismaService.writingExercise.findMany.mockResolvedValue([
        { ...FAKE_EXERCISE, part: 2, choice_group_id: null },
      ]);

      const result = await service.getExerciseByModelltest(7);

      expect(result.part).toBe(2);
    });

    it('404s when the Modelltest has no Schreiben task', async () => {
      mockPrismaService.writingExercise.findMany.mockResolvedValue([]);

      await expect(service.getExerciseByModelltest(99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getExercise', () => {
    it('returns mapped WritingExerciseDto from DB row', async () => {
      mockPrismaService.writingExercise.findUnique.mockResolvedValue(
        FAKE_EXERCISE,
      );

      const result = await service.getExercise('uuid-exercise-1');

      expect(result.id).toBe('uuid-exercise-1');
      expect(result.part).toBe(1);
      expect(result.taskType).toBe('brief');
      expect(result.title).toBe('E-Mail / Brief');
      expect(result.bulletPoints).toHaveLength(5);
      expect(result.stimulus).toBeDefined();
      expect((result.stimulus as WritingExerciseStimulus).heading).toContain(
        'Büroräume',
      );
      expect(result.prepDurationSeconds).toBe(120);
      expect(result.writingDurationMinutes).toBe(30);
      expect(result.registerChecklist).toEqual([
        'Betreff',
        'Anrede',
        'Einleitung',
        'Schluss',
      ]);
    });

    it('throws NotFoundException when exercise not in DB', async () => {
      mockPrismaService.writingExercise.findUnique.mockResolvedValue(null);

      await expect(service.getExercise('unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for empty id', async () => {
      mockPrismaService.writingExercise.findUnique.mockResolvedValue(null);

      await expect(service.getExercise('')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSessions', () => {
    it('returns empty array when no attempts', async () => {
      mockPrismaService.writingAttempt.findMany.mockResolvedValue([]);

      const result = await service.getSessions('student-1');

      expect(result).toEqual([]);
    });

    it('returns attempts mapped to ExerciseAttemptDto', async () => {
      const rows = [
        {
          attempt_id: 'attempt-uuid-1',
          created_at: new Date('2026-03-04T10:00:00.000Z'),
          completed_at: new Date('2026-03-04T10:07:00.000Z'),
          score: 78,
          feedback: 'Gute Struktur.',
          duration_seconds: 420,
        },
      ];
      mockPrismaService.writingAttempt.findMany.mockResolvedValue(rows);

      const result = await service.getSessions('student-1');

      expect(result.length).toBe(1);
      expect(result[0]).toMatchObject({
        id: 'attempt-uuid-1',
        score: 78,
        feedback: 'Gute Struktur.',
        durationSeconds: 420,
      });
      expect(result[0].dateLabel).toBeDefined();
    });

    it('passes exerciseId UUID directly to WHERE clause', async () => {
      mockPrismaService.writingAttempt.findMany.mockResolvedValue([]);

      await service.getSessions('student-1', 'uuid-exercise-1');

      expect(mockPrismaService.writingAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            exercise_id: 'uuid-exercise-1',
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });

    it('does not apply exercise_id filter when exerciseId is omitted', async () => {
      mockPrismaService.writingAttempt.findMany.mockResolvedValue([]);

      await service.getSessions('student-1');

      const callArg =
        mockPrismaService.writingAttempt.findMany.mock.calls[0][0];
      expect(callArg.where).not.toHaveProperty('exercise_id');
    });
  });

  describe('submit', () => {
    it('creates attempt with modelltest_id from exercise and enqueues job', async () => {
      mockPrismaService.writingExercise.findUnique.mockResolvedValue({
        id: 'uuid-exercise-1',
        modelltest_id: 'uuid-modelltest-1',
      });
      mockPrismaService.writingAttempt.create.mockResolvedValue({});

      const result = await service.submit('student-1', {
        exerciseId: 'uuid-exercise-1',
        content: 'Sehr geehrte Damen und Herren,\n\nich schreibe...',
      });

      expect(result.attemptId).toBeDefined();
      expect(result.status).toBe('pending');
      expect(mockDailyQuota.assertMaySubmit).toHaveBeenCalledWith('student-1');
      expect(mockPrismaService.writingAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            student_id: 'student-1',
            exercise_id: 'uuid-exercise-1',
            modelltest_id: 'uuid-modelltest-1',
            status: 'pending',
          }),
        }),
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'student-1',
          exerciseId: 'uuid-exercise-1',
        }),
      );
    });

    it('skips the Start daily quota for guests (IP rate-limit only)', async () => {
      mockPrismaService.writingExercise.findUnique.mockResolvedValue({
        id: 'uuid-exercise-1',
        modelltest_id: 'uuid-modelltest-1',
      });
      mockPrismaService.writingAttempt.create.mockResolvedValue({});

      await service.submit(
        'guest-1',
        {
          exerciseId: 'uuid-exercise-1',
          content: 'Hallo, dies ist ein Gastversuch.',
        },
        { isGuest: true },
      );

      expect(mockDailyQuota.assertMaySubmit).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when exerciseId not in DB', async () => {
      mockPrismaService.writingExercise.findUnique.mockResolvedValue(null);

      await expect(
        service.submit('student-1', {
          exerciseId: 'unknown',
          content: 'Some text',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws UnprocessableEntityException for empty content', async () => {
      mockPrismaService.writingExercise.findUnique.mockResolvedValue({
        id: 'uuid-exercise-1',
        modelltest_id: null,
      });

      await expect(
        service.submit('student-1', {
          exerciseId: 'uuid-exercise-1',
          content: '',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('does not call queue when DB insert fails', async () => {
      mockPrismaService.writingExercise.findUnique.mockResolvedValue({
        id: 'uuid-exercise-1',
        modelltest_id: null,
      });
      mockPrismaService.writingAttempt.create.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        service.submit('student-1', {
          exerciseId: 'uuid-exercise-1',
          content: 'Text',
        }),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    describe('a named attempt (D29 offline queue)', () => {
      const ID = '6f1c1f5e-2b1a-4b8e-9a51-0c0de0c0de00';
      beforeEach(() => {
        mockPrismaService.writingExercise.findUnique.mockResolvedValue({
          id: 'uuid-exercise-1',
          modelltest_id: null,
        });
        mockPrismaService.writingAttempt.create.mockResolvedValue({});
        mockPrismaService.writingAttempt.findUnique.mockResolvedValue(null);
      });

      it('is stored under the id the app chose', async () => {
        const result = await service.submit('student-1', {
          exerciseId: 'uuid-exercise-1',
          content: 'Text',
          attemptId: ID,
        });

        expect(result.attemptId).toBe(ID);
        expect(
          mockPrismaService.writingAttempt.create.mock.calls[0][0].data
            .attempt_id,
        ).toBe(ID);
      });

      it('is neither stored nor corrected again when it arrives twice', async () => {
        mockPrismaService.writingAttempt.findUnique.mockResolvedValue({
          student_id: 'student-1',
          status: 'completed',
        });

        const result = await service.submit('student-1', {
          exerciseId: 'uuid-exercise-1',
          content: 'Text',
          attemptId: ID,
        });

        expect(result).toMatchObject({ attemptId: ID, status: 'completed' });
        expect(mockPrismaService.writingAttempt.create).not.toHaveBeenCalled();
        expect(mockQueue.add).not.toHaveBeenCalled();
      });

      it("is refused when the id is another student's attempt", async () => {
        mockPrismaService.writingAttempt.findUnique.mockResolvedValue({
          student_id: 'student-2',
          status: 'pending',
        });

        await expect(
          service.submit('student-1', {
            exerciseId: 'uuid-exercise-1',
            content: 'Text',
            attemptId: ID,
          }),
        ).rejects.toThrow(ConflictException);
      });
    });
  });
});
