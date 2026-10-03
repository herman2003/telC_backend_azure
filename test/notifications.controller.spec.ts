/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ListNotificationsQueryDto,
  NotificationsController,
} from '../src/modules/notifications/notifications.controller';

/**
 * The bell, and the list behind it.
 *
 * Most of this is plumbing. The part that is not is the query string: a URL
 * carries text, and `unreadOnly=false` is the string "false", which is
 * truthy. Getting that wrong means a student who asks for all their
 * notifications silently receives only the unread ones.
 */
describe('NotificationsController', () => {
  const student = { studentId: 'student-1', deviceId: 'device-1' } as never;

  const parse = async (query: Record<string, string>) => {
    const dto = plainToInstance(ListNotificationsQueryDto, query);
    const errors = await validate(dto);
    return { dto, errors };
  };

  describe('reading the query string', () => {
    it('understands unreadOnly=false as false', async () => {
      // Boolean('false') is true. A DTO that used it would hand a student
      // the unread list when they asked for everything, and nothing would
      // ever look wrong.
      const { dto, errors } = await parse({ unreadOnly: 'false' });

      expect(errors).toHaveLength(0);
      expect(dto.unreadOnly).toBe(false);
    });

    it('understands unreadOnly=true as true', async () => {
      const { dto } = await parse({ unreadOnly: 'true' });

      expect(dto.unreadOnly).toBe(true);
    });

    it('leaves it undefined when it is not asked about', async () => {
      const { dto } = await parse({});

      expect(dto.unreadOnly).toBeUndefined();
    });

    it('refuses something that is neither', async () => {
      const { errors } = await parse({ unreadOnly: 'perhaps' });

      expect(errors.length).toBeGreaterThan(0);
    });

    it('reads the limit as a number', async () => {
      const { dto, errors } = await parse({ limit: '25' });

      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(25);
    });
  });

  describe('who it acts for', () => {
    let notifications: any;
    let controller: NotificationsController;

    beforeEach(() => {
      notifications = {
        list: jest.fn().mockResolvedValue({ notifications: [], unread: 0 }),
        markRead: jest.fn().mockResolvedValue({ marked: 1 }),
        markAllRead: jest.fn().mockResolvedValue({ marked: 3 }),
      };
      controller = new NotificationsController(notifications);
    });

    it('lists only the signed-in student', async () => {
      await controller.list(student, {});

      expect(notifications.list).toHaveBeenCalledWith('student-1', {
        unreadOnly: false,
        limit: 50,
      });
    });

    it('passes the filter through when it is asked for', async () => {
      await controller.list(student, { unreadOnly: true, limit: 10 });

      expect(notifications.list).toHaveBeenCalledWith('student-1', {
        unreadOnly: true,
        limit: 10,
      });
    });

    it('marks one read for that student and no other', async () => {
      await controller.markRead(student, 'notification-1');

      expect(notifications.markRead).toHaveBeenCalledWith(
        'student-1',
        'notification-1',
      );
    });
  });
});
