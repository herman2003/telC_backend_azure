import type { CefrLevel } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { WritingCorrectionService } from '../src/modules/writing/writing-correction.service';
import { PrismaService } from '../src/shared/services/prisma.service';
import { WritingGateway } from '../src/modules/writing/writing.gateway';
import { WritingService } from '../src/modules/writing/writing.service';
import { MODEL_SERVICE_TOKEN } from '../src/modules/writing/services/model-service.interface';

const FAKE_EXERCISE = {
  id: 'uuid-exercise-1',
  part: 1,
  title: 'E-Mail / Brief',
  subtitle: 'Formeller Brief',
  taskType: 'brief' as const,
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
  taskInstructions:
    'Sie arbeiten in einem Übersetzerbüro. Ihr Chef möchte größere Büroräume mieten.',
  bulletPoints: [
    'Beschreiben Sie Ihr Unternehmen.',
    'Was für Räume brauchen Sie?',
    'Wie viele Räume brauchen Sie?',
    'Wann brauchen Sie die Räume?',
    'Fragen Sie nach den Kosten.',
  ],
  closingReminder:
    'Bevor Sie den Brief schreiben, überlegen Sie sich die passende Reihenfolge der Punkte.',
};

/** B+A+C → (3+5+1)×3 = 27 /45 → score 60 */
const EXPECTED_TELC_POINTS = 27;
const EXPECTED_SCORE = 60;

