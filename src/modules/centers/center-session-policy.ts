import { UnauthorizedException } from '@nestjs/common';

/** Defaults match docs/CENTER_SESSION_TIMEOUTS_SPEC.md */
export const CENTER_SESSION_IDLE_TTL_DEFAULT = '30m';
export const CENTER_SESSION_ABSOLUTE_TTL_DEFAULT = '12h';

export interface CenterSessionTtlPolicy {
  idleMs: number;
  absoluteMs: number;
}

export interface CenterSessionTimestamps {
  created_at: Date;
  last_used_at: Date;
  revoked_at: Date | null;
}

/**
 * Parses durations like JWT env strings: `15m`, `12h`, `7d`, `30s`.
 *
 * Kept local to center sessions so student token issuance is not coupled to
 * this policy.
 */
export function parseDurationMs(raw: string, envName: string): number {
  const trimmed = raw.trim();
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(trimmed);
  if (!match) {
    throw new Error(
      `${envName} must look like 30m or 12h (got ${JSON.stringify(raw)})`,
    );
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${envName} must be a positive duration`);
  }

  const unit = match[2] as 'ms' | 's' | 'm' | 'h' | 'd';
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  } as const;
  return amount * multipliers[unit];
}

export function loadCenterSessionTtlPolicy(
  env: NodeJS.ProcessEnv = process.env,
): CenterSessionTtlPolicy {
  const idleRaw =
    env.CENTER_SESSION_IDLE_TTL ?? CENTER_SESSION_IDLE_TTL_DEFAULT;
  const absoluteRaw =
    env.CENTER_SESSION_ABSOLUTE_TTL ?? CENTER_SESSION_ABSOLUTE_TTL_DEFAULT;

  return {
    idleMs: parseDurationMs(idleRaw, 'CENTER_SESSION_IDLE_TTL'),
    absoluteMs: parseDurationMs(absoluteRaw, 'CENTER_SESSION_ABSOLUTE_TTL'),
  };
}

/**
 * Admin clocks for a center device session.
 *
 * Throws CENTER_SESSION_REVOKED if the row is already revoked.
 * Throws CENTER_SESSION_EXPIRED when idle or absolute TTL is exceeded.
 */
export function assertCenterSessionWithinTtl(
  session: CenterSessionTimestamps,
  now: Date,
  policy: CenterSessionTtlPolicy,
): void {
  if (session.revoked_at) {
    throw new UnauthorizedException('CENTER_SESSION_REVOKED');
  }

  if (now.getTime() - session.created_at.getTime() > policy.absoluteMs) {
    throw new UnauthorizedException('CENTER_SESSION_EXPIRED');
  }

  if (now.getTime() - session.last_used_at.getTime() > policy.idleMs) {
    throw new UnauthorizedException('CENTER_SESSION_EXPIRED');
  }
}
