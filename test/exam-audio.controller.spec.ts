/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { BadRequestException } from '@nestjs/common';
import { ExamAudioController } from '../src/modules/exams/exam-audio.controller';
import { JwtAuthGuard } from '../src/shared/guards/jwt-auth.guard';

/**
 * Serving one play of one recording.
 *
 * This route carries no JWT guard, and that is not an oversight: the URL is
 * handed to an `<audio>` element, which cannot send an Authorization header.
 * The signed token IS the authentication — bound to one attempt, one
 * recording and one play, and dead within twice the recording's length.
 *
 * The file is proxied rather than redirected to. A redirect would hand the
 * candidate the CDN's own URL, which outlives the token and can be replayed
 * as often as they like; proxying means the only way to the bytes is through
 * a token this server has just checked.
 */
describe('ExamAudioController', () => {
  const claims = {
    attemptId: 'attempt-1',
    audioId: 'audio-1',
    playNumber: 1,
    expiresAt: new Date(Date.now() + 600_000),
  };

  let audio: any;
  let prisma: any;
  let fetchImpl: jest.Mock;
  let response: any;
  let controller: ExamAudioController;

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
      headers: new Map([
        ['content-type', 'audio/mpeg'],
        ['content-length', '5400000'],
      ]),
      arrayBuffer: async () => new ArrayBuffer(8),
    });
    response = {
      setHeader: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    controller = new ExamAudioController(audio, prisma, fetchImpl);
  });

  it('carries no JWT guard, because an <audio> element cannot send one', () => {
    const guards = (Reflect.getMetadata('__guards__', ExamAudioController) ??
      []) as unknown[];

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
  });

  it('passes the audio content type through, so a player can read it', async () => {
    await controller.stream('a-token', response);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'audio/mpeg',
    );
  });

  it('tells caches and proxies never to keep it', async () => {
    // A cached exam recording is a second play nobody counted.
    await controller.stream('a-token', response);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-store, private',
    );
  });

  it('refuses a token that does not verify, without fetching anything', async () => {
    audio.verify.mockImplementation(() => {
      throw new BadRequestException('AUDIO_TOKEN_INVALID');
    });

    await expect(controller.stream('forged', response)).rejects.toThrow(
      'AUDIO_TOKEN_INVALID',
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses when no token is given at all', async () => {
    await expect(controller.stream(undefined, response)).rejects.toThrow(
      'AUDIO_TOKEN_INVALID',
    );
    expect(audio.verify).not.toHaveBeenCalled();
  });

  it('never reveals the CDN address it fetched from', async () => {
    // The point of proxying. A redirect would hand the candidate a URL that
    // outlives the token and replays as often as they like.
    await controller.stream('a-token', response);

    const headerValues = response.setHeader.mock.calls.map(
      ([, value]: [string, string]) => String(value),
    );
    expect(headerValues.join(' ')).not.toContain('cdn.example');
    expect(response.status).not.toHaveBeenCalledWith(302);
  });

  it('answers plainly when the recording cannot be fetched', async () => {
    fetchImpl.mockResolvedValue({ ok: false, status: 404 });

    await expect(controller.stream('a-token', response)).rejects.toThrow(
      'AUDIO_UNAVAILABLE',
    );
  });

  it('refuses a recording with no address stored', async () => {
    prisma.listeningExercise.findUnique.mockResolvedValue({ audio_url: '' });

    await expect(controller.stream('a-token', response)).rejects.toThrow(
      'AUDIO_UNAVAILABLE',
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
