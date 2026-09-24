/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { ExamAudioService } from '../src/modules/centers/exam-audio.service';

/**
 * Playing a Hören recording in an exam.
 *
 * telc's repeats are inside the file — "Sie hören es zweimal" is the tape
 * playing the passage twice, not the candidate pressing play again — so an
 * exam recording plays once. The count lives here because hiding a button is
 * not a rule, and the link is signed because a URL a candidate keeps is a URL
 * they can replay.
 */
describe('ExamAudioService', () => {
  const STUDENT = 'student-1';
  const ATTEMPT = 'attempt-1';
  const AUDIO = '11111111-1111-4111-8111-111111111111';
  const HOUR = 60 * 60 * 1000;

  let prisma: any;
  let service: ExamAudioService;

  const runningHoeren = (over: Record<string, unknown> = {}) => ({
    id: ATTEMPT,
    student_id: STUDENT,
    blocks: [
      {
        block: 'HOEREN',
        deadline_at: new Date(Date.now() + HOUR),
        submitted_at: null,
        ...over,
      },
    ],
  });

  beforeEach(() => {
    prisma = {
      examAttempt: {
        findUnique: jest.fn().mockResolvedValue(runningHoeren()),
      },
      listeningExercise: {
        findUnique: jest.fn().mockResolvedValue({
          id: AUDIO,
          part: 1,
          audio_url: 'https://cdn.example/teil1.mp3',
          duration_minutes: 6,
          exam_plays_allowed: 1,
        }),
      },
      examAudioPlay: {
        upsert: jest.fn().mockResolvedValue({ plays_used: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ plays_used: 1 }),
      },
    };
    service = new ExamAudioService(prisma, 'a-secret-at-least-32-chars-long!!');
  });

  describe('spending a play', () => {
    it('hands back a link and says none are left', async () => {
      const granted = await service.play(STUDENT, ATTEMPT, AUDIO);

      expect(granted.playsRemaining).toBe(0);
      expect(granted.url).toContain('token=');
    });

    it('refuses once the allowance is gone', async () => {
      // The claim the whole design exists for. The button is hidden in the
      // app; this is what makes it a rule.
      prisma.examAudioPlay.updateMany.mockResolvedValue({ count: 0 });
      prisma.examAudioPlay.findUnique.mockResolvedValue({ plays_used: 1 });

      await expect(service.play(STUDENT, ATTEMPT, AUDIO)).rejects.toThrow(
        'NO_PLAYS_LEFT',
      );
    });

    it('spends the play in the statement, so two presses at once spend two', async () => {
      // Conditional on plays_used < allowed rather than read-then-write: two
      // taps arriving together must not both see "none used yet".
      await service.play(STUDENT, ATTEMPT, AUDIO);

      expect(prisma.examAudioPlay.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            attempt_id: ATTEMPT,
            audio_id: AUDIO,
            plays_used: { lt: 1 },
          }),
        }),
      );
    });

    it('allows a second play when the recording says it may', async () => {
      // Data, not code: a file without its repeat baked in can be fixed by a
      // row rather than a deployment.
      prisma.listeningExercise.findUnique.mockResolvedValue({
        id: AUDIO,
        part: 2,
        audio_url: 'https://cdn.example/teil2.mp3',
        duration_minutes: 6,
        exam_plays_allowed: 2,
      });
      prisma.examAudioPlay.updateMany.mockResolvedValue({ count: 1 });

      const granted = await service.play(STUDENT, ATTEMPT, AUDIO);

      expect(granted.playsRemaining).toBe(1);
    });

    it('refuses when the Hören block is not running', async () => {
      prisma.examAttempt.findUnique.mockResolvedValue({
        id: ATTEMPT,
        student_id: STUDENT,
        blocks: [],
      });

      await expect(service.play(STUDENT, ATTEMPT, AUDIO)).rejects.toThrow(
        'BLOCK_NOT_STARTED',
      );
    });

    it('refuses once the block was submitted', async () => {
      prisma.examAttempt.findUnique.mockResolvedValue(
        runningHoeren({ submitted_at: new Date() }),
      );

      await expect(service.play(STUDENT, ATTEMPT, AUDIO)).rejects.toThrow(
        'BLOCK_ALREADY_SUBMITTED',
      );
    });

    it('refuses an attempt belonging to someone else', async () => {
      prisma.examAttempt.findUnique.mockResolvedValue({
        ...runningHoeren(),
        student_id: 'someone-else',
      });

      await expect(service.play(STUDENT, ATTEMPT, AUDIO)).rejects.toThrow(
        'EXAM_ATTEMPT_NOT_FOUND',
      );
    });

    it('refuses a recording with no duration rather than guessing one', async () => {
      // The link's validity is derived from the recording's length. Guessing
      // would expire it mid-playback.
      prisma.listeningExercise.findUnique.mockResolvedValue({
        id: AUDIO,
        part: 1,
        audio_url: 'https://cdn.example/teil1.mp3',
        duration_minutes: 0,
        exam_plays_allowed: 1,
      });

      await expect(service.play(STUDENT, ATTEMPT, AUDIO)).rejects.toThrow(
        'AUDIO_DURATION_MISSING',
      );
    });
  });

  describe('the link it signs', () => {
    it('is accepted back, and says which recording it is for', async () => {
      const granted = await service.play(STUDENT, ATTEMPT, AUDIO);
      const token = new URL(granted.url, 'https://api.test').searchParams.get(
        'token',
      )!;

      expect(service.verify(token)).toMatchObject({
        attemptId: ATTEMPT,
        audioId: AUDIO,
      });
    });

    it('refuses a token whose contents were edited', async () => {
      const granted = await service.play(STUDENT, ATTEMPT, AUDIO);
      const token = new URL(granted.url, 'https://api.test').searchParams.get(
        'token',
      )!;
      const [payload, signature] = token.split('.');
      const other = Buffer.from(
        JSON.stringify({ a: ATTEMPT, d: AUDIO, p: 99, x: Date.now() + HOUR }),
      ).toString('base64url');

      expect(() => service.verify(`${other}.${signature}`)).toThrow(
        'AUDIO_TOKEN_INVALID',
      );
      expect(payload).not.toEqual(other);
    });

    it('refuses a token that has expired', () => {
      const expired = service.signFor({
        attemptId: ATTEMPT,
        audioId: AUDIO,
        playNumber: 1,
        expiresAt: new Date(Date.now() - 1000),
      });

      expect(() => service.verify(expired)).toThrow('AUDIO_TOKEN_EXPIRED');
    });

    it('lasts about twice the recording, so a slow download is not a lost play', async () => {
      // The app downloads the whole file before playback starts. A link that
      // died at the end of the recording would cost a student their one play
      // on a weak connection.
      const granted = await service.play(STUDENT, ATTEMPT, AUDIO);
      const token = new URL(granted.url, 'https://api.test').searchParams.get(
        'token',
      )!;

      const { expiresAt } = service.verify(token);
      const minutes = (expiresAt.getTime() - Date.now()) / 60_000;
      expect(minutes).toBeGreaterThan(11);
      expect(minutes).toBeLessThan(13);
    });
  });
});
