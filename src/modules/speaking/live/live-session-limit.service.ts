import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import NodeCache from 'node-cache';
import { ValkeyService } from '../../../shared/services/valkey.service';

const CONCURRENT_KEY = 'elena:active';

/** One student, one live conversation. The key is per student, so the pool it
 *  describes has exactly one place in it. */
const liveSlotKey = (studentId: string) => `elena:live:student:${studentId}`;

export interface LiveSessionCaller {
  /** Client IP. The only stable identity a guest has — see {@link LiveSessionLimitService.identityKey}. */
  ip: string;
  /** Present for registered students; guests get a throwaway UUID we ignore. */
  studentId?: string;
  isGuest: boolean;
}

/**
 * The spend ceiling for Elena.
 *
 * Three layers live here; two more (`uses: 1` and `expireTime`) are carried on
 * the minted token itself and enforced by Google, which is why they cannot be
 * bypassed by a modified client. These three exist so we refuse traffic before
 * Google does — a student should see our message, not a raw provider error.
 *
 * Every layer degrades to an in-process counter when Valkey is unavailable, the
 * same way {@link ValkeyService} treats rate limits: a cache outage must not
 * take Sprechen down with it.
 */
@Injectable()
export class LiveSessionLimitService {
  private readonly logger = new Logger(LiveSessionLimitService.name);
  private readonly cache = new NodeCache();
  /** member → expiry epoch ms. Fallback for the concurrency pool only. */
  private readonly localSlots = new Map<string, number>();
  /** student key → the session they hold and when it lapses. The same
   *  fallback, for the per-student pool. */
  private readonly localLiveSlots = new Map<
    string,
    { sessionId: string; expiresAt: number }
  >();
  /**
   * sessionId → when it was granted, for the duration in the closing log line.
   *
   * Telemetry, not a limit, so it lives in this process and nothing depends on
   * it being complete: a restart loses the starts it was holding and those
   * sessions close with a null duration rather than a wrong one. Pruned on the
   * ceiling, so an app that never calls /end cannot grow this map for ever.
   */
  private readonly sessionStarts = new Map<string, number>();

  private readonly ipMax: number;
  private readonly ipWindowSeconds: number;
  private readonly globalMax: number;
  private readonly concurrentMax: number;
  private readonly sessionMaxSeconds: number;

  constructor(@Optional() private readonly valkey?: ValkeyService) {
    this.ipMax = parseInt(process.env.ELENA_IP_DAILY_MAX || '2', 10);
    this.ipWindowSeconds =
      parseInt(process.env.ELENA_IP_WINDOW_MINUTES || '1440', 10) * 60;
    this.globalMax = parseInt(process.env.ELENA_GLOBAL_DAILY_MAX || '50', 10);
    this.concurrentMax = parseInt(process.env.ELENA_CONCURRENT_MAX || '2', 10);
    // Five, not ten. It is what Start promises, and it is also what keeps the
    // promise affordable: the Live API bills tokens, not minutes, so earlier
    // audio is reprocessed as the conversation grows and a ten-minute session
    // costs more than two five-minute ones.
    this.sessionMaxSeconds =
      parseInt(process.env.GEMINI_LIVE_SESSION_MAX_MINUTES || '5', 10) * 60;
  }

  get sessionSeconds(): number {
    return this.sessionMaxSeconds;
  }

