import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../shared/services/prisma.service';

/** The secret the play links are signed with. Injected rather than read here
 *  so the service can be built in a test without a ConfigService. */
export const EXAM_AUDIO_SECRET = Symbol('EXAM_AUDIO_SECRET');

export interface GrantedPlay {
  audioId: string;
  url: string;
  playsRemaining: number;
  expiresAt: Date;
}

export interface AudioTokenClaims {
  attemptId: string;
  audioId: string;
  playNumber: number;
  expiresAt: Date;
}

/**
 * How long a link outlives the recording it serves.
 *
 * The app downloads the whole file before playback starts, so a link that
 * died at the end of the recording would cost a candidate their one play on a
 * weak connection. Twice its length is enough for a slow download and a
 * restart, and short enough that a link copied out of devtools is useless by
 * the time anyone uses it.
 */
const LINK_LIFETIME_FACTOR = 2;

/**
 * Playing a Hören recording in an exam.
 *
 * An exam recording plays once, because telc's repeats live inside the file:
 * "Sie hören es zweimal" is the tape playing the passage twice, not the
 * candidate pressing play again. The count lives on the server because hiding
 * a button is not a rule, and the link is signed because a URL a candidate
 * keeps is a URL they can replay.
 *
 * The token goes in the query string, not a header: on web the URL is handed
 * to an `<audio>` element, which cannot send one.
 */
@Injectable()
export class ExamAudioService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EXAM_AUDIO_SECRET) private readonly secret: string,
  ) {}

  /**
   * Spends one play and returns the link to use it.
   *
   * The spend is a conditional update rather than a read followed by a write,
   * so two taps arriving together spend two plays rather than both seeing
   * "none used yet".
   */
  async play(
    studentId: string,
    attemptId: string,
    audioId: string,
  ): Promise<GrantedPlay> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        student_id: true,
        blocks: {
          where: { block: 'HOEREN' },
          select: { deadline_at: true, submitted_at: true },
        },
      },
    });
    // 404, never 403: a 403 would confirm the attempt exists.
    if (!attempt || attempt.student_id !== studentId) {
      throw new NotFoundException('EXAM_ATTEMPT_NOT_FOUND');
    }

    const block = attempt.blocks[0];
    if (!block) throw new BadRequestException('BLOCK_NOT_STARTED');
    if (block.submitted_at) {
      throw new BadRequestException('BLOCK_ALREADY_SUBMITTED');
    }

    const audio = await this.prisma.listeningExercise.findUnique({
      where: { id: audioId },
      select: {
        id: true,
        audio_url: true,
        duration_minutes: true,
        exam_plays_allowed: true,
      },
    });
    if (!audio) throw new NotFoundException('AUDIO_NOT_FOUND');
    if (!audio.duration_minutes || audio.duration_minutes < 1) {
      // The link's validity is derived from the recording's length. Guessing
      // one would expire it mid-playback.
      throw new BadRequestException('AUDIO_DURATION_MISSING');
    }

    const allowed = audio.exam_plays_allowed;
    const spent = await this.prisma.examAudioPlay.updateMany({
      where: {
        attempt_id: attemptId,
        audio_id: audioId,
        plays_used: { lt: allowed },
      },
      data: { plays_used: { increment: 1 } },
    });

    let playNumber: number;
    if (spent.count === 1) {
      const row = await this.prisma.examAudioPlay.findUnique({
        where: {
          attempt_id_audio_id: { attempt_id: attemptId, audio_id: audioId },
        },
        select: { plays_used: true },
      });
      playNumber = row?.plays_used ?? 1;
    } else {
      // No row yet, or the allowance is gone. Creating claims the first play;
      // a unique violation means another request created it first.
      const existing = await this.prisma.examAudioPlay.findUnique({
        where: {
          attempt_id_audio_id: { attempt_id: attemptId, audio_id: audioId },
        },
        select: { plays_used: true },
      });
      if (existing) throw new BadRequestException('NO_PLAYS_LEFT');

      try {
        const created = await this.prisma.examAudioPlay.create({
          data: { attempt_id: attemptId, audio_id: audioId, plays_used: 1 },
          select: { plays_used: true },
        });
        playNumber = created.plays_used;
      } catch {
        throw new BadRequestException('NO_PLAYS_LEFT');
      }
    }

    const expiresAt = new Date(
      Date.now() +
        audio.duration_minutes * LINK_LIFETIME_FACTOR * 60 * 1000,
    );
    const token = this.signFor({ attemptId, audioId, playNumber, expiresAt });

    return {
      audioId,
      url: `/api/exams/audio?token=${token}`,
      playsRemaining: Math.max(0, allowed - playNumber),
      expiresAt,
    };
  }

  /** Signs one play. Public so a test can make an expired link without
   *  waiting for one. */
  signFor(claims: AudioTokenClaims): string {
    const payload = Buffer.from(
      JSON.stringify({
        a: claims.attemptId,
        d: claims.audioId,
        p: claims.playNumber,
        x: claims.expiresAt.getTime(),
      }),
    ).toString('base64url');

    return `${payload}.${this.sign(payload)}`;
  }

  /** The claims a link carries, or a refusal. */
  verify(token: string): AudioTokenClaims {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) {
      throw new BadRequestException('AUDIO_TOKEN_INVALID');
    }

    const expected = this.sign(payload);
    // Length first: timingSafeEqual throws on buffers of different sizes.
    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      throw new BadRequestException('AUDIO_TOKEN_INVALID');
    }

    let claims: { a: string; d: string; p: number; x: number };
    try {
      claims = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as typeof claims;
    } catch {
      throw new BadRequestException('AUDIO_TOKEN_INVALID');
    }

    if (claims.x < Date.now()) {
      throw new BadRequestException('AUDIO_TOKEN_EXPIRED');
    }

    return {
      attemptId: claims.a,
      audioId: claims.d,
      playNumber: claims.p,
      expiresAt: new Date(claims.x),
    };
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('hex');
  }
}
