import { Injectable } from '@nestjs/common';
import type { NotificationKind, Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/** An app has no use for more than this at once, and a student with two
 *  years of them should not be able to ask for all of them. */
const MAX_NOTIFICATIONS = 100;

export interface NotificationView {
  id: string;
  kind: NotificationKind;
  /** The facts the app writes its sentence from. */
  payload: unknown;
  createdAt: Date;
  readAt: Date | null;
}

export interface NotificationList {
  notifications: NotificationView[];
  unread: number;
}

/** Either the client or a transaction: writing a notification has to be able
 *  to join whatever the thing it announces is doing. */
type Writer = Pick<PrismaService, 'notification'> | Prisma.TransactionClient;

/**
 * Things a student should know without going to look for them.
 *
 * The payload is facts, never a sentence. The app writes the wording in the
 * language the student reads; a sentence stored here would be a sentence
 * stored in one language, and no translation could be added afterwards.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    studentId: string,
    query: { unreadOnly: boolean; limit: number },
  ): Promise<NotificationList> {
    const where = {
      student_id: studentId,
      ...(query.unreadOnly ? { read_at: null } : {}),
    };

    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: Math.min(query.limit, MAX_NOTIFICATIONS),
        select: {
          id: true,
          kind: true,
          payload: true,
          created_at: true,
          read_at: true,
        },
      }),
      // Always the unread count, even when the list is filtered: it is what
      // the bell shows, and it should not change because of how the list was
      // asked for.
      this.prisma.notification.count({
        where: { student_id: studentId, read_at: null },
      }),
    ]);

    return {
      notifications: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        payload: row.payload,
        createdAt: row.created_at,
        readAt: row.read_at,
      })),
      unread,
    };
  }

  /**
   * Marks one read.
   *
   * Scoped in the statement rather than checked afterwards, and silent when
   * it changes nothing: two taps on the same bell is not an error, and the
   * second one should simply do nothing.
   */
  async markRead(
    studentId: string,
    notificationId: string,
  ): Promise<{ marked: number }> {
    const marked = await this.prisma.notification.updateMany({
      where: { id: notificationId, student_id: studentId, read_at: null },
      data: { read_at: new Date() },
    });

    return { marked: marked.count };
  }

  async markAllRead(studentId: string): Promise<{ marked: number }> {
    const marked = await this.prisma.notification.updateMany({
      where: { student_id: studentId, read_at: null },
      data: { read_at: new Date() },
    });

    return { marked: marked.count };
  }

  /**
   * Tells a group of students one thing.
   *
   * Takes an optional writer so it can join the transaction of whatever it is
   * announcing. Publishing an exam and telling its candidates has to be one
   * thing: an exam published with nobody told is worse than a publish that
   * failed, because only one of the two is visible to anybody.
   */
  async notifyMany(
    studentIds: string[],
    kind: NotificationKind,
    payload: Record<string, unknown>,
    writer?: Writer,
  ): Promise<void> {
    if (studentIds.length === 0) return;

    const client = writer ?? this.prisma;
    await client.notification.createMany({
      data: studentIds.map((studentId) => ({
        student_id: studentId,
        kind,
        payload: payload as Prisma.InputJsonValue,
      })),
    });
  }
}
