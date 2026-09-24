/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { ExamBlockContentService } from '../src/modules/centers/exam-block-content.service';

/**
 * What a candidate is handed when a block starts.
 *
 * The same questions training serves, with the answers taken out, and only
 * once the block is running. Serving them earlier would let a candidate read
 * Schreiben's task during the ninety minutes meant for Lesen.
 */
describe('ExamBlockContentService', () => {
  const STUDENT = 'student-1';
  const ATTEMPT = 'attempt-1';
  const HOUR = 60 * 60 * 1000;

  const lesenExercise = {
    issuedAt: '2026-10-05T09:00:00.000Z',
    teil1: {
      texts: [{ id: '1', body: 'Hallo', correctTitleId: 'title-4' }],
      titles: [{ id: 'title-4', text: 'Ein Titel' }],
    },
    teil2: {
      questions: [
        {
          id: '6',
          content: 'Warum?',
          options: [{ id: '6a', text: 'weil' }],
          correctOptionId: '6b',
        },
      ],
    },
    teil3: { situations: [{ id: '11', correctAnswer: 'a' }] },
  };

  const sbExercise = {
    teil1: {
      body: 'Ein Text',
      gaps: [{ id: '21', options: [{ id: '21a' }], correctOptionId: '21b' }],
    },
  };

  let prisma: any;
  let lesen: any;
  let sprachbausteine: any;
  let listening: any;
  let service: ExamBlockContentService;

  const attemptRow = (over: Record<string, unknown> = {}) => ({
    id: ATTEMPT,
    student_id: STUDENT,
    session: { modelltest: { number: 2 } },
    blocks: [
      {
        block: 'LESEN_SPRACHBAUSTEINE',
        started_at: new Date(Date.now() - 60_000),
        deadline_at: new Date(Date.now() + HOUR),
        submitted_at: null,
        answers: { LESEN_1: { '1': 'a' } },
      },
    ],
    ...over,
  });

  beforeEach(() => {
    prisma = {
      examAttempt: { findUnique: jest.fn().mockResolvedValue(attemptRow()) },
    };
    lesen = { getExercise: jest.fn().mockResolvedValue(lesenExercise) };
    sprachbausteine = {
      getExercise: jest.fn().mockResolvedValue(sbExercise),
    };
    listening = {
      getExamTeil: jest.fn().mockImplementation((_n: number, part: number) =>
        Promise.resolve({
          audioId: `audio-${part}`,
          playsAllowed: part === 1 ? 1 : 2,
          imagePath: `https://cdn.example/teil${part}.png`,
          questions: [{ id: 'q1', prompt: 'Was sagt sie?' }],
        }),
      ),
    };
    service = new ExamBlockContentService(
      prisma,
      lesen,
      sprachbausteine,
      listening,
    );
  });

  describe('what it serves', () => {
    it('serves the Modelltest the sitting names, not a default', async () => {
      await service.getBlockContent(STUDENT, ATTEMPT, 'LESEN_SPRACHBAUSTEINE');

      expect(lesen.getExercise).toHaveBeenCalledWith(2);
      expect(sprachbausteine.getExercise).toHaveBeenCalledWith(2);
    });

    it('puts both skills in the block telc sits them in together', async () => {
      const content = await service.getBlockContent(
        STUDENT,
        ATTEMPT,
        'LESEN_SPRACHBAUSTEINE',
      );

      expect(Object.keys(content.sections)).toEqual([
        'LESEN',
        'SPRACHBAUSTEINE',
      ]);
    });

    it('carries no answers at all', async () => {
      // The claim the exam rests on. Everything else here is convenience.
      const content = await service.getBlockContent(
        STUDENT,
        ATTEMPT,
        'LESEN_SPRACHBAUSTEINE',
      );

      expect(JSON.stringify(content)).not.toMatch(/correct/i);
      // And it is still answerable: the texts and the options survived.
      expect(JSON.stringify(content)).toContain('Hallo');
      expect(JSON.stringify(content)).toContain('weil');
    });

    it('returns the answers already saved, so a reload restores the paper', async () => {
      const content = await service.getBlockContent(
        STUDENT,
        ATTEMPT,
        'LESEN_SPRACHBAUSTEINE',
      );

      expect(content.savedAnswers).toEqual({ LESEN_1: { '1': 'a' } });
    });

    it('reports the deadline and the server clock beside the questions', async () => {
      // So the app can render the countdown from the same response that gave
      // it the paper, rather than asking twice.
      const content = await service.getBlockContent(
        STUDENT,
        ATTEMPT,
        'LESEN_SPRACHBAUSTEINE',
      );

      expect(content.deadlineAt).toBeInstanceOf(Date);
      expect(content.serverNow).toBeInstanceOf(Date);
      expect(content.remainingSeconds).toBeGreaterThan(0);
    });
  });

  describe('Hören', () => {
    const hoerenRunning = () =>
      attemptRow({
        blocks: [
          {
            block: 'HOEREN',
            started_at: new Date(Date.now() - 60_000),
            deadline_at: new Date(Date.now() + HOUR),
            submitted_at: null,
            answers: {},
          },
        ],
      });

    beforeEach(() => {
      prisma.examAttempt.findUnique.mockResolvedValue(hoerenRunning());
    });

    it('serves all three Teile of the block', async () => {
      const content = await service.getBlockContent(STUDENT, ATTEMPT, 'HOEREN');

      expect(Object.keys(content.sections)).toEqual(['HOEREN']);
      expect((content.sections as any).HOEREN).toHaveLength(3);
    });

    it('names the recording and how often it may play', async () => {
      // The app needs the id to ask for a play, and the allowance so it can
      // stop offering one — the server refuses either way.
      const content = await service.getBlockContent(STUDENT, ATTEMPT, 'HOEREN');

      expect((content.sections as any).HOEREN[0]).toMatchObject({
        audioId: 'audio-1',
        playsAllowed: 1,
      });
    });

    it('gives out no audio address, only the id to ask for one', async () => {
      // A URL in the payload is a recording the candidate can replay without
      // anyone counting it. The only way to the bytes is POST .../play.
      const content = await service.getBlockContent(STUDENT, ATTEMPT, 'HOEREN');

      const json = JSON.stringify(content);
      expect(json).not.toContain('audio_url');
      expect(json).not.toContain('bundled_audio_asset');
      expect(json).not.toContain('.mp3');
    });
  });

  describe('when it refuses', () => {
    it('refuses a block the candidate has not started', async () => {
      // Otherwise Schreiben's task could be read during the ninety minutes
      // meant for Lesen.
      await expect(
        service.getBlockContent(STUDENT, ATTEMPT, 'SCHREIBEN'),
      ).rejects.toThrow('BLOCK_NOT_STARTED');
      expect(lesen.getExercise).not.toHaveBeenCalled();
    });

    it('refuses a block that was already submitted', async () => {
      prisma.examAttempt.findUnique.mockResolvedValue(
        attemptRow({
          blocks: [
            {
              block: 'LESEN_SPRACHBAUSTEINE',
              started_at: new Date(Date.now() - 2 * HOUR),
              deadline_at: new Date(Date.now() - HOUR),
              submitted_at: new Date(Date.now() - HOUR),
              answers: {},
            },
          ],
        }),
      );

      await expect(
        service.getBlockContent(STUDENT, ATTEMPT, 'LESEN_SPRACHBAUSTEINE'),
      ).rejects.toThrow('BLOCK_ALREADY_SUBMITTED');
    });

    it('still serves a block whose time ran out but which is not submitted', async () => {
      // The candidate should see what they were working on while the app
      // submits it. Refusing here would blank the screen at 00:00.
      prisma.examAttempt.findUnique.mockResolvedValue(
        attemptRow({
          blocks: [
            {
              block: 'LESEN_SPRACHBAUSTEINE',
              started_at: new Date(Date.now() - 2 * HOUR),
              deadline_at: new Date(Date.now() - 1000),
              submitted_at: null,
              answers: {},
            },
          ],
        }),
      );

      const content = await service.getBlockContent(
        STUDENT,
        ATTEMPT,
        'LESEN_SPRACHBAUSTEINE',
      );

      expect(content.remainingSeconds).toBe(0);
    });

    it('refuses an attempt belonging to someone else', async () => {
      prisma.examAttempt.findUnique.mockResolvedValue(
        attemptRow({ student_id: 'someone-else' }),
      );

      await expect(
        service.getBlockContent(STUDENT, ATTEMPT, 'LESEN_SPRACHBAUSTEINE'),
      ).rejects.toThrow('EXAM_ATTEMPT_NOT_FOUND');
    });
  });
});
