import { UnauthorizedException } from '@nestjs/common';
import {
  assertCenterSessionWithinTtl,
  loadCenterSessionTtlPolicy,
  parseDurationMs,
} from '../src/modules/centers/center-session-policy';

describe('center-session-policy', () => {
  describe('parseDurationMs', () => {
    it.each([
      ['30m', 30 * 60_000],
      ['12h', 12 * 3_600_000],
      ['7d', 7 * 86_400_000],
      ['45s', 45_000],
      ['500ms', 500],
    ])('parses %s', (raw, expected) => {
      expect(parseDurationMs(raw, 'TEST')).toBe(expected);
    });

    it('rejects malformed values', () => {
      expect(() => parseDurationMs('thirty', 'TEST')).toThrow(/TEST/);
      expect(() => parseDurationMs('0m', 'TEST')).toThrow(/positive/);
    });
  });

  describe('loadCenterSessionTtlPolicy', () => {
    it('uses 30m / 12h defaults when env is unset', () => {
      expect(loadCenterSessionTtlPolicy({})).toEqual({
        idleMs: 30 * 60_000,
        absoluteMs: 12 * 3_600_000,
      });
    });

    it('reads CENTER_SESSION_* overrides', () => {
      expect(
        loadCenterSessionTtlPolicy({
          CENTER_SESSION_IDLE_TTL: '15m',
          CENTER_SESSION_ABSOLUTE_TTL: '8h',
        }),
      ).toEqual({
        idleMs: 15 * 60_000,
        absoluteMs: 8 * 3_600_000,
      });
    });
  });

  describe('assertCenterSessionWithinTtl', () => {
    const policy = { idleMs: 30 * 60_000, absoluteMs: 12 * 3_600_000 };
    const now = new Date('2026-10-04T12:00:00.000Z');

    it('allows a fresh active session', () => {
      expect(() =>
        assertCenterSessionWithinTtl(
          {
            created_at: new Date('2026-10-04T10:00:00.000Z'),
            last_used_at: new Date('2026-10-04T11:50:00.000Z'),
            revoked_at: null,
          },
          now,
          policy,
        ),
      ).not.toThrow();
    });

    it('rejects when already revoked', () => {
      expect(() =>
        assertCenterSessionWithinTtl(
          {
            created_at: new Date('2026-10-04T10:00:00.000Z'),
            last_used_at: new Date('2026-10-04T11:50:00.000Z'),
            revoked_at: new Date('2026-10-04T11:55:00.000Z'),
          },
          now,
          policy,
        ),
      ).toThrow(UnauthorizedException);

      try {
        assertCenterSessionWithinTtl(
          {
            created_at: new Date('2026-10-04T10:00:00.000Z'),
            last_used_at: new Date('2026-10-04T11:50:00.000Z'),
            revoked_at: new Date('2026-10-04T11:55:00.000Z'),
          },
          now,
          policy,
        );
      } catch (error) {
        expect((error as UnauthorizedException).message).toBe(
          'CENTER_SESSION_REVOKED',
        );
      }
    });

    it('rejects when idle TTL is exceeded', () => {
      expect(() =>
        assertCenterSessionWithinTtl(
          {
            created_at: new Date('2026-10-04T10:00:00.000Z'),
            last_used_at: new Date('2026-10-04T11:20:00.000Z'),
            revoked_at: null,
          },
          now,
          policy,
        ),
      ).toThrow('CENTER_SESSION_EXPIRED');
    });

    it('rejects when absolute TTL is exceeded even if last_used_at is fresh', () => {
      expect(() =>
        assertCenterSessionWithinTtl(
          {
            created_at: new Date('2026-10-03T23:00:00.000Z'),
            last_used_at: new Date('2026-10-04T11:59:00.000Z'),
            revoked_at: null,
          },
          now,
          policy,
        ),
      ).toThrow('CENTER_SESSION_EXPIRED');
    });
  });
});
