/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { TrainingAudioService } from '../src/modules/listening/training-audio.service';

describe('TrainingAudioService', () => {
  const STUDENT = 'student-1';
  const AUDIO = '11111111-1111-4111-8111-111111111111';

  let prisma: any;
  let service: TrainingAudioService;

  beforeEach(() => {
    prisma = {
      listeningExercise: {
        findUnique: jest.fn().mockResolvedValue({
          id: AUDIO,
          audio_url: 'https://cdn.example/teil1.mp3',
          duration_minutes: 6,
          exam_plays_allowed: 1,
          modelltest: { number: 1 },
        }),
      },
      trainingAudioPlay: {
        create: jest.fn().mockResolvedValue({ plays_used: 0 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ plays_used: 1 }),
      },
    };
    service = new TrainingAudioService(
      prisma,
      'a-secret-at-least-32-chars-long!!',
    );
  });

  describe('spending a play', () => {
    it('hands back a listening stream link and says none are left', async () => {
      const granted = await service.play(STUDENT, AUDIO);

      expect(granted.playsRemaining).toBe(0);
      expect(granted.url).toContain('/api/listening/audio?token=');
    });

    it('refuses once the allowance is gone', async () => {
      prisma.trainingAudioPlay.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.play(STUDENT, AUDIO)).rejects.toThrow(
        'NO_PLAYS_LEFT',
      );
    });

    it('makes the counter row before claiming', async () => {
      await service.play(STUDENT, AUDIO);

      expect(prisma.trainingAudioPlay.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            student_id: STUDENT,
            audio_id: AUDIO,
            plays_used: 0,
          }),
        }),
      );
    });

    it('carries on when the row already exists', async () => {
      prisma.trainingAudioPlay.create.mockRejectedValue(
        Object.assign(new Error('unique'), { code: 'P2002' }),
      );

      await expect(service.play(STUDENT, AUDIO)).resolves.toBeDefined();
    });

    it('refuses a missing recording', async () => {
      prisma.listeningExercise.findUnique.mockResolvedValue(null);

      await expect(service.play(STUDENT, AUDIO)).rejects.toThrow(
        'AUDIO_NOT_FOUND',
      );
    });

    it('refuses when audio_url is empty', async () => {
      prisma.listeningExercise.findUnique.mockResolvedValue({
        id: AUDIO,
        audio_url: '',
        duration_minutes: 6,
        exam_plays_allowed: 1,
        modelltest: { number: 1 },
      });

      await expect(service.play(STUDENT, AUDIO)).rejects.toThrow(
        'AUDIO_UNAVAILABLE',
      );
    });

    it('refuses when duration is missing', async () => {
      prisma.listeningExercise.findUnique.mockResolvedValue({
        id: AUDIO,
        audio_url: 'https://cdn.example/teil1.mp3',
        duration_minutes: 0,
        exam_plays_allowed: 1,
        modelltest: { number: 1 },
      });

      await expect(service.play(STUDENT, AUDIO)).rejects.toThrow(
        'AUDIO_DURATION_MISSING',
      );
    });

    it('grants a guest a stream link without writing training_audio_plays', async () => {
      const guestId = 'guest-uuid-without-students-row';

      const granted = await service.play(guestId, AUDIO, { isGuest: true });

      expect(granted.url).toContain('/api/listening/audio?token=');
      expect(granted.playsRemaining).toBeGreaterThanOrEqual(0);
      expect(prisma.trainingAudioPlay.create).not.toHaveBeenCalled();
      expect(prisma.trainingAudioPlay.updateMany).not.toHaveBeenCalled();
    });

    it('refuses a guest play for Modelltest 3 audio', async () => {
      prisma.listeningExercise.findUnique.mockResolvedValue({
        id: AUDIO,
        audio_url: 'https://cdn.example/teil1.mp3',
        duration_minutes: 6,
        exam_plays_allowed: 1,
        modelltest: { number: 3 },
      });

      await expect(
        service.play('guest-uuid', AUDIO, { isGuest: true }),
      ).rejects.toThrow('ACCOUNT_REQUIRED');
    });
  });

  describe('tokens', () => {
    it('round-trips claims', () => {
      const expiresAt = new Date(Date.now() + 600_000);
      const token = service.signFor({
        studentId: STUDENT,
        audioId: AUDIO,
        playNumber: 1,
        expiresAt,
      });

      expect(service.verify(token)).toEqual({
        studentId: STUDENT,
        audioId: AUDIO,
        playNumber: 1,
        expiresAt,
      });
    });

    it('rejects an expired token', () => {
      const token = service.signFor({
        studentId: STUDENT,
        audioId: AUDIO,
        playNumber: 1,
        expiresAt: new Date(Date.now() - 1),
      });

      expect(() => service.verify(token)).toThrow('AUDIO_TOKEN_EXPIRED');
    });

    it('rejects a forged signature', () => {
      const token = service.signFor({
        studentId: STUDENT,
        audioId: AUDIO,
        playNumber: 1,
        expiresAt: new Date(Date.now() + 600_000),
      });
      const [payload] = token.split('.');

      expect(() => service.verify(`${payload}.deadbeef`)).toThrow(
        'AUDIO_TOKEN_INVALID',
      );
    });
  });
});
