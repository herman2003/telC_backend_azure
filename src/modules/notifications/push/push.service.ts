import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import type { AccessTokenPayload } from '../../../shared/interfaces/token-payload.interface';
import { PushCryptoService } from './push-crypto.service';
import { RegisterPushDto, PushPreferencesDto } from './push.dto';
@Injectable()
export class PushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: PushCryptoService,
  ) {}
  private identity(user: AccessTokenPayload): string {
    if (user.isGuest || !user.sessionId)
      throw new UnauthorizedException('PUSH_REQUIRES_ACCOUNT_SESSION');
    return user.sessionId;
  }
  async register(user: AccessTokenPayload, dto: RegisterPushDto) {
    const sessionId = this.identity(user);
    const project = process.env.FIREBASE_PROJECT_ID;
    if (!project) throw new ServiceUnavailableException('PUSH_NOT_CONFIGURED');
    if (dto.firebaseProjectId !== project)
      throw new BadRequestException('PUSH_PROJECT_MISMATCH');
    if (!dto.backgroundCapable)
      throw new BadRequestException('PUSH_BACKGROUND_REQUIRED');
    const tokenHash = this.crypto.hash(dto.fcmToken);
    // A client may only bind the session in its verified JWT; never trust body ownership.
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.deviceSession.findFirst({
        where: {
          id: sessionId,
          student_id: user.studentId,
          device_id: user.deviceId,
          revoked_at: null,
        },
      });
      if (!session) throw new UnauthorizedException('SESSION_REVOKED');
      const data = {
        student_id: user.studentId,
        device_id: user.deviceId,
        session_id: sessionId,
        platform: dto.platform,
        target_ciphertext: this.crypto.encrypt(dto.fcmToken),
        target_hash: tokenHash,
        locale: dto.locale,
        timezone: dto.timezone,
        app_version: dto.appVersion,
        permission: dto.permission,
        last_active_at: new Date(),
        invalidated_at: null,
      };
      // One address must never receive messages for two accounts after an account switch.
      await tx.pushEndpoint.deleteMany({
        where: {
          target_hash: tokenHash,
          NOT: {
            student_id: user.studentId,
            device_id: user.deviceId,
            platform: dto.platform,
          },
        },
      });
      const endpoint = await tx.pushEndpoint.upsert({
        where: {
          student_id_device_id_platform: {
            student_id: user.studentId,
            device_id: user.deviceId,
            platform: dto.platform,
          },
        },
        create: data,
        update: data,
        select: { id: true, platform: true, permission: true },
      });
      await tx.notificationPreference.upsert({
        where: { student_id: user.studentId },
        create: { student_id: user.studentId, timezone: dto.timezone },
        update: { timezone: dto.timezone },
      });
      return endpoint;
    });
  }
  async remove(user: AccessTokenPayload) {
    this.identity(user);
    return this.prisma.pushEndpoint.updateMany({
      where: { student_id: user.studentId, device_id: user.deviceId },
      data: { invalidated_at: new Date(), preferred: false },
    });
  }
  async preferences(user: AccessTokenPayload) {
    this.identity(user);
    const p = await this.prisma.notificationPreference.findUnique({
      where: { student_id: user.studentId },
    });
    return {
      transactionalEnabled: p?.transactional_enabled ?? true,
      timezone: p?.timezone ?? 'Europe/Berlin',
      quietStart: p?.quiet_start ?? '21:00',
      quietEnd: p?.quiet_end ?? '08:00',
    };
  }
  async updatePreferences(user: AccessTokenPayload, dto: PushPreferencesDto) {
    this.identity(user);
    const data = {
      ...(dto.transactionalEnabled !== undefined && {
        transactional_enabled: dto.transactionalEnabled,
      }),
      ...(dto.timezone && { timezone: dto.timezone }),
      ...(dto.quietStart && { quiet_start: dto.quietStart }),
      ...(dto.quietEnd && { quiet_end: dto.quietEnd }),
    };
    await this.prisma.notificationPreference.upsert({
      where: { student_id: user.studentId },
      create: { student_id: user.studentId, ...data },
      update: data,
    });
    return this.preferences(user);
  }
}