  /**
   * Consumes one session's worth of every quota, or throws 429.
   *
   * Order is load-bearing, and the reason is a denial of service rather than
   * tidiness. Consuming the shared global counter before checking the caller's
   * own cap lets one exhausted IP keep spending everyone else's quota: it is
   * refused every time, yet each refusal still increments the global bucket, so
   * roughly ELENA_GLOBAL_DAILY_MAX requests take Elena down for all users. The
   * counter cannot be refunded — `enforce` only increments — so the caller's own
   * cap has to be the first thing that can reject.
   *
   * The pool is therefore only *read* up front: a full pool refuses without
   * touching anything shared. The slot is claimed last, through the atomic
   * admission call, so two simultaneous requests cannot both take the last one.
   */
  async acquire(caller: LiveSessionCaller, sessionId: string): Promise<void> {
    // First, and read-only. A student who already has Elena open is not
    // competing for anything shared, so finding out must not cost them one of
    // the sessions they are entitled to — and the answer is about them alone.
    if (await this.holdsLiveSession(caller)) {
      throw this.refuse(
        'elenaSessionAlreadyOpen',
        'Vous avez déjà une session ouverte avec Elena. Terminez-la avant d’en commencer une autre.',
      );
    }

    if (await this.poolIsFull()) {
      throw this.refuse(
        'elenaBusyNow',
        'Elena parle avec quelqu’un d’autre. Réessayez dans quelques minutes.',
      );
    }

    const identity = this.identityKey(caller);
    if (!(await this.consume(identity, this.ipMax, this.ipWindowSeconds))) {
      throw this.refuse(
        'elenaDailyLimit',
        `Vous avez utilisé vos ${this.ipMax} sessions avec Elena aujourd’hui.`,
      );
    }

    if (!(await this.consume(this.globalKey(), this.globalMax, 86_400))) {
      throw this.refuse(
        'elenaBusyToday',
        'Elena est très demandée aujourd’hui. Réessayez demain.',
      );
    }

    // Lost the race against another request for the last slot. Rare, and the
    // caller keeps the quota they just spent — the alternative is letting both
    // through and hitting the provider's own concurrency error instead.
    if (!(await this.takeConcurrentSlot(sessionId))) {
      throw this.refuse(
        'elenaBusyNow',
        'Elena parle avec quelqu’un d’autre. Réessayez dans quelques minutes.',
      );
    }

    // After the atomic claim above, so a caller that lost the race for the
    // last shared slot leaves no live slot of their own behind.
    await this.takeLiveSlot(caller, sessionId);

    this.rememberStart(sessionId);

    this.logger.log(
      JSON.stringify({ event: 'elena.session.granted', sessionId }),
    );
  }

  /**
   * Whether this caller already has a conversation open.
   *
   * Registered students only. Guests are keyed by IP, and a school or a
   * cybercafé is one IP: a per-identity live slot would let one visitor block
   * the building. Their spend is bounded by the daily IP cap instead, which is
   * what it was already doing.
   */
  private async holdsLiveSession(caller: LiveSessionCaller): Promise<boolean> {
    const key = this.liveKeyFor(caller);
    if (!key) return false;

    const distributed = await this.valkey?.countConcurrent(
      key,
      this.sessionMaxSeconds,
    );
    if (distributed !== null && distributed !== undefined) {
      return distributed >= 1;
    }

    const held = this.localLiveSlots.get(key);
    if (!held) return false;
    if (held.expiresAt <= Date.now()) {
      // Expiry rather than a release call, for the same reason the shared pool
      // works that way: an app that dies never tells us. A student whose phone
      // crashed waits out the session ceiling, not the day.
      this.localLiveSlots.delete(key);
      return false;
    }
    return true;
  }

  private async takeLiveSlot(
    caller: LiveSessionCaller,
    sessionId: string,
  ): Promise<void> {
    const key = this.liveKeyFor(caller);
    if (!key) return;

    const distributed = await this.valkey?.trackConcurrent(
      key,
      sessionId,
      1,
      this.sessionMaxSeconds,
    );
    if (distributed !== null && distributed !== undefined) return;

    this.localLiveSlots.set(key, {
      sessionId,
      expiresAt: Date.now() + this.sessionMaxSeconds * 1000,
    });
  }

  private rememberStart(sessionId: string): void {
    const now = Date.now();
    const ceiling = this.sessionMaxSeconds * 1000;
    for (const [id, startedAt] of this.sessionStarts) {
      // Anything past the ceiling ended without telling us, which is the case
      // /live-session/end exists to avoid and cannot be relied on to cover.
      if (now - startedAt > ceiling) this.sessionStarts.delete(id);
    }
    this.sessionStarts.set(sessionId, now);
  }

  /** Null for anyone this rule does not apply to. */
  private liveKeyFor(caller: LiveSessionCaller): string | null {
    return caller.isGuest || !caller.studentId
      ? null
      : liveSlotKey(caller.studentId);
  }

