import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { CenterAccessTokenPayload } from '../../../shared/interfaces/token-payload.interface';
import { PrismaService } from '../../../shared/services/prisma.service';
import { ValkeyService } from '../../../shared/services/valkey.service';
import { TokenService } from '../../auth/token.service';
import {
  assertCenterSessionWithinTtl,
  loadCenterSessionTtlPolicy,
} from '../center-session-policy';

export interface CenterAuthenticatedRequest extends Request {
  centerUser?: CenterAccessTokenPayload;
}

/**
 * Authenticates center users, and is the piece that makes center logout mean
 * anything: until a guard checks the session, a revoked refresh token still
 * leaves its access token working until expiry.
 *
 * Only `verifyCenterAccessToken` is used, so a student or guest token cannot
 * cross into center routes — the student guard refuses center tokens for the
 * same reason, from the other side.
 *
 * Idle and absolute TTLs are enforced here against the session row, not the
 * JWT string — a manager who left yesterday must re-authenticate.
 */
@Injectable()
export class CenterAuthGuard implements CanActivate {
  private readonly sessionTtl = loadCenterSessionTtlPolicy();

  constructor(
    private readonly tokenService: TokenService,
    private readonly valkeyService: ValkeyService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<CenterAuthenticatedRequest>();

    const payload = this.verifyBearerToken(request);
    await this.assertSessionActive(payload);

    request.centerUser = payload;
    return true;
  }

  private verifyBearerToken(
    request: CenterAuthenticatedRequest,
  ): CenterAccessTokenPayload {
    const header = request.headers['authorization'];
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('INVALID_CENTER_ACCESS_TOKEN');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('INVALID_CENTER_ACCESS_TOKEN');
    }

    return this.tokenService.verifyCenterAccessToken(token);
  }

  /**
   * The cache is the fast path for logout; the database is the authority for
   * both revocation and admin TTLs. A cache that cannot answer (`null`) must
   * not be read as "not revoked". A cache that says "active" still must load
   * timestamps — idle/absolute live on the row, not in Valkey.
   */
  private async assertSessionActive(
    payload: CenterAccessTokenPayload,
  ): Promise<void> {
    const revoked = await this.valkeyService.isSessionRevoked(
      payload.sessionId,
    );
    if (revoked === true) {
      throw new UnauthorizedException('CENTER_SESSION_REVOKED');
    }

    let session: {
      id: string;
      created_at: Date;
      last_used_at: Date;
      revoked_at: Date | null;
    } | null;
    try {
      session = await this.prisma.centerDeviceSession.findFirst({
        where: {
          id: payload.sessionId,
          center_user_id: payload.centerUserId,
          device_id: payload.deviceId,
          revoked_at: null,
        },
        select: {
          id: true,
          created_at: true,
          last_used_at: true,
          revoked_at: true,
        },
      });
    } catch {
      // A database outage is not an authentication failure. Reporting it as
      // 401 would tell every signed-in center user their session died.
      throw new ServiceUnavailableException(
        'CENTER_SESSION_VERIFICATION_UNAVAILABLE',
      );
    }

    if (!session) {
      throw new UnauthorizedException('CENTER_SESSION_REVOKED');
    }

    try {
      assertCenterSessionWithinTtl(session, new Date(), this.sessionTtl);
    } catch (error) {
      if (
        error instanceof UnauthorizedException &&
        error.message === 'CENTER_SESSION_EXPIRED'
      ) {
        await this.revokeExpiredSession(
          payload.sessionId,
          payload.centerUserId,
        );
      }
      throw error;
    }

    try {
      await this.prisma.centerDeviceSession.updateMany({
        where: {
          id: payload.sessionId,
          center_user_id: payload.centerUserId,
          revoked_at: null,
        },
        data: { last_used_at: new Date() },
      });
    } catch {
      // Activity stamp is best-effort; do not fail an otherwise valid request
      // because last_used_at could not be written.
    }
  }

  private async revokeExpiredSession(
    sessionId: string,
    centerUserId: string,
  ): Promise<void> {
    try {
      await this.prisma.centerDeviceSession.updateMany({
        where: {
          id: sessionId,
          center_user_id: centerUserId,
          revoked_at: null,
        },
        data: { revoked_at: new Date() },
      });
    } catch {
      // Database revoke failed; still surface EXPIRED to the client.
    }

    try {
      await this.valkeyService.revokeSession(sessionId);
    } catch {
      // Cache is advisory; DB revoked_at is the authority on the next read.
    }
  }
}
