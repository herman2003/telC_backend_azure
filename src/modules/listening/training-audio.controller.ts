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
import { proxyAudioFromUrl, type AudioFetcher } from './audio-proxy';
import { TrainingAudioService } from './training-audio.service';

/** Injected so a test can hand in a fake. */
export const TRAINING_AUDIO_FETCH = Symbol('TRAINING_AUDIO_FETCH');

/**
 * Serves one play of one training Hören recording.
 *
 * **No JWT guard, deliberately.** The URL is handed to an `<audio>` / Flutter
 * player, which cannot send an Authorization header. The signed token is the
 * authentication.
 */
@ApiTags('Listening (Hören)')
@Controller('api/listening')
export class TrainingAudioController {
  private readonly fetcher: AudioFetcher;

  constructor(
    private readonly audio: TrainingAudioService,
    private readonly prisma: PrismaService,
    @Optional() @Inject(TRAINING_AUDIO_FETCH) fetcher?: AudioFetcher,
  ) {
    this.fetcher = fetcher ?? (globalThis.fetch as unknown as AudioFetcher);
  }

  @Get('audio')
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Stream one play of a training recording',
    description:
      'The token issued by POST .../audio/{audioId}/play. Not composed by clients; the URL arrives ready to use.',
  })
  async stream(
    @Query('token') token: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (!token) throw new BadRequestException('AUDIO_TOKEN_INVALID');

    const claims = this.audio.verify(token);

    const exercise = await this.prisma.listeningExercise.findUnique({
      where: { id: claims.audioId },
      select: { audio_url: true },
    });
    if (!exercise?.audio_url) {
      throw new BadRequestException('AUDIO_UNAVAILABLE');
    }

    await proxyAudioFromUrl(this.fetcher, exercise.audio_url, response);
  }
}
