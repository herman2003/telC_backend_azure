import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../shared/services/prisma.service';
import { FirebasePushService } from './firebase-push.service';
import {
  INVALID_TOKEN_CODES,
  PROVIDER_CONFIG_CODES,
  quietHoursEnd,
  retryDelay,
} from './push-policy';

/** Timers only wake the worker; durable jobs and claim leases always live in PostgreSQL. */
@Injectable()
export class PushWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushWorkerService.name);
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private stopping = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebasePushService,
  ) {}
  onModuleInit() {
    if (this.firebase.enabled) this.schedule();
  }
  private schedule() {
    this.timer = setTimeout(() => {
      if (this.stopping) return;
      this.running = this.tick()
        .catch(() => this.logger.error('push.worker.failed'))
        .finally(() => {
          if (!this.stopping) this.schedule();
        });
    }, 15000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    this.stopping = true;
    clearTimeout(this.timer);
    await this.running;
  }
  async tick() {
    if (!this.firebase.enabled) return;
    const lease = randomUUID();
    const jobs = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM push_dispatches WHERE
          (status = 'PENDING' AND available_at <= now()) OR
          (status = 'CLAIMED' AND lease_until < now())
        ORDER BY available_at, id LIMIT 10 FOR UPDATE SKIP LOCKED`;
      if (!rows.length) return [];
      await tx.pushDispatch.updateMany({
        where: { id: { in: rows.map((x) => x.id) } },
        data: {
          status: 'CLAIMED',
          lease_token: lease,
          lease_until: new Date(Date.now() + 5 * 60000),
        },
      });
      return rows;
    });
    for (const row of jobs) await this.dispatch(row.id, lease);
  }
  private async dispatch(id: string, lease: string) {
    const job = await this.prisma.pushDispatch.findFirst({
      where: { id, status: 'CLAIMED', lease_token: lease },
      include: { notification: true },
    });
    if (!job) return;
    const finish = (status: string, extra: object = {}) =>
      this.prisma.pushDispatch.updateMany({
        where: { id, lease_token: lease, status: 'CLAIMED' },
        data: { status, lease_until: null, lease_token: null, ...extra },
      });
    const now = new Date();
    if (now >= job.expires_at) {
      await finish('EXPIRED');
      return;
    }
    if (job.notification.read_at) {
      await finish('SUPPRESSED', { last_error: 'ALREADY_READ' });
      return;
    }
    const preferences = await this.prisma.notificationPreference.findUnique({
      where: { student_id: job.notification.student_id },
    });
    if (preferences?.transactional_enabled === false) {
      await finish('SUPPRESSED', { last_error: 'PREFERENCE_DISABLED' });
      return;
    }
    if (
      !['EXAM_PUBLISHED', 'EXAM_RESULT_RELEASED'].includes(
        job.notification.kind,
      )
    ) {
      await finish('SUPPRESSED', { last_error: 'UNSUPPORTED_KIND' });
      return;
    }
    const payload = job.notification.payload as Record<string, unknown>;
    if (
      job.notification.kind === 'EXAM_PUBLISHED' &&
      typeof payload.sessionId === 'string'
    ) {
      const exam = await this.prisma.examSession.findUnique({
        where: { id: payload.sessionId },
        select: { cancelled_at: true },
      });
      if (!exam || exam.cancelled_at) {
        await finish('SUPPRESSED', { last_error: 'EXAM_CANCELLED' });
        return;
      }
    }
    const endpoints = await this.prisma.pushEndpoint.findMany({
      where: {
        student_id: job.notification.student_id,
        invalidated_at: null,
        permission: 'GRANTED',
        last_active_at: { gte: new Date(Date.now() - 90 * 86400000) },
        session: { revoked_at: null },
      },
      orderBy: [
        { preferred: 'desc' },
        { last_active_at: 'desc' },
        { id: 'asc' },
      ],
      take: 10,
    });
    // Apple native is opt-in only after APNs is configured. Web stays supported.
    const eligibleEndpoint = (e: (typeof endpoints)[number]) => {
      if (['IOS', 'MACOS'].includes(e.platform))
        return process.env.PUSH_APPLE_ENABLED === 'true';
      if (e.platform === 'ANDROID')
        return process.env.PUSH_ANDROID_ENABLED !== 'false';
      return process.env.PUSH_WEB_ENABLED !== 'false';
    };
    // Keep retries on the first chosen device: a lost acknowledgement must not
    // turn one notification into a second device's alert. Fallback only if invalid.
    const endpoint =
      endpoints.find((e) => e.id === job.endpoint_id && eligibleEndpoint(e)) ??
      endpoints.find(eligibleEndpoint);
    if (!endpoint) {
      await finish('PENDING', {
        available_at: new Date(Date.now() + 3600000),
        last_error: 'NO_ELIGIBLE_ENDPOINT',
      });
      return;
    }
    const afterQuiet = quietHoursEnd(
      now,
      preferences?.timezone ?? endpoint.timezone,
      preferences?.quiet_start,
      preferences?.quiet_end,
    );
    if (afterQuiet) {
      await finish('PENDING', {
        available_at: afterQuiet,
        last_error: 'QUIET_HOURS',
      });
      return;
    }
    // Revalidate the session and read state immediately before external delivery.
    const eligible = await this.prisma.pushEndpoint.findFirst({
      where: {
        id: endpoint.id,
        invalidated_at: null,
        session: { revoked_at: null },
      },
    });
    const unread = await this.prisma.notification.findFirst({
      where: { id: job.notification_id, read_at: null },
    });
    if (!eligible || !unread) {
      await finish('SUPPRESSED', {
        last_error: 'ENDPOINT_OR_NOTIFICATION_CHANGED',
      });
      return;
    }
    if (!this.firebase.enabled) {
      await finish('PENDING');
      return;
    }
    const owned = await this.prisma.pushDispatch.updateMany({
      where: { id, status: 'CLAIMED', lease_token: lease },
      data: {
        lease_until: new Date(Date.now() + 5 * 60000),
        endpoint_id: endpoint.id,
      },
    });
    if (!owned.count) return;
    try {
      await this.firebase.send(endpoint, job.notification, job.expires_at);
      await finish(process.env.PUSH_DRY_RUN === 'true' ? 'DRY_RUN' : 'SENT', {
        sent_at: new Date(),
        endpoint_id: endpoint.id,
        attempts: { increment: 1 },
        last_error: null,
      });
      this.logger.log(`push.dispatch.completed id=${id}`);
    } catch (error: unknown) {
      // Only emit whitelisted provider codes, never provider payloads or tokens.
      const raw = (error as { code?: string })?.code ?? '';
      const invalid = INVALID_TOKEN_CODES.has(raw);
      const configuration = PROVIDER_CONFIG_CODES.has(raw);
      if (invalid)
        await this.prisma.pushEndpoint.updateMany({
          where: { id: endpoint.id },
          data: { invalidated_at: new Date(), preferred: false },
        });
      const attempts = job.attempts + 1;
      const at = new Date(Date.now() + retryDelay(attempts));
      const status =
        at >= job.expires_at
          ? 'EXPIRED'
          : configuration
            ? 'PENDING'
            : invalid
              ? 'PENDING'
              : attempts >= 5
                ? 'FAILED'
                : 'PENDING';
      await finish(status, {
        available_at: at,
        attempts: { increment: configuration ? 0 : 1 },
        last_error: invalid
          ? 'INVALID_TARGET'
          : configuration
            ? 'PROVIDER_CONFIGURATION'
            : 'PROVIDER_TEMPORARY',
      });
      this.logger.warn(
        `push.dispatch.failed id=${id} class=${configuration ? 'configuration' : invalid ? 'invalid-target' : 'temporary'}`,
      );
    }
  }
}
