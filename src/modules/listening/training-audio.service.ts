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
  teilRecordingOf,
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

/** Resolved recording for either B1 tables or A1/A2 exam_sections. */
interface ResolvedTrainingRecording {
  audioId: string;
  modelltestNumber: number;
  playsAllowed: number;
  durationSeconds: number;
  /** Present for B1; generic stream resolves URL at token time. */
  audioUrl: string | null;
}

/**
 * Playing a Hören recording in training.
 *
 * Returns a short-lived stream URL, never a durable R2 address. Training does
 * **not** hard-cap plays — free vs timed is enforced in the app; Exam Day still
 * counts once via `exam_audio_plays`. `audioId` is either a
 * `listening_exercises.id` (B1/B2) or an `exam_sections.id` for a Hören Teil
 * (A1/A2).
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
    const recording = await this.resolveRecording(audioId);

    assertGuestMayAccessModelltest(opts.isGuest, recording.modelltestNumber);
    if (opts.isGuest !== true) {
      await this.trainingAccess.assertMayAccess(
        studentId,
        recording.modelltestNumber,
      );
    }

    const expiresAt = new Date(
      Date.now() + recording.durationSeconds * LINK_LIFETIME_FACTOR * 1000,
    );

    // No training hard-cap: each grant is a fresh short-lived link. Guests
    // never had a counter (no students FK); paid students match that policy so
    // free practice can re-issue after TTL. Timed practice is app-enforced.
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
      // Advisory: same figure as GET `playsAllowed` (strict-mode hint). Does
      // not deplete — training re-grants indefinitely.
      playsRemaining: recording.playsAllowed,
      expiresAt,
    };
  }

  /**
   * Stream URL for a verified training token. B1 rows carry `audio_url`;
   * A1/A2 resolve from `format.hoerenDelivery` by section id.
   */
  async streamUrlFor(audioId: string): Promise<string> {
    const exercise = await this.prisma.listeningExercise.findUnique({
      where: { id: audioId },
      select: { audio_url: true },
    });
    if (exercise?.audio_url) return exercise.audio_url;

    const section = await this.prisma.examSection.findUnique({
      where: { id: audioId },
      select: {
        skill: true,
        teil: true,
        modelltest: { select: { format: true } },
      },
    });
    if (!section || section.skill !== 'HOEREN') {
      throw new BadRequestException('AUDIO_UNAVAILABLE');
    }
    const url = teilRecordingOf(
      section.modelltest.format,
      section.teil,
    )?.audioUrl;
    if (!url) throw new BadRequestException('AUDIO_UNAVAILABLE');
    return url;
  }

  private async resolveRecording(
    audioId: string,
  ): Promise<ResolvedTrainingRecording> {
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
    if (audio) {
      if (!audio.audio_url) {
        throw new BadRequestException('AUDIO_UNAVAILABLE');
      }
      if (!audio.duration_minutes || audio.duration_minutes < 1) {
        throw new BadRequestException('AUDIO_DURATION_MISSING');
      }
      return {
        audioId: audio.id,
        modelltestNumber: audio.modelltest.number,
        playsAllowed: audio.exam_plays_allowed,
        durationSeconds: audio.duration_minutes * 60,
        audioUrl: audio.audio_url,
      };
    }

    const section = await this.prisma.examSection.findUnique({
      where: { id: audioId },
      select: {
        id: true,
        skill: true,
        teil: true,
        modelltest: { select: { number: true, format: true } },
      },
    });
    if (!section || section.skill !== 'HOEREN') {
      throw new NotFoundException('AUDIO_NOT_FOUND');
    }
    const teilRecording = teilRecordingOf(
      section.modelltest.format,
      section.teil,
    );
    if (!teilRecording) {
      throw new BadRequestException('HOEREN_AUDIO_NOT_READY');
    }
    return {
      audioId: section.id,
      modelltestNumber: section.modelltest.number,
      playsAllowed: 1,
      durationSeconds: teilRecording.durationSeconds,
      audioUrl: teilRecording.audioUrl,
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
