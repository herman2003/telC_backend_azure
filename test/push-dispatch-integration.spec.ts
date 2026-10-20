import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PushWorkerService } from '../src/modules/notifications/push/push-worker.service';
import { PushService } from '../src/modules/notifications/push/push.service';
import { PushCryptoService } from '../src/modules/notifications/push/push-crypto.service';

/** Uses an isolated schema; never truncates or migrates the developer's existing tables. */
describe('durable push dispatch (PostgreSQL)', () => {
  const schema = 'push_test_' + randomUUID().replaceAll('-', '');
  let admin: Pool, pool: Pool, db: PrismaClient;
  const sender = {
    enabled: true,
    send: jest
      .fn<Promise<string>, [{ id: string }, unknown, Date]>()
      .mockResolvedValue('fcm-message'),
  };
  let worker: PushWorkerService;
  const identity = {
    type: 'access' as const,
    studentId: 'push-student',
    deviceId: 'push-device',
    sessionId: 'push-session',
  };
  const savedKey = process.env.PUSH_TOKEN_ENCRYPTION_KEY,
    savedProject = process.env.FIREBASE_PROJECT_ID;
  beforeAll(async () => {
    const url = process.env.DATABASE_URL!;
    const parsed = new URL(url);
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname))
      throw new Error(
        'Push integration requires a local disposable PostgreSQL instance',
      );
    process.env.PUSH_TOKEN_ENCRYPTION_KEY = 'ab'.repeat(32);
    process.env.FIREBASE_PROJECT_ID = 'push-test';
    admin = new Pool({ connectionString: url });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({
      connectionString: url,
      options: `-c search_path=${schema}`,
    });
    await pool.query(`CREATE TABLE students(id TEXT PRIMARY KEY);
   CREATE TABLE device_sessions(id TEXT PRIMARY KEY,student_id TEXT NOT NULL,device_id TEXT NOT NULL,refresh_token_hash TEXT NOT NULL,device_name TEXT,last_used_at TIMESTAMP(3) NOT NULL DEFAULT now(),created_at TIMESTAMP(3) NOT NULL DEFAULT now(),revoked_at TIMESTAMP(3),UNIQUE(student_id,device_id));
   CREATE TABLE exam_sessions(id TEXT PRIMARY KEY,cancelled_at TIMESTAMP(3));
   CREATE TYPE "NotificationKind" AS ENUM ('EXAM_PUBLISHED','EXAM_RESULT_RELEASED');
   CREATE TABLE notifications(id TEXT PRIMARY KEY,student_id TEXT NOT NULL,kind "NotificationKind" NOT NULL,payload JSONB NOT NULL,created_at TIMESTAMP(3) NOT NULL DEFAULT now(),read_at TIMESTAMP(3));`);
    await pool.query(
      readFileSync(
        'prisma/migrations/20261020140000_notification_push/migration.sql',
        'utf8',
      ),
    );
    await pool.query(
      "INSERT INTO students(id) VALUES ('push-student'); INSERT INTO device_sessions(id,student_id,device_id,refresh_token_hash) VALUES ('push-session','push-student','push-device','hash');",
    );
    await pool.query("INSERT INTO exam_sessions(id) VALUES ('opaque-exam-id')");
    db = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });
    const registrations = new PushService(db as never, new PushCryptoService());
    await registrations.register(identity, {
      transport: 'FCM',
      platform: 'ANDROID',
      fcmToken: 'fake-provider-token-for-integration',
      firebaseProjectId: 'push-test',
      locale: 'fr',
      timezone: 'UTC',
      appVersion: '1',
      permission: 'GRANTED',
      backgroundCapable: true,
    });
    await registrations.updatePreferences(identity, {
      quietStart: '00:00',
      quietEnd: '00:00',
    });
    worker = new PushWorkerService(db as never, sender as never);
  });
  afterAll(async () => {
    await db?.$disconnect();
    await pool?.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
    for (const [k, v] of Object.entries({
      PUSH_TOKEN_ENCRYPTION_KEY: savedKey,
      FIREBASE_PROJECT_ID: savedProject,
    })) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  beforeEach(async () => {
    sender.send.mockReset().mockResolvedValue('fcm-message');
    await db.pushDispatch.deleteMany();
    await db.notification.deleteMany();
  });
  const notify = () =>
    db.notification.create({
      data: {
        student_id: identity.studentId,
        kind: 'EXAM_PUBLISHED',
        payload: { sessionId: 'opaque-exam-id' },
      },
    });
  it('rolls the notification and dispatch back in the same transaction', async () => {
    await expect(
      db.$transaction(async (tx) => {
        await tx.notification.create({
          data: {
            student_id: identity.studentId,
            kind: 'EXAM_PUBLISHED',
            payload: {},
          },
        });
        throw Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await db.notification.count()).toBe(0);
    expect(await db.pushDispatch.count()).toBe(0);
  });
  it('two workers claim one dispatch only once', async () => {
    const n = await notify();
    const other = new PushWorkerService(db as never, sender as never);
    await Promise.all([worker.tick(), other.tick()]);
    expect(sender.send).toHaveBeenCalledTimes(1);
    expect(
      (
        await db.pushDispatch.findUniqueOrThrow({
          where: { notification_id: n.id },
        })
      ).status,
    ).toBe('SENT');
  });
  it('recovers work whose previous process died with a lease', async () => {
    const n = await notify();
    await db.pushDispatch.update({
      where: { notification_id: n.id },
      data: {
        status: 'CLAIMED',
        lease_token: 'dead-worker',
        lease_until: new Date(Date.now() - 60000),
      },
    });
    await worker.tick();
    expect(sender.send).toHaveBeenCalledTimes(1);
  });
  it('persists retries and lets a restarted worker finish them', async () => {
    const n = await notify();
    sender.send.mockRejectedValueOnce({ code: 'messaging/server-unavailable' });
    await worker.tick();
    let dispatch = await db.pushDispatch.findUniqueOrThrow({
      where: { notification_id: n.id },
    });
    expect(dispatch.status).toBe('PENDING');
    expect(dispatch.attempts).toBe(1);
    await db.pushDispatch.update({
      where: { id: dispatch.id },
      data: { available_at: new Date(Date.now() - 1000) },
    });
    await new PushWorkerService(db as never, sender as never).tick();
    dispatch = await db.pushDispatch.findUniqueOrThrow({
      where: { id: dispatch.id },
    });
    expect(dispatch.status).toBe('SENT');
  });
  it('keeps an uncertain retry on its original device even after another device becomes active', async () => {
    const n = await notify();
    sender.send.mockRejectedValueOnce({ code: 'messaging/server-unavailable' });
    await worker.tick();
    const first = sender.send.mock.calls[0][0] as { id: string };
    await db.deviceSession.create({
      data: {
        id: 'second-session',
        student_id: identity.studentId,
        device_id: 'second-device',
        refresh_token_hash: 'hash',
      },
    });
    const registrations = new PushService(db as never, new PushCryptoService());
    await registrations.register(
      { ...identity, deviceId: 'second-device', sessionId: 'second-session' },
      {
        transport: 'FCM',
        platform: 'ANDROID',
        fcmToken: 'second-private-device-provider-token',
        firebaseProjectId: 'push-test',
        locale: 'fr',
        timezone: 'UTC',
        appVersion: '1',
        permission: 'GRANTED',
        backgroundCapable: true,
      },
    );
    await db.pushDispatch.update({
      where: { notification_id: n.id },
      data: { available_at: new Date(Date.now() - 1000) },
    });
    await worker.tick();
    expect((sender.send.mock.calls[1][0] as { id: string }).id).toBe(first.id);
    await db.deviceSession.delete({ where: { id: 'second-session' } });
  });
  it('suppresses a notification read from another device before delivery', async () => {
    const n = await notify();
    await db.notification.update({
      where: { id: n.id },
      data: { read_at: new Date() },
    });
    await worker.tick();
    expect(sender.send).not.toHaveBeenCalled();
    expect(
      (
        await db.pushDispatch.findUniqueOrThrow({
          where: { notification_id: n.id },
        })
      ).status,
    ).toBe('SUPPRESSED');
  });
  it('expires old jobs without contacting Firebase', async () => {
    const n = await notify();
    await db.pushDispatch.update({
      where: { notification_id: n.id },
      data: { expires_at: new Date(Date.now() - 1000) },
    });
    await worker.tick();
    expect(sender.send).not.toHaveBeenCalled();
  });
  it('suppresses an exam announcement when the exam was cancelled', async () => {
    const n = await notify();
    await pool.query(
      "UPDATE exam_sessions SET cancelled_at=now() WHERE id='opaque-exam-id'",
    );
    await worker.tick();
    expect(sender.send).not.toHaveBeenCalled();
    expect(
      (
        await db.pushDispatch.findUniqueOrThrow({
          where: { notification_id: n.id },
        })
      ).last_error,
    ).toBe('EXAM_CANCELLED');
    await pool.query(
      "UPDATE exam_sessions SET cancelled_at=NULL WHERE id='opaque-exam-id'",
    );
  });
  it('a revoked session immediately invalidates its push endpoint', async () => {
    await notify();
    await db.deviceSession.update({
      where: { id: identity.sessionId },
      data: { revoked_at: new Date() },
    });
    expect(
      await db.pushEndpoint.count({ where: { invalidated_at: null } }),
    ).toBe(0);
    await worker.tick();
    expect(sender.send).not.toHaveBeenCalled();
  });
});
