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
    session: {
      modelltest_id: 'mt-1',
      modelltest: { level: 'B1', format: null },
    },
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
          modelltest_id: 'mt-1',
        }),
      },
      examAudioPlay: {
        // Created at zero, then claimed by the conditional update. The
        // create is allowed to fail: another request making the row first is
        // exactly what should happen.
        create: jest.fn().mockResolvedValue({ plays_used: 0 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ plays_used: 1 }),
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

      await expect(service.play(STUDENT, ATTEMPT, AUDIO)).rejects.toThrow(
        'NO_PLAYS_LEFT',
      );
    });

    it('makes the counter row before claiming, so a first press is never lost', async () => {
      // Two presses arriving together on a fresh recording used to race to
      // create the row, and the loser was told NO_PLAYS_LEFT for a play it
      // was entitled to.
      await service.play(STUDENT, ATTEMPT, AUDIO);

      expect(prisma.examAudioPlay.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plays_used: 0 }),
        }),
      );
    });

    it('carries on when the row already exists', async () => {
      prisma.examAudioPlay.create.mockRejectedValue(
        Object.assign(new Error('unique'), { code: 'P2002' }),
      );

      await expect(
        service.play(STUDENT, ATTEMPT, AUDIO),
      ).resolves.toMatchObject({ playsRemaining: 0 });
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
        modelltest_id: 'mt-1',
      });
      prisma.examAudioPlay.updateMany.mockResolvedValue({ count: 1 });
      prisma.examAudioPlay.findUniqueOrThrow.mockResolvedValue({
        plays_used: 1,
      });

      const granted = await service.play(STUDENT, ATTEMPT, AUDIO);

      expect(granted.playsRemaining).toBe(1);
    });

    it('refuses a recording from another Modelltest', async () => {
      // Without this, a candidate could spend a play on any listening
      // exercise id — including the one a sitting next month will use — and
      // stream a future exam's recording during this one.
      prisma.listeningExercise.findUnique.mockResolvedValue({
        id: AUDIO,
        part: 1,
        audio_url: 'https://cdn.example/other.mp3',
        duration_minutes: 6,
        exam_plays_allowed: 1,
        modelltest_id: 'a-different-modelltest',
      });

      await expect(service.play(STUDENT, ATTEMPT, AUDIO)).rejects.toThrow(
        'AUDIO_NOT_IN_EXAM',
      );
      expect(prisma.examAudioPlay.create).not.toHaveBeenCalled();
    });

    it('refuses once the block time has run out', async () => {
      // Every other write to a block is gated on the deadline. A play is a
      // write: it spends something.
      prisma.examAttempt.findUnique.mockResolvedValue(
        runningHoeren({ deadline_at: new Date(Date.now() - 1000) }),
      );

      await expect(service.play(STUDENT, ATTEMPT, AUDIO)).rejects.toThrow(
        'BLOCK_EXPIRED',
      );
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
        modelltest_id: 'mt-1',
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

  describe('A1/A2: one recording per Teil, played once', () => {
    const A2_MODELLTEST = '22222222-2222-4222-8222-222222222222';
    const TEIL_2 = '33333333-3333-4333-8333-333333333333';
    const delivery = (teil2: Record<string, unknown> = {}) => ({
      hoerenDelivery: {
        deliveryMode: 'PER_TEIL_RECORDINGS',
        playsAllowed: 1,
        recordings: [
          {
            teil: 1,
            audioUrl: 'https://cdn.example/a2-teil1.mp3',
            durationSeconds: 401,
          },
          {
            teil: 2,
            audioUrl: 'https://cdn.example/a2-teil2.mp3',
            durationSeconds: 304,
            ...teil2,
          },
        ],
      },
    });
    const a2Attempt = (format: unknown) => ({
      ...runningHoeren(),
      session: {
        modelltest_id: A2_MODELLTEST,
        modelltest: { level: 'A2', format },
      },
    });
    const teil2Section = (over: Record<string, unknown> = {}) => ({
      modelltest_id: A2_MODELLTEST,
      skill: 'HOEREN',
      teil: 2,
      ...over,
    });

    beforeEach(() => {
      prisma.examAttempt.findUnique.mockResolvedValue(a2Attempt(delivery()));
      prisma.examSection = {
        findUnique: jest.fn().mockResolvedValue(teil2Section()),
      };
    });

    it("spends the Teil's one play on the same counter B1/B2 use", async () => {
      const granted = await service.play(STUDENT, ATTEMPT, TEIL_2);

      expect(granted).toMatchObject({ audioId: TEIL_2, playsRemaining: 0 });
      expect(granted.url).toContain('token=');
      expect(prisma.listeningExercise.findUnique).not.toHaveBeenCalled();
      expect(prisma.examAudioPlay.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            attempt_id: ATTEMPT,
            audio_id: TEIL_2,
            plays_used: { lt: 1 },
          }),
        }),
      );
    });

    it('refuses a second play of the same Teil', async () => {
      prisma.examAudioPlay.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.play(STUDENT, ATTEMPT, TEIL_2)).rejects.toThrow(
        'NO_PLAYS_LEFT',
      );
    });

    it('grants exactly one of two taps arriving together', async () => {
      prisma.examAudioPlay.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      const results = await Promise.allSettled([
        service.play(STUDENT, ATTEMPT, TEIL_2),
        service.play(STUDENT, ATTEMPT, TEIL_2),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const refused = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(refused).toHaveLength(1);
      expect(String(refused[0].reason)).toContain('NO_PLAYS_LEFT');
    });

    it('refuses a Teil that does not exist', async () => {
      prisma.examSection.findUnique.mockResolvedValue(null);

      await expect(service.play(STUDENT, ATTEMPT, TEIL_2)).rejects.toThrow(
        'AUDIO_NOT_FOUND',
      );
    });

    it("refuses another paper's Teil", async () => {
      prisma.examSection.findUnique.mockResolvedValue(
        teil2Section({ modelltest_id: 'another-modelltest' }),
      );

      await expect(service.play(STUDENT, ATTEMPT, TEIL_2)).rejects.toThrow(
        'AUDIO_NOT_IN_EXAM',
      );
      expect(prisma.examAudioPlay.create).not.toHaveBeenCalled();
    });

    it('refuses a section of this paper that is not a Hören Teil', async () => {
      prisma.examSection.findUnique.mockResolvedValue(
        teil2Section({ skill: 'LESEN' }),
      );

      await expect(service.play(STUDENT, ATTEMPT, TEIL_2)).rejects.toThrow(
        'AUDIO_NOT_IN_EXAM',
      );
    });

    it('refuses, without spending the play, a Teil whose recording is not uploaded', async () => {
      prisma.examAttempt.findUnique.mockResolvedValue(
        a2Attempt(delivery({ audioUrl: null, durationSeconds: null })),
      );

      await expect(service.play(STUDENT, ATTEMPT, TEIL_2)).rejects.toThrow(
        'HOEREN_AUDIO_NOT_READY',
      );
      expect(prisma.examAudioPlay.create).not.toHaveBeenCalled();
      expect(prisma.examAudioPlay.updateMany).not.toHaveBeenCalled();
    });

    it("lasts about twice that Teil's recording, same as B1/B2", async () => {
      const granted = await service.play(STUDENT, ATTEMPT, TEIL_2);
      const token = new URL(granted.url, 'https://api.test').searchParams.get(
        'token',
      )!;

      const { expiresAt, audioId } = service.verify(token);
      const seconds = (expiresAt.getTime() - Date.now()) / 1000;
      expect(audioId).toBe(TEIL_2);
      expect(seconds).toBeGreaterThan(600);
      expect(seconds).toBeLessThanOrEqual(608);
    });

    describe('teilRecordingUrl', () => {
      beforeEach(() => {
        prisma.examSection.findUnique.mockResolvedValue({
          ...teil2Section(),
          modelltest: { format: delivery() },
        });
      });

      it("gives that Teil's recording address", async () => {
        await expect(service.teilRecordingUrl(TEIL_2)).resolves.toBe(
          'https://cdn.example/a2-teil2.mp3',
        );
      });

      it('is null for an id that is no section', async () => {
        prisma.examSection.findUnique.mockResolvedValue(null);

        await expect(service.teilRecordingUrl(TEIL_2)).resolves.toBeNull();
      });

      it('is null for a section that is not a Hören Teil', async () => {
        prisma.examSection.findUnique.mockResolvedValue({
          ...teil2Section({ skill: 'LESEN' }),
          modelltest: { format: delivery() },
        });

        await expect(service.teilRecordingUrl(TEIL_2)).resolves.toBeNull();
      });

      it('is null while that Teil has not been uploaded', async () => {
        prisma.examSection.findUnique.mockResolvedValue({
          ...teil2Section(),
          modelltest: {
            format: delivery({ audioUrl: null, durationSeconds: null }),
          },
        });

        await expect(service.teilRecordingUrl(TEIL_2)).resolves.toBeNull();
      });
    });
  });
});
