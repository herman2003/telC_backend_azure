import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Optional,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../shared/services/prisma.service';
import { ExamAudioService } from '../centers/exam-audio.service';
import { proxyAudioFromUrl, type AudioFetcher } from '../listening/audio-proxy';

/** Injected so a test can hand in a fake. Node's global fetch otherwise. */
export const FETCH = Symbol('FETCH');

/**
 * Serves one play of one Hören recording.
 *
 * **No JWT guard, deliberately.** The URL is handed to an `<audio>` element,
 * which cannot send an Authorization header. The signed token is the
 * authentication: bound to one attempt, one recording and one play, dead
 * within twice the recording's length, and issued only after the server has
 * already counted the play.
 *
 * The file is proxied, not redirected to. A redirect would hand the candidate
 * the CDN's own URL, which outlives the token and can be replayed as often as
 * they like. Proxying costs the bandwidth twice and is worth it: the only
 * route to the bytes is through a token this server has just checked.
 */
@ApiTags('Exams')
@Controller('api/exams')
export class ExamAudioController {
  private readonly fetcher: AudioFetcher;

  constructor(
    private readonly audio: ExamAudioService,
    private readonly prisma: PrismaService,
    @Optional() @Inject(FETCH) fetcher?: AudioFetcher,
  ) {
    this.fetcher = fetcher ?? (globalThis.fetch as unknown as AudioFetcher);
  }

  @Get('audio')
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Stream one play of an exam recording',
    description:
      'The token issued by POST .../audio/{audioId}/play. Not documented in Swagger because it is not a route a client composes: the URL arrives ready to use.',
  })
  async stream(
    @Query('token') token: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (!token) throw new BadRequestException('AUDIO_TOKEN_INVALID');

    // Verified before anything is read or fetched: a forged token must cost
    // nothing but a signature check.
    const claims = this.audio.verify(token);

    const exercise = await this.prisma.listeningExercise.findUnique({
      where: { id: claims.audioId },
      select: { audio_url: true },
    });
    const url = exercise
      ? exercise.audio_url
      : await this.audio.teilRecordingUrl(claims.audioId);
    if (!url) {
      throw new BadRequestException('AUDIO_UNAVAILABLE');
    }

    await proxyAudioFromUrl(this.fetcher, url, response);
  }
}
