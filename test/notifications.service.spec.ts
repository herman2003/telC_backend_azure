/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { NotificationsService } from '../src/shared/services/notifications.service';

/**
 * Things a student should know without going to look for them.
 *
 * The payload is facts, never a sentence: the app writes the wording in the
 * language the student reads, and a sentence stored here would be a sentence
 * stored in one language for ever.
 */
describe('NotificationsService', () => {
  const STUDENT = 'student-1';

  let prisma: any;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new NotificationsService(prisma);
  });

  describe('listing mine', () => {
    it('asks only for this student, newest first', async () => {
      await service.list(STUDENT, { unreadOnly: false, limit: 50 });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { student_id: STUDENT },
          orderBy: { created_at: 'desc' },
          take: 50,
        }),
      );
    });

    it('can ask for the unread ones alone, which is what a bell shows', async () => {
      await service.list(STUDENT, { unreadOnly: true, limit: 50 });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { student_id: STUDENT, read_at: null },
        }),
      );
    });

    it('caps how many it will return', async () => {
      // A student with two years of notifications should not be able to ask
      // for all of them at once, and an app has no use for them either.
      await service.list(STUDENT, { unreadOnly: false, limit: 5000 });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('reports the unread count beside the list', async () => {
      prisma.notification.count.mockResolvedValue(3);

      const mine = await service.list(STUDENT, {
        unreadOnly: false,
        limit: 50,
      });

      expect(mine.unread).toBe(3);
    });
  });

  describe('marking one read', () => {
    it("marks only this student's own", async () => {
      // Scoped in the statement: an id from elsewhere must change nothing,
      // not throw after the fact.
      await service.markRead(STUDENT, 'notification-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'notification-1', student_id: STUDENT, read_at: null },
        }),
      );
    });

    it('is quiet about one that was already read', async () => {
      // Two taps on the same bell. The second changing nothing is correct,
      // and an error would be noise.
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.markRead(STUDENT, 'notification-1'),
      ).resolves.toEqual({ marked: 0 });
    });

    it('marks everything read in one statement', async () => {
      await service.markAllRead(STUDENT);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { student_id: STUDENT, read_at: null },
        }),
      );
    });
  });

  describe('writing them', () => {
    it('stores facts rather than a sentence', async () => {
      await service.notifyMany(['student-1', 'student-2'], 'EXAM_PUBLISHED', {
        sessionId: 'session-1',
        opensAt: '2026-10-05T09:00:00.000Z',
      });

      expect(prisma.notification.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              student_id: 'student-1',
              kind: 'EXAM_PUBLISHED',
              payload: {
                sessionId: 'session-1',
                opensAt: '2026-10-05T09:00:00.000Z',
              },
            }),
            expect.objectContaining({ student_id: 'student-2' }),
          ],
        }),
      );
    });

    it('writes through the transaction it is given', async () => {
      // Publishing an exam and telling the candidates has to be one thing. An
      // exam published with nobody told is worse than a publish that failed,
      // because only one of the two is visible to anybody.
      const tx = { notification: { createMany: jest.fn() } };

      await service.notifyMany(
        ['student-1'],
        'EXAM_PUBLISHED',
        {},
        tx as never,
      );

      expect(tx.notification.createMany).toHaveBeenCalled();
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it('does nothing at all for an empty list', async () => {
      await service.notifyMany([], 'EXAM_PUBLISHED', {});

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });
  });
});
