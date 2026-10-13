import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  EXAM_AUDIO_SECRET,
  type GrantedPlay,
} from '../centers/exam-audio.service';
import { assertGuestMayAccessModelltest } from '../../shared/guest-modelltest-access';
import { TrainingModelltestAccessService } from '../../shared/services/training-modelltest-access.service';

/** Claims on a training stream link (no exam attempt). */
export interface TrainingAudioTokenClaims {
  studentId: string;
  audioId: string;
  playNumber: number;
  expiresAt: Date;
}

/**
 * How long a link outlives the recording it serves.
 *
 * Same factor as exam: the app may download before playback; twice the
 * duration covers a slow download without leaving a durable replay URL.
 */
const LINK_LIFETIME_FACTOR = 2;

/**
 * Playing a Hören recording in training.
 *
 * Same shape as exam play: server counts, returns a short-lived stream URL,
 * never a durable R2 address. Counter is per student + audio.
 *
 * `exam_plays_allowed` unlocks that many *listens* (first grants). After the
 * allowance is spent, further `/play` calls **re-issue** a fresh signed URL
 * without incrementing — so the app can download again when a prior link
 * expired, without treating each download as a new listen.
 */
@Injectable()
export class TrainingAudioService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EXAM_AUDIO_SECRET) private readonly secret: string,
    private readonly trainingAccess: TrainingModelltestAccessService,
  ) {}

  async play(
    studentId: string,
    audioId: string,
    opts: { isGuest?: boolean } = {},
  ): Promise<GrantedPlay> {
    const audio = await this.prisma.listeningExercise.findUnique({
      where: { id: audioId },
      select: {
        id: true,
        audio_url: true,
        duration_minutes: true,
        exam_plays_allowed: true,
        modelltest: { select: { number: true } },
      },
    });
    if (!audio) throw new NotFoundException('AUDIO_NOT_FOUND');
    if (!audio.audio_url) {
      throw new BadRequestException('AUDIO_UNAVAILABLE');
    }
    if (!audio.duration_minutes || audio.duration_minutes < 1) {
      throw new BadRequestException('AUDIO_DURATION_MISSING');
    }

    assertGuestMayAccessModelltest(opts.isGuest, audio.modelltest.number);
    if (opts.isGuest !== true) {
      await this.trainingAccess.assertMayAccess(
        studentId,
        audio.modelltest.number,
      );
    }

    const allowed = audio.exam_plays_allowed;
    const expiresAt = new Date(
      Date.now() + audio.duration_minutes * LINK_LIFETIME_FACTOR * 60 * 1000,
    );

    // Guests have no `students` row, so training_audio_plays FK cannot land.
    // Demo still gets a short-lived stream URL; no durable play counter.
    if (opts.isGuest === true) {
      const playNumber = 1;
      const token = this.signFor({
        studentId,
        audioId,
        playNumber,
        expiresAt,
      });
      return {
        audioId,
        url: `/api/listening/audio?token=${token}`,
        playsRemaining: Math.max(0, allowed - playNumber),
        expiresAt,
      };
    }

    try {
      await this.prisma.trainingAudioPlay.create({
        data: { student_id: studentId, audio_id: audioId, plays_used: 0 },
      });
    } catch {
      // Another request created the row first; the claim below still decides.
    }

    const spent = await this.prisma.trainingAudioPlay.updateMany({
      where: {
        student_id: studentId,
        audio_id: audioId,
        plays_used: { lt: allowed },
      },
      data: { plays_used: { increment: 1 } },
    });

    const row = await this.prisma.trainingAudioPlay.findUniqueOrThrow({
      where: {
        student_id_audio_id: { student_id: studentId, audio_id: audioId },
      },
      select: { plays_used: true },
    });
    const playNumber = row.plays_used;

    // Allowance already spent: refresh the stream URL only (no extra increment).
    // The client stores the file; this path covers expired links after logout /
    // cache clear without locking the student behind NO_PLAYS_LEFT forever.
    if (spent.count !== 1 && playNumber < 1) {
      throw new BadRequestException('NO_PLAYS_LEFT');
    }

    const token = this.signFor({
      studentId,
      audioId,
      playNumber: Math.max(1, playNumber),
      expiresAt,
    });

    return {
      audioId,
      url: `/api/listening/audio?token=${token}`,
      playsRemaining: Math.max(0, allowed - playNumber),
      expiresAt,
    };
  }

  /** Public so tests can forge an expired link without waiting. */
  signFor(claims: TrainingAudioTokenClaims): string {
    const payload = Buffer.from(
      JSON.stringify({
        k: 't',
        s: claims.studentId,
        d: claims.audioId,
        p: claims.playNumber,
        x: claims.expiresAt.getTime(),
      }),
    ).toString('base64url');

    return `${payload}.${this.sign(payload)}`;
  }

  verify(token: string): TrainingAudioTokenClaims {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) {
      throw new BadRequestException('AUDIO_TOKEN_INVALID');
    }

    const expected = this.sign(payload);
    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      throw new BadRequestException('AUDIO_TOKEN_INVALID');
    }

    let claims: { k?: string; s: string; d: string; p: number; x: number };
    try {
      claims = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as typeof claims;
    } catch {
      throw new BadRequestException('AUDIO_TOKEN_INVALID');
    }

    if (claims.k !== 't' || !claims.s || !claims.d) {
      throw new BadRequestException('AUDIO_TOKEN_INVALID');
    }

    if (claims.x < Date.now()) {
      throw new BadRequestException('AUDIO_TOKEN_EXPIRED');
    }

    return {
      studentId: claims.s,
      audioId: claims.d,
      playNumber: claims.p,
      expiresAt: new Date(claims.x),
    };
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('hex');
  }
}
