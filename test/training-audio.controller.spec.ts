/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { TrainingAudioController } from '../src/modules/listening/training-audio.controller';
import { JwtAuthGuard } from '../src/shared/guards/jwt-auth.guard';

describe('TrainingAudioController', () => {
  const claims = {
    studentId: 'student-1',
    audioId: 'audio-1',
    playNumber: 1,
    expiresAt: new Date(Date.now() + 600_000),
  };

  let audio: any;
  let prisma: any;
  let fetchImpl: jest.Mock;
  let response: any;
  let controller: TrainingAudioController;

  beforeEach(() => {
    audio = { verify: jest.fn().mockReturnValue(claims) };
    prisma = {
      listeningExercise: {
        findUnique: jest.fn().mockResolvedValue({
          audio_url: 'https://cdn.example/teil1.mp3',
        }),
      },
    };
    fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name === 'content-type'
            ? 'audio/mpeg'
            : name === 'content-length'
              ? '5400000'
              : null,
      },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    response = {
      setHeader: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    controller = new TrainingAudioController(audio, prisma, fetchImpl);
  });

  it('carries no JWT guard, because a player cannot send one', () => {
    const guards = (Reflect.getMetadata(
      '__guards__',
      TrainingAudioController,
    ) ?? []) as unknown[];

    expect(guards).not.toContain(JwtAuthGuard);
  });

  it('serves the recording the token names', async () => {
    await controller.stream('a-token', response);

    expect(audio.verify).toHaveBeenCalledWith('a-token');
    expect(prisma.listeningExercise.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'audio-1' } }),
    );
    expect(fetchImpl).toHaveBeenCalledWith('https://cdn.example/teil1.mp3');
    expect(response.send).toHaveBeenCalled();
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-store, private',
    );
  });

  it('refuses a missing token', async () => {
    await expect(controller.stream(undefined, response)).rejects.toThrow(
      'AUDIO_TOKEN_INVALID',
    );
  });
});
