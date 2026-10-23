import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../shared/services/prisma.service';
import { GENERIC_MODEL_LEVELS } from '../../shared/services/generic-exam-content.service';

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

/** What a play needs to know about a recording, from either track. */
interface Recording {
  allowed: number;
  durationSeconds: number;
}

/**
 * One A1/A2 Hören Teil's recording, read from
 * `modelltests.format.hoerenDelivery.recordings`. Validated once at import
 * (`scripts/generic-modelltest-schemas.mjs`), so only presence is checked
 * here. Null when that Teil's recording has not been uploaded yet.
 */
function teilRecordingOf(
  format: unknown,
  teil: number,
): { audioUrl: string; durationSeconds: number } | null {
  const recordings = (
    format as { hoerenDelivery?: { recordings?: unknown } } | null
  )?.hoerenDelivery?.recordings;
  if (!Array.isArray(recordings)) return null;
  const recording = (recordings as Record<string, unknown>[]).find(
    (r) => r.teil === teil,
  );
  const audioUrl = recording?.audioUrl;
  const durationSeconds = recording?.durationSeconds;
  if (typeof audioUrl !== 'string' || audioUrl === '') return null;
  if (typeof durationSeconds !== 'number' || durationSeconds <= 0) return null;
  return { audioUrl, durationSeconds };
}

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
        // The sitting's Modelltest, so a play can be checked against the exam
        // it belongs to rather than against any recording that exists.
        session: {
          select: {
            modelltest_id: true,
            modelltest: { select: { level: true, format: true } },
          },
        },
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
    // A play is a write — it spends something — so it is gated on the clock
    // like every other write to a block.
    if (new Date() >= block.deadline_at) {
      throw new BadRequestException('BLOCK_EXPIRED');
    }

    const { modelltest_id: modelltestId, modelltest } = attempt.session;
    const recording = GENERIC_MODEL_LEVELS.includes(modelltest.level)
      ? await this.teilRecording(audioId, modelltestId, modelltest.format)
      : await this.listeningRecording(audioId, modelltestId);

    return this.spend(attemptId, audioId, recording);
  }

  /** B1/B2: a `listening_exercises` row per Teil. */
  private async listeningRecording(
    audioId: string,
    modelltestId: string,
  ): Promise<Recording> {
    const audio = await this.prisma.listeningExercise.findUnique({
      where: { id: audioId },
      select: {
        id: true,
        audio_url: true,
        duration_minutes: true,
        exam_plays_allowed: true,
        modelltest_id: true,
      },
    });
    if (!audio) throw new NotFoundException('AUDIO_NOT_FOUND');
    // Without this a candidate could spend a play on any listening exercise
    // id — including the one next month's sitting will use — and stream a
    // future exam's recording during this one.
    if (audio.modelltest_id !== modelltestId) {
      throw new BadRequestException('AUDIO_NOT_IN_EXAM');
    }
    if (!audio.duration_minutes || audio.duration_minutes < 1) {
      // The link's validity is derived from the recording's length. Guessing
      // one would expire it mid-playback.
      throw new BadRequestException('AUDIO_DURATION_MISSING');
    }

    return {
      allowed: audio.exam_plays_allowed,
      durationSeconds: audio.duration_minutes * 60,
    };
  }

  /**
   * A1/A2: one recording per Hören Teil, named by that Teil's own
   * `exam_sections` id; its address and length live in the Modelltest's
   * `format.hoerenDelivery`. Played once — telc's repeats are in the file.
   */
  private async teilRecording(
    audioId: string,
    modelltestId: string,
    format: unknown,
  ): Promise<Recording> {
    const section = await this.prisma.examSection.findUnique({
      where: { id: audioId },
      select: { modelltest_id: true, skill: true, teil: true },
    });
    if (!section) throw new NotFoundException('AUDIO_NOT_FOUND');
    // Same rule as B1/B2: only a Hören Teil of this sitting's own paper.
    if (section.modelltest_id !== modelltestId || section.skill !== 'HOEREN') {
      throw new BadRequestException('AUDIO_NOT_IN_EXAM');
    }
    // Refused before the play is spent: signing a link to a file nobody has
    // uploaded would cost the candidate their one play on nothing.
    const recording = teilRecordingOf(format, section.teil);
    if (!recording) throw new BadRequestException('HOEREN_AUDIO_NOT_READY');

    return { allowed: 1, durationSeconds: recording.durationSeconds };
  }

  /** Spends one play of a recording, from either track, and signs its link. */
  private async spend(
    attemptId: string,
    audioId: string,
    { allowed, durationSeconds }: Recording,
  ): Promise<GrantedPlay> {
    // The counter row is made first, at zero, so that the claim below is the
    // only thing deciding whether a play is spent.
    //
    // An earlier version counted with the create itself, and two presses
    // arriving together on a fresh recording both found no row: one created
    // it, the other took the unique violation and was told NO_PLAYS_LEFT —
    // losing a play the candidate was entitled to. An exam is the worst place
    // to be stingy by accident.
    try {
      await this.prisma.examAudioPlay.create({
        data: { attempt_id: attemptId, audio_id: audioId, plays_used: 0 },
      });
    } catch {
      // Another request created it first, which is exactly what should
      // happen. The claim below is still the arbiter.
    }

    const spent = await this.prisma.examAudioPlay.updateMany({
      where: {
        attempt_id: attemptId,
        audio_id: audioId,
        plays_used: { lt: allowed },
      },
      data: { plays_used: { increment: 1 } },
    });
    if (spent.count !== 1) throw new BadRequestException('NO_PLAYS_LEFT');

    const row = await this.prisma.examAudioPlay.findUniqueOrThrow({
      where: {
        attempt_id_audio_id: { attempt_id: attemptId, audio_id: audioId },
      },
      select: { plays_used: true },
    });
    const playNumber = row.plays_used;

    const expiresAt = new Date(
      Date.now() + durationSeconds * LINK_LIFETIME_FACTOR * 1000,
    );
    const token = this.signFor({ attemptId, audioId, playNumber, expiresAt });

    return {
      audioId,
      url: `/api/exams/audio?token=${token}`,
      playsRemaining: Math.max(0, allowed - playNumber),
      expiresAt,
    };
  }

  /**
   * The address behind a token whose recording is not a `listening_exercises`
   * row: an A1/A2 Hören Teil's, by its section id. Null when there is none.
   * Only `teilRecording` lets a section id be signed, so a token cannot be
   * pointed here without the secret.
   */
  async teilRecordingUrl(sectionId: string): Promise<string | null> {
    const section = await this.prisma.examSection.findUnique({
      where: { id: sectionId },
      select: {
        teil: true,
        skill: true,
        modelltest: { select: { format: true } },
      },
    });
    if (!section || section.skill !== 'HOEREN') return null;
    return (
      teilRecordingOf(section.modelltest.format, section.teil)?.audioUrl ?? null
    );
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
