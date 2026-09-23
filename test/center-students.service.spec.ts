/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CenterStudentsService } from '../src/modules/centers/center-students.service';

describe('CenterStudentsService', () => {
  const identity = { centerUserId: 'owner-1', centerId: 'center-1' } as never;

  const row = (over: Record<string, unknown> = {}) => ({
    id: 'student-1',
    center_id: 'center-1',
    first_name: 'Awa',
    last_name: 'Mbarga',
    email: 'awa@example.com',
    phone: '+237690000000',
    created_at: new Date(),
    last_seen_at: new Date(),
    tier: 'START',
    level: 'B1',
    ...over,
  });

  const PROGRESS = { readiness: { score: 62 } } as never;

  let prisma: any;
  let tx: any;
  let service: CenterStudentsService;
  let progress: any;

  beforeEach(() => {
    progress = {
      forStudents: jest.fn((ids: string[]) =>
        Promise.resolve(new Map(ids.map((id) => [id, PROGRESS]))),
      ),
    };
    tx = {
      student: {
        findFirst: jest.fn().mockResolvedValue(row()),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockImplementation(({ data }) => row(data)),
      },
      centerSeat: {
        findUnique: jest.fn().mockResolvedValue({ quantity: 5 }),
      },
    };
    prisma = {
      student: {
        findMany: jest.fn().mockResolvedValue([row()]),
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue(row()),
        update: jest.fn().mockImplementation(({ data }) => row(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        updateManyAndReturn: jest
          .fn()
          .mockImplementation(({ data }) => [row(data)]),
      },
      $transaction: jest.fn((cb: (c: any) => unknown) =>
        Promise.resolve(cb(tx)),
      ),
    };
    service = new CenterStudentsService(prisma, progress);
  });

  describe('list', () => {
    it('returns only students of the signed center', async () => {
      await service.list(identity, { page: 1, pageSize: 20 });

      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { center_id: 'center-1' } }),
      );
    });

    it('paginates rather than returning every student at once', async () => {
      await service.list(identity, { page: 3, pageSize: 20 });

      const call = prisma.student.findMany.mock.calls[0][0];
      expect(call.skip).toBe(40);
      expect(call.take).toBe(20);
    });

    it('reports the total so a client can page through it', async () => {
      prisma.student.count.mockResolvedValue(57);

      const result = await service.list(identity, { page: 1, pageSize: 20 });

      expect(result.total).toBe(57);
      expect(result.page).toBe(1);
    });

    it('never exposes credentials or verification tokens', async () => {
      prisma.student.findMany.mockResolvedValue([
        row({
          password_hash: 'secret-hash',
          email_verification_token: 'secret-key-hash',
          password_reset_token: 'secret-reset',
        }),
      ]);

      const result = await service.list(identity, { page: 1, pageSize: 20 });

      const json = JSON.stringify(result);
      expect(json).not.toContain('secret-hash');
      expect(json).not.toContain('secret-key-hash');
      expect(json).not.toContain('secret-reset');
    });
  });

  describe('get', () => {
    it('scopes the lookup by the signed center', async () => {
      await service.get(identity, 'student-1');

      expect(prisma.student.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'student-1', center_id: 'center-1' },
        }),
      );
    });

    it('answers 404 for another center student, never 403', async () => {
      // 403 would confirm the id exists somewhere, which is a probe a center
      // could use to enumerate other schools' rosters.
      prisma.student.findFirst.mockResolvedValue(null);

      await expect(service.get(identity, 'other-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // The read and the write both moved inside the transaction, because an
  // update can now consume a seat. They are asserted on the transaction client
  // for that reason, not because the assertions changed meaning.
  describe('update', () => {
    it('changes only the allowlisted fields', async () => {
      await service.update(identity, 'student-1', {
        firstName: 'Awa-Marie',
        phone: '+237690000001',
      });

      expect(prisma.student.updateManyAndReturn).toHaveBeenCalledWith({
        where: { id: 'student-1', center_id: 'center-1' },
        data: { first_name: 'Awa-Marie', phone: '+237690000001' },
      });
    });

    it('refuses an update with no allowlisted field', async () => {
      await expect(
        service.update(identity, 'student-1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      // Refused before anything is written: nothing to check in the database,
      // so nothing should hold a connection.
      expect(prisma.student.updateManyAndReturn).not.toHaveBeenCalled();
    });

    it('answers 404 for a student of another center, writing nothing', async () => {
      // Scoped by center in the write itself, so the check and the update
      // cannot disagree: nothing matched means nothing was changed.
      prisma.student.updateManyAndReturn.mockResolvedValue([]);

      await expect(
        service.update(identity, 'other-1', { firstName: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sets the level a school corrects', async () => {
      await service.update(identity, 'student-1', { level: 'A2' });

      expect(prisma.student.updateManyAndReturn).toHaveBeenCalledWith({
        where: { id: 'student-1', center_id: 'center-1' },
        data: { level: 'A2' },
      });
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      tx.student.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      tx.activationCode = {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      };
      tx.activationCodeEvent = { create: jest.fn().mockResolvedValue({}) };
    });

    it('unlinks rather than deleting, so the account survives', async () => {
      await service.remove(identity, 'student-1');

      // Deleting would destroy a person's learning history because an
      // administrator tidied a roster.
      expect(tx.student.updateMany).toHaveBeenCalledWith({
        where: { id: 'student-1', center_id: 'center-1' },
        data: { center_id: null },
      });
    });

    it('frees the seat immediately', async () => {
      const result = await service.remove(identity, 'student-1');

      expect(result).toEqual({ removed: true });
    });

    it('refuses to touch another center student', async () => {
      tx.student.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.remove(identity, 'other-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(tx.activationCode.updateMany).not.toHaveBeenCalled();
    });

    // Review finding 1: removal used to unlink the student and leave their
    // code connected — so they could never redeem at another school, and this
    // school kept counting the seat as used.
    it('releases the code the student held here, and records it', async () => {
      tx.activationCode.findMany.mockResolvedValue([{ id: 'code-1' }]);

      await service.remove(identity, 'student-1');

      expect(tx.activationCode.findMany).toHaveBeenCalledWith({
        where: {
          student_id: 'student-1',
          center_id: 'center-1',
          status: 'CONNECTED',
        },
        select: { id: true },
      });
      expect(tx.activationCode.updateMany).toHaveBeenCalledWith({
        where: { id: 'code-1', status: 'CONNECTED' },
        data: { status: 'DEACTIVATED' },
      });
      expect(tx.activationCodeEvent.create).toHaveBeenCalledWith({
        data: {
          code_id: 'code-1',
          center_id: 'center-1',
          center_user_id: 'owner-1',
          from_status: 'CONNECTED',
          to_status: 'DEACTIVATED',
          student_id: 'student-1',
        },
      });
    });
  });

  describe('progress and level (D38)', () => {
    it('gives every listed student their numbers from one call for the page', async () => {
      prisma.student.findMany.mockResolvedValue([
        row(),
        row({ id: 'student-2' }),
      ]);

      const result = await service.list(identity, { page: 1, pageSize: 20 });

      expect(progress.forStudents).toHaveBeenCalledTimes(1);
      expect(progress.forStudents).toHaveBeenCalledWith([
        'student-1',
        'student-2',
      ]);
      expect(result.students[1]).toMatchObject({
        level: 'B1',
        progress: PROGRESS,
      });
    });

    it('lets the center correct the student level', async () => {
      const updated = await service.update(identity, 'student-1', {
        level: 'A2',
      });

      expect(prisma.student.updateManyAndReturn).toHaveBeenCalledWith({
        where: { id: 'student-1', center_id: 'center-1' },
        data: { level: 'A2' },
      });
      expect(updated.level).toBe('A2');
    });
  });
});