  /**
   * A guest `studentId` is a fresh `crypto.randomUUID()` minted per guest token
   * with no database row, so capping per student would be defeated by calling
   * POST /api/auth/guest again. Guests are capped by IP, which is the only
   * identity they cannot re-roll. Registered students keep a per-account cap so
   * that sharing an office NAT does not lock a class out.
   */
  private identityKey(caller: LiveSessionCaller): string {
    return caller.isGuest || !caller.studentId
      ? `ratelimit:elena:ip:${caller.ip || 'unknown'}`
      : `ratelimit:elena:student:${caller.studentId}`;
  }

  private globalKey(): string {
    return `ratelimit:elena:global:${new Date().toISOString().slice(0, 10)}`;
  }

  private async consume(
    key: string,
    max: number,
    ttlSeconds: number,
  ): Promise<boolean> {
    const distributed = await this.valkey?.enforce([{ key, max, ttlSeconds }]);
    if (distributed !== null && distributed !== undefined) return distributed;

    const current = this.cache.get<number>(key) ?? 0;
    if (current >= max) return false;
    this.cache.set(key, current + 1, ttlSeconds);
    return true;
  }

  /**
   * Frees a slot a caller is finished with, ahead of its TTL.
   *
   * The daily counters are deliberately NOT refunded: the session happened, and
   * refunding on "I'm done" would let a client take unlimited sessions by
   * ending each one immediately.
   *
   * Idempotent, and safe to call with an unknown id — releasing is only ever a
   * capability held by whoever was given the id at mint time, which is a random
   * UUID never shared with anyone else.
   */
  async release(sessionId: string, caller?: LiveSessionCaller): Promise<void> {
    this.localSlots.delete(sessionId);
    await this.valkey?.releaseConcurrent(CONCURRENT_KEY, sessionId);

    // The caller's own slot goes with it. Freeing the shared pool and leaving
    // the student's own place taken would lock them out of the very session
    // they just made room for. Without a caller — an older client, or a
    // release from somewhere that does not know who — it lapses on its own.
    const key = caller ? this.liveKeyFor(caller) : null;
    if (key) {
      const held = this.localLiveSlots.get(key);
      if (held?.sessionId === sessionId) this.localLiveSlots.delete(key);
      await this.valkey?.releaseConcurrent(key, sessionId);
    }
    this.logger.log(
      JSON.stringify({ event: 'elena.session.released', sessionId }),
    );

    // Separate from the line above, and the one worth keeping. Every cost
    // estimate for Elena assumes a conversation runs the full ceiling; this is
    // the number that says whether that is true. Null when this process never
    // saw the start — a zero there would quietly drag the average down.
    const startedAt = this.sessionStarts.get(sessionId);
    this.sessionStarts.delete(sessionId);
    this.logger.log(
      JSON.stringify({
        event: 'elena.session.ended',
        sessionId,
        durationSeconds:
          startedAt === undefined
            ? null
            : Math.round((Date.now() - startedAt) / 1000),
      }),
    );
  }

  /** Read-only look at the pool, so a full pool costs the caller nothing. */
  private async poolIsFull(): Promise<boolean> {
    const distributed = await this.valkey?.countConcurrent(
      CONCURRENT_KEY,
      this.sessionMaxSeconds,
    );
    if (distributed !== null && distributed !== undefined) {
      return distributed >= this.concurrentMax;
    }

    return this.pruneLocalSlots() >= this.concurrentMax;
  }

  private async takeConcurrentSlot(sessionId: string): Promise<boolean> {
    const distributed = await this.valkey?.trackConcurrent(
      CONCURRENT_KEY,
      sessionId,
      this.concurrentMax,
      this.sessionMaxSeconds,
    );
    if (distributed !== null && distributed !== undefined) return distributed;

    if (this.pruneLocalSlots() >= this.concurrentMax) return false;
    this.localSlots.set(sessionId, Date.now() + this.sessionMaxSeconds * 1000);
    return true;
  }

  /** Drops expired slots and returns how many are still held. */
  private pruneLocalSlots(): number {
    const now = Date.now();
    for (const [member, expiresAt] of this.localSlots) {
      if (expiresAt <= now) this.localSlots.delete(member);
    }
    return this.localSlots.size;
  }

  private refuse(messageKey: string, message: string): HttpException {
    this.logger.log(
      JSON.stringify({ event: 'elena.session.refused', messageKey }),
    );
    return new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message,
        messageKey,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
