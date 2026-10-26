/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { TrainingAudioService } from '../src/modules/listening/training-audio.service';

describe('TrainingAudioService', () => {
  const STUDENT = 'student-1';
  const AUDIO = '11111111-1111-4111-8111-111111111111';

  let prisma: any;
  let service: TrainingAudioService;
  const trainingAccess = {
    assertMayAccess: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    trainingAccess.assertMayAccess.mockResolvedValue(undefined);
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
      trainingAccess as never,
    );
  });

  describe('granting a stream link', () => {
    it('hands back a short-lived listening stream link', async () => {
      const granted = await service.play(STUDENT, AUDIO);

      expect(granted.playsRemaining).toBe(1);
      expect(granted.url).toContain('/api/listening/audio?token=');
      expect(trainingAccess.assertMayAccess).toHaveBeenCalledWith(STUDENT, 1);
      expect(prisma.trainingAudioPlay.create).not.toHaveBeenCalled();
      expect(prisma.trainingAudioPlay.updateMany).not.toHaveBeenCalled();
    });

    it('skips paid training assert for guests', async () => {
      await service.play(STUDENT, AUDIO, { isGuest: true });
      expect(trainingAccess.assertMayAccess).not.toHaveBeenCalled();
    });

    it('grants again after a prior play (Flutter owns free vs timed)', async () => {
      const first = await service.play(STUDENT, AUDIO);
      const second = await service.play(STUDENT, AUDIO);

      expect(first.url).toContain('/api/listening/audio?token=');
      expect(second.url).toContain('/api/listening/audio?token=');
      expect(second.playsRemaining).toBe(1);
      expect(prisma.trainingAudioPlay.updateMany).not.toHaveBeenCalled();
    });

    it('refuses a missing recording', async () => {
      prisma.listeningExercise.findUnique.mockResolvedValue(null);
      prisma.examSection = {
        findUnique: jest.fn().mockResolvedValue(null),
      };

      await expect(service.play(STUDENT, AUDIO)).rejects.toThrow(
        'AUDIO_NOT_FOUND',
      );
    });

    it('plays an A1/A2 Hören section id from format.hoerenDelivery', async () => {
      const SECTION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      prisma.listeningExercise.findUnique.mockResolvedValue(null);
      prisma.examSection = {
        findUnique: jest.fn().mockResolvedValue({
          id: SECTION,
          skill: 'HOEREN',
          teil: 1,
          modelltest: {
            number: 8,
            format: {
              hoerenDelivery: {
                recordings: [
                  {
                    teil: 1,
                    audioUrl: 'https://cdn.example/a2-t1.mp3',
                    durationSeconds: 180,
                  },
                ],
              },
            },
          },
        }),
      };

      const granted = await service.play(STUDENT, SECTION);

      expect(granted.audioId).toBe(SECTION);
      expect(granted.playsRemaining).toBe(1);
      expect(granted.url).toContain('/api/listening/audio?token=');
      expect(trainingAccess.assertMayAccess).toHaveBeenCalledWith(STUDENT, 8);
    });

    it('refuses a generic Hören section before granting when upload is missing', async () => {
      const SECTION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      prisma.listeningExercise.findUnique.mockResolvedValue(null);
      prisma.examSection = {
        findUnique: jest.fn().mockResolvedValue({
          id: SECTION,
          skill: 'HOEREN',
          teil: 2,
          modelltest: {
            number: 9,
            format: { hoerenDelivery: { recordings: [] } },
          },
        }),
      };

      await expect(service.play(STUDENT, SECTION)).rejects.toThrow(
        'HOEREN_AUDIO_NOT_READY',
      );
      expect(prisma.trainingAudioPlay.create).not.toHaveBeenCalled();
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