describe('WritingCorrectionService', () => {
  let service: WritingCorrectionService;

  const mockPrismaService: any = {
    writingAttempt: {
      update: jest.fn(),
    },
    student: {
      findUnique: jest.fn(() => Promise.resolve({ id: 'student-1' })),
    },
    studentActivity: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn((work: any) => work(mockPrismaService)),
  };
  const mockGateway = { notifyCorrectionReady: jest.fn() };
  const mockModelService = { generateTextResponse: jest.fn() };
  const mockWritingService = {
    getExercise: jest.fn(),
    resolveCorrectionBrief: jest.fn(),
  };

  const jobData = {
    attemptId: 'attempt-uuid-1',
    studentId: 'student-1',
    exerciseId: 'uuid-exercise-1',
    content: 'Ich habe geschrieben einen Brief.',
    createdAt: new Date(Date.now() - 120000).toISOString(),
    // `as const` so the literal stays 'B1' rather than widening to string:
    // this is a standalone const, so it gets no contextual typing from
    // CorrectionJobData.
    level: 'B1' as const,
  };

  const validModelJson = `{
    "taskFulfilment": "B",
    "communicativeDesign": "A",
    "formalAccuracy": "C",
    "points_addressed": 5,
    "score": 99,
    "feedback": "Gute Struktur. Achten Sie auf die Konjugation.",
    "corrected_text": "Ich schreibe einen Brief.",
    "corrections": [
      {
        "original": "Ich habe geschrieben",
        "corrected": "Ich schreibe",
        "explanation": "Präsens ist hier passender.",
        "error_type": "grammar"
      }
    ]
  }`;

  const expectedTelcRating = {
    taskFulfilment: 'B',
    communicativeDesign: 'A',
    formalAccuracy: 'C',
    points: EXPECTED_TELC_POINTS,
  };

  beforeEach(async () => {
    mockPrismaService.writingAttempt.update.mockResolvedValue({
      student_id: 'student-1',
      modelltest_id: 'mt-1',
    });
    mockPrismaService.studentActivity.findUnique.mockResolvedValue(null);
    mockPrismaService.studentActivity.create.mockResolvedValue({});
    mockModelService.generateTextResponse.mockRejectedValue(
      new Error('Model unavailable'),
    );
    mockWritingService.getExercise.mockResolvedValue(FAKE_EXERCISE);
    mockWritingService.resolveCorrectionBrief.mockResolvedValue({
      exercise: FAKE_EXERCISE,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WritingCorrectionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: WritingGateway, useValue: mockGateway },
        { provide: WritingService, useValue: mockWritingService },
        { provide: MODEL_SERVICE_TOKEN, useValue: mockModelService },
      ],
    }).compile();

    service = module.get<WritingCorrectionService>(WritingCorrectionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('activity (D26)', () => {
    it('records a real score as Schreiben activity when the correction completes', async () => {
      mockModelService.generateTextResponse.mockResolvedValue(validModelJson);

      await service.runCorrection(jobData);

      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.studentActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          student_id: 'student-1',
          skill: 'SCHREIBEN',
          teil: 1,
          score: EXPECTED_SCORE,
          max_score: 100,
          modelltest_id: 'mt-1',
          attempt_id: jobData.attemptId,
        }),
      });
    });

    it('derives score from telc letters and ignores a model numeric score', async () => {
      mockModelService.generateTextResponse.mockResolvedValue(validModelJson);

      await service.runCorrection(jobData);

      expect(
        mockPrismaService.writingAttempt.update.mock.calls[0][0].data.score,
      ).toBe(EXPECTED_SCORE);
      expect(
        mockPrismaService.writingAttempt.update.mock.calls[0][0].data
          .telc_rating,
      ).toEqual(expectedTelcRating);
    });

    it('records nothing for the stub score of a failed model', async () => {
      await service.runCorrection(jobData);

      expect(mockPrismaService.studentActivity.create).not.toHaveBeenCalled();
    });

    it('records an attempt once when its correction runs twice', async () => {
      mockModelService.generateTextResponse.mockResolvedValue(validModelJson);
      mockPrismaService.studentActivity.findUnique.mockResolvedValue({
        id: 'activity-1',
      });

      await service.runCorrection(jobData);

      expect(mockPrismaService.studentActivity.create).not.toHaveBeenCalled();
    });
  });

  describe('the writing prompt names the level it is rating', () => {
    type PromptBuilder = {
      buildWritingPrompt: (
        content: string,
        exercise: unknown,
        level: CefrLevel,
      ) => string;
    };
    const promptFor = (level: CefrLevel) =>
      (service as unknown as PromptBuilder).buildWritingPrompt(
        'Sehr geehrte Damen und Herren,',
        null,
        level,
      );

    /**
     * The points conversion was already right for B2 — three criteria,
     * A/B/C/D to 5/3/1/0, times three to 45 — which is why this looked like a
     * non-issue. The booklet shows it is not: B2's criterion II bands are A
     * "B2 gut erfuellt", B "B2 erfuellt", C "B1", D "A2 oder darunter". At B2,
     * solidly-B1 writing is a C. A prompt that tells the model it is rating
     * B1 anchors it to the wrong standard, returns A or B for that same text,
     * and the correct conversion then produces a confidently wrong mark.
     */
    it('tells the model it is rating B2, and what a C means there', () => {
      const prompt = promptFor('B2');

      expect(prompt).toContain('telc Deutsch B2');
      expect(prompt).not.toContain('telc Deutsch B1');
      expect(prompt).toMatch(/B1/); // as the C band, not as the exam
    });

    it('still names B1 at B1', () => {
      const prompt = promptFor('B1');

      expect(prompt).toContain('telc Deutsch B1');
      expect(prompt).not.toContain('telc Deutsch B2');
    });
  });

  describe('runCorrection', () => {
    it('calls DB update with stub fields when the model fails', async () => {
      await service.runCorrection(jobData);

      expect(mockPrismaService.writingAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { attempt_id: jobData.attemptId },
          data: expect.objectContaining({
            status: 'completed',
            score: 75,
            feedback: 'Stub feedback. Echte Korrektur folgt.',
            corrected_text: '',
            diff: [],
            telc_rating: Prisma.DbNull,
            duration_seconds: expect.any(Number),
            completed_at: expect.any(Date),
          }),
        }),
      );
    });

    it('emits stub payload (with empty correctedText, diff) when the model fails', async () => {
      await service.runCorrection(jobData);

      expect(mockGateway.notifyCorrectionReady).toHaveBeenCalledTimes(1);
      expect(mockGateway.notifyCorrectionReady).toHaveBeenCalledWith(
        jobData.studentId,
        expect.objectContaining({
          attemptId: jobData.attemptId,
          exerciseId: jobData.exerciseId,
          status: 'completed',
          score: 75,
          feedback: 'Stub feedback. Echte Korrektur folgt.',
          originalText: jobData.content,
          correctedText: '',
          diff: [],
          durationSeconds: expect.any(Number),
          corrections: [],
        }),
      );
      const payload = mockGateway.notifyCorrectionReady.mock.calls[0][1];
      expect(payload.telcRating).toBeUndefined();
    });

    it('does not call notifyCorrectionReady when DB update throws', async () => {
      mockPrismaService.writingAttempt.update.mockRejectedValue(
        new Error('DB error'),
      );

      await service.runCorrection(jobData);

      expect(mockGateway.notifyCorrectionReady).not.toHaveBeenCalled();
    });

    it('persists corrected_text and diff when model returns valid JSON', async () => {
      mockModelService.generateTextResponse.mockResolvedValue(validModelJson);

      await service.runCorrection(jobData);

      expect(mockModelService.generateTextResponse).toHaveBeenCalledTimes(1);

      const updateCall =
        mockPrismaService.writingAttempt.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ attempt_id: jobData.attemptId });
      expect(updateCall.data).toMatchObject({
        status: 'completed',
        score: EXPECTED_SCORE,
        feedback: 'Gute Struktur. Achten Sie auf die Konjugation.',
        corrected_text: 'Ich schreibe einen Brief.',
        telc_rating: expectedTelcRating,
      });
      expect(Array.isArray(updateCall.data.diff)).toBe(true);
      expect(updateCall.data.diff.length).toBeGreaterThan(0);

      const ops = (
        updateCall.data.diff as Array<{ op: string; text: string }>
      ).map((d) => d.op);
      expect(ops).toContain('delete');
      expect(ops).toContain('insert');
    });

    it('emits payload with originalText, correctedText, and diff on a valid response', async () => {
      mockModelService.generateTextResponse.mockResolvedValue(validModelJson);

      await service.runCorrection(jobData);

      expect(mockGateway.notifyCorrectionReady).toHaveBeenCalledWith(
        jobData.studentId,
        expect.objectContaining({
          attemptId: jobData.attemptId,
          exerciseId: jobData.exerciseId,
          status: 'completed',
          score: EXPECTED_SCORE,
          feedback: 'Gute Struktur. Achten Sie auf die Konjugation.',
          originalText: jobData.content,
          correctedText: 'Ich schreibe einen Brief.',
          telcRating: expectedTelcRating,
          corrections: [
            {
              original: 'Ich habe geschrieben',
              corrected: 'Ich schreibe',
              explanation: 'Präsens ist hier passender.',
              errorType: 'grammar',
            },
          ],
        }),
      );

      const payload = mockGateway.notifyCorrectionReady.mock.calls[0][1];
      expect(Array.isArray(payload.diff)).toBe(true);
      const ops = (payload.diff as Array<{ op: string }>).map((d) => d.op);
      expect(ops).toContain('delete');
      expect(ops).toContain('insert');
    });

    it('applies D-kill: I=D → score 0 and telc points 0', async () => {
      mockModelService.generateTextResponse.mockResolvedValue(`{
        "taskFulfilment": "D",
        "communicativeDesign": "A",
        "formalAccuracy": "A",
        "points_addressed": 0,
        "score": 99,
        "feedback": "Zu wenig Inhalt.",
        "corrected_text": "Hi",
        "corrections": []
      }`);

      await service.runCorrection(jobData);

      expect(mockPrismaService.writingAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            score: 0,
            telc_rating: {
              taskFulfilment: 'D',
              communicativeDesign: 'A',
              formalAccuracy: 'A',
              points: 0,
            },
          }),
        }),
      );
      expect(mockGateway.notifyCorrectionReady).toHaveBeenCalledWith(
        jobData.studentId,
        expect.objectContaining({
          score: 0,
          telcRating: expect.objectContaining({ points: 0 }),
        }),
      );
    });

    it('falls back to stub when model returns invalid JSON', async () => {
      mockModelService.generateTextResponse.mockResolvedValue(
        'No JSON here at all',
      );

      await service.runCorrection(jobData);

      expect(mockPrismaService.writingAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            score: 75,
            feedback: 'Stub feedback. Echte Korrektur folgt.',
            corrected_text: '',
            diff: [],
            telc_rating: Prisma.DbNull,
          }),
        }),
      );
      expect(mockGateway.notifyCorrectionReady).toHaveBeenCalledWith(
        jobData.studentId,
        expect.objectContaining({
          score: 75,
          feedback: 'Stub feedback. Echte Korrektur folgt.',
          correctedText: '',
          diff: [],
          corrections: [],
        }),
      );
    });

    it('falls back to stub when model rejects', async () => {
      mockModelService.generateTextResponse.mockRejectedValue(
        new Error('Network error'),
      );

      await service.runCorrection(jobData);

      expect(mockGateway.notifyCorrectionReady).toHaveBeenCalledWith(
        jobData.studentId,
        expect.objectContaining({
          score: 75,
          feedback: 'Stub feedback. Echte Korrektur folgt.',
          correctedText: '',
          diff: [],
        }),
      );
    });

    it('sends a prompt containing each exercise bullet point to the model', async () => {
      mockModelService.generateTextResponse.mockResolvedValue(validModelJson);

      await service.runCorrection(jobData);

      const promptSent = mockModelService.generateTextResponse.mock.calls[0][0];
      for (const bp of FAKE_EXERCISE.bulletPoints) {
        expect(promptSent).toContain(bp);
      }
      expect(promptSent).toContain('Büroräume');
      expect(promptSent).toContain('points_addressed');
      expect(promptSent).toContain('taskFulfilment');
    });

    it('persists and emits pointsAddressed when AI returns it', async () => {
      mockModelService.generateTextResponse.mockResolvedValue(`{
        "taskFulfilment": "B",
        "communicativeDesign": "A",
        "formalAccuracy": "C",
        "feedback": "ok",
        "corrected_text": "Sehr geehrte ...",
        "points_addressed": 3,
        "corrections": []
      }`);

      await service.runCorrection(jobData);

      expect(mockPrismaService.writingAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ points_addressed: 3 }),
        }),
      );
      expect(mockGateway.notifyCorrectionReady).toHaveBeenCalledWith(
        jobData.studentId,
        expect.objectContaining({ pointsAddressed: 3 }),
      );
    });

    it('persists pointsAddressed as null when AI omits the field', async () => {
      mockModelService.generateTextResponse.mockResolvedValue(`{
        "taskFulfilment": "B",
        "communicativeDesign": "A",
        "formalAccuracy": "C",
        "feedback": "ok",
        "corrected_text": "Sehr geehrte ...",
        "corrections": []
      }`);

      await service.runCorrection(jobData);

      expect(mockPrismaService.writingAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ points_addressed: null }),
        }),
      );
      const payload = mockGateway.notifyCorrectionReady.mock.calls[0][1];
      expect(payload.pointsAddressed).toBeUndefined();
    });

    it('keeps telc grades/feedback/corrections when AI omits corrected_text', async () => {
      mockModelService.generateTextResponse.mockResolvedValue(`{
        "taskFulfilment": "B",
        "communicativeDesign": "A",
        "formalAccuracy": "C",
        "points_addressed": 5,
        "feedback": "ok",
        "corrections": [
          {
            "original": "habe geschrieben",
            "corrected": "schreibe",
            "explanation": "Präsens.",
            "error_type": "grammar"
          }
        ]
      }`);

      await service.runCorrection(jobData);

      expect(mockGateway.notifyCorrectionReady).toHaveBeenCalledWith(
        jobData.studentId,
        expect.objectContaining({
          score: EXPECTED_SCORE,
          feedback: 'ok',
          correctedText: '',
          diff: [],
          telcRating: expectedTelcRating,
          corrections: [
            {
              original: 'habe geschrieben',
              corrected: 'schreibe',
              explanation: 'Präsens.',
              errorType: 'grammar',
            },
          ],
        }),
      );
    });
  });

  describe('A1/A2 TEXT_SCHREIBEN training correction', () => {
    const a12Exercise = {
      ...FAKE_EXERCISE,
      id: 'a1-schreiben-2',
      part: 2,
      bulletPoints: ['August', 'Kulturprogramm', 'Hotel'],
    };

    const a12Json = `{
      "content_point_bands": ["FULL", "FULL", "PARTIAL"],
      "communicative_design": "FULL",
      "feedback": "Gut für A1.",
      "corrected_text": "Sehr geehrte Damen und Herren, ich komme im August.",
      "corrections": []
    }`;

    beforeEach(() => {
      mockWritingService.resolveCorrectionBrief.mockResolvedValue({
        exercise: a12Exercise,
        a12: {
          level: 'A1',
          maxPoints: 10,
          rubric: {
            contentPoints: {
              selectRequired: 3,
              pointsPerPoint: [3, 1.5, 0],
            },
            communicativeDesign: { points: [1, 0.5, 0] },
          },
        },
      });
      mockModelService.generateTextResponse.mockResolvedValue(a12Json);
    });

    it('scores with the A1 half-point rubric (not B1 /45)', async () => {
      // FULL+FULL+PARTIAL+FULL KG = 3+3+1.5+1 = 8.5 → 85%
      await service.runCorrection({
        ...jobData,
        exerciseId: 'a1-schreiben-2',
        level: 'A1',
      });

      expect(mockPrismaService.writingAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            score: 85,
            feedback: 'Gut für A1.',
            telc_rating: expect.objectContaining({
              scheme: 'A1_A2',
              points: 8.5,
              maxPoints: 10,
            }),
          }),
        }),
      );
      expect(mockGateway.notifyCorrectionReady).toHaveBeenCalledWith(
        jobData.studentId,
        expect.objectContaining({
          score: 85,
          a12Rating: expect.objectContaining({
            scheme: 'A1_A2',
            points: 8.5,
            maxPoints: 10,
          }),
          telcRating: undefined,
        }),
      );
      expect(mockPrismaService.studentActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          skill: 'SCHREIBEN',
          teil: 2,
          score: 85,
        }),
      });
    });

    it('stubs without B1 fallback when A12 rubric is missing', async () => {
      mockWritingService.resolveCorrectionBrief.mockResolvedValue({
        exercise: a12Exercise,
      });
      mockModelService.generateTextResponse.mockResolvedValue(a12Json);

      await service.runCorrection({
        ...jobData,
        exerciseId: 'a1-schreiben-2',
        level: 'A1',
      });

      expect(mockModelService.generateTextResponse).not.toHaveBeenCalled();
      expect(mockPrismaService.studentActivity.create).not.toHaveBeenCalled();
      expect(
        mockPrismaService.writingAttempt.update.mock.calls[0][0].data.score,
      ).toBe(75);
    });
  });
});
