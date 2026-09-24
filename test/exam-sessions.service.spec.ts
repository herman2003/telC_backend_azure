/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExamSessionsService } from '../src/modules/centers/exam-sessions.service';
import { ExamSessionPolicyService } from '../src/modules/centers/exam-session-policy.service';

/**
 * Creating, reading and changing a sitting — the half of the exam simulator
 * a center manager touches.
 *
 * The claims worth making against mocks are about scoping and refusals: that
 * a center can only ever see its own sittings, and that an exam already
 * under way cannot be edited. Publishing is not here: spending slots is a
 * claim about a transaction, which belongs in the integration spec.
 */
describe('ExamSessionsService', () => {
  const identity = { centerUserId: 'owner-1', centerId: 'center-1' } as never;
  const HOUR = 60 * 60 * 1000;
  const future = new Date(Date.now() + 48 * HOUR);

  const row = (over: Record<string, unknown> = {}) => ({
    id: 'session-1',
    center_id: 'center-1',
    name: 'Examen B1 — Octobre',
    level: 'B1',
    modelltest_id: 'mt-1',
    grading_tier: 'MANUAL',
    opens_at: future,
    closes_at: new Date(future.getTime() + 48 * HOUR),
    published_at: null,
    cancelled_at: null,
    force_closed_at: null,
    created_at: new Date(),
    modelltest: { number: 2, title: 'Modelltest 2' },
    _count: { participants: 0 },
    ...over,
  });

  let prisma: any;
  let service: ExamSessionsService;

  beforeEach(() => {
    prisma = {
      examSession: {
        create: jest.fn().mockImplementation(({ data }) => row(data)),
        findFirst: jest.fn().mockResolvedValue(row()),
        findMany: jest.fn().mockResolvedValue([row()]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockImplementation(({ data }) => row(data)),
      },
      modelltest: { findUnique: jest.fn().mockResolvedValue({ id: 'mt-1' }) },
      get student() {
        throw new Error('Students are reached through the participant list');
      },
    };
    service = new ExamSessionsService(prisma, new ExamSessionPolicyService());
  });

  describe('creating a draft', () => {
    it('files it under the signed center, never one the caller names', async () => {
      await service.create(identity, {
        name: 'Examen B1 — Octobre',
        modelltestNumber: 2,
        opensAt: future,
        accessWindowHours: 48,
      });

      expect(prisma.examSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ center_id: 'center-1' }),
        }),
      );
    });

    it('computes the closing time rather than accepting one', async () => {
      // A client that could send closes_at could send a sitting that never
      // closes. The window is a choice between three; the date is arithmetic.
      const created = await service.create(identity, {
        name: 'Examen',
        modelltestNumber: 2,
        opensAt: new Date('2026-10-05T09:00:00.000Z'),
        accessWindowHours: 48,
      });

      expect(created.closesAt).toEqual(new Date('2026-10-07T09:00:00.000Z'));
    });

    it('starts as a draft, published by a separate decision', async () => {
      const created = await service.create(identity, {
        name: 'Examen',
        modelltestNumber: 2,
        opensAt: future,
        accessWindowHours: 24,
      });

      expect(created.status).toBe('DRAFT');
      expect(prisma.examSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ published_at: undefined }),
        }),
      );
    });

    it('refuses an opening time in the past', async () => {
      // A sitting that opened before it existed cannot be scheduled, and the
      // manager almost certainly mistyped the date.
      await expect(
        service.create(identity, {
          name: 'Examen',
          modelltestNumber: 2,
          opensAt: new Date(Date.now() - HOUR),
          accessWindowHours: 24,
        }),
      ).rejects.toThrow('OPENS_AT_IN_PAST');
    });

    it('refuses a window that is not one of the three sold', async () => {
      await expect(
        service.create(identity, {
          name: 'Examen',
          modelltestNumber: 2,
          opensAt: future,
          accessWindowHours: 12,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a Modelltest that does not exist', async () => {
      prisma.modelltest.findUnique.mockResolvedValue(null);

      await expect(
        service.create(identity, {
          name: 'Examen',
          modelltestNumber: 99,
          opensAt: future,
          accessWindowHours: 24,
        }),
      ).rejects.toThrow('MODELLTEST_NOT_FOUND');
    });
  });

  describe('reading them', () => {
    it('scopes a read to the signed center, so an id from elsewhere is a 404', async () => {
      // 404 rather than 403: a 403 would confirm the id exists.
      prisma.examSession.findFirst.mockResolvedValue(null);

      await expect(service.get(identity, 'someone-elses')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.examSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'someone-elses', center_id: 'center-1' },
        }),
      );
    });

    it('reports the derived status and the participant count', async () => {
      prisma.examSession.findFirst.mockResolvedValue(
        row({ published_at: new Date(), _count: { participants: 15 } }),
      );

      const found = await service.get(identity, 'session-1');

      expect(found).toMatchObject({
        status: 'SCHEDULED',
        participantCount: 15,
        modelltestNumber: 2,
      });
    });

    it('lists only this center, newest sitting first', async () => {
      await service.list(identity, { page: 1, pageSize: 20 });

      expect(prisma.examSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { center_id: 'center-1' },
          orderBy: { opens_at: 'desc' },
        }),
      );
    });

    it('exposes no raw column names', async () => {
      const json = JSON.stringify(await service.get(identity, 'session-1'));

      expect(json).not.toContain('center_id');
      expect(json).not.toContain('opens_at');
    });
  });

  describe('changing one', () => {
    it('lets a draft be renamed', async () => {
      await service.update(identity, 'session-1', { name: 'Examen final B1' });

      expect(prisma.examSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'Examen final B1' } }),
      );
    });

    it('recomputes the closing time when the opening moves', async () => {
      // Moving the start of a 48-hour sitting moves its end. Leaving
      // closes_at behind would silently shorten or extend the window.
      await service.update(identity, 'session-1', {
        opensAt: new Date('2026-11-01T09:00:00.000Z'),
        accessWindowHours: 24,
      });

      expect(prisma.examSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            closes_at: new Date('2026-11-02T09:00:00.000Z'),
          }),
        }),
      );
    });

    it('refuses to change a sitting that has opened', async () => {
      // Somebody may be sitting it. The exam they started has to stay the
      // exam they finish.
      prisma.examSession.findFirst.mockResolvedValue(
        row({
          published_at: new Date(Date.now() - 48 * HOUR),
          opens_at: new Date(Date.now() - HOUR),
          closes_at: new Date(Date.now() + HOUR),
        }),
      );

      await expect(
        service.update(identity, 'session-1', { name: 'Too late' }),
      ).rejects.toThrow('EXAM_ALREADY_OPEN');
      expect(prisma.examSession.update).not.toHaveBeenCalled();
    });

    it('cancels a sitting, and says so rather than deleting it', async () => {
      // A cancelled sitting is evidence: it was published, students were
      // told, and somebody may ask why it did not happen.
      await service.cancel(identity, 'session-1');

      expect(prisma.examSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { cancelled_at: expect.any(Date) },
        }),
      );
    });

    it('refuses to cancel twice', async () => {
      prisma.examSession.findFirst.mockResolvedValue(
        row({ cancelled_at: new Date() }),
      );

      await expect(service.cancel(identity, 'session-1')).rejects.toThrow(
        'EXAM_CANCELLED',
      );
    });
  });

  describe('closing and reopening', () => {
    const open = () =>
      row({
        published_at: new Date(Date.now() - 48 * HOUR),
        opens_at: new Date(Date.now() - HOUR),
        closes_at: new Date(Date.now() + HOUR),
      });

    it('closes an open sitting early, because it is the center exam', async () => {
      prisma.examSession.findFirst.mockResolvedValue(open());

      await service.closeNow(identity, 'session-1');

      expect(prisma.examSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { force_closed_at: expect.any(Date) },
        }),
      );
    });

    it('reopens a lapsed sitting by moving its closing time', async () => {
      // The center may give a student who missed it another day. Clearing
      // force_closed_at too, or a hand-closed sitting could never reopen.
      prisma.examSession.findFirst.mockResolvedValue(
        row({
          published_at: new Date(Date.now() - 96 * HOUR),
          opens_at: new Date(Date.now() - 72 * HOUR),
          closes_at: new Date(Date.now() - HOUR),
          force_closed_at: new Date(Date.now() - HOUR),
        }),
      );

      await service.reopen(identity, 'session-1', 24);

      expect(prisma.examSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ force_closed_at: null }),
        }),
      );
    });

    it('refuses to reopen one that has not opened yet', async () => {
      // The bug this guards: a sitting opening in two days, reopened for 24
      // hours, would be given a closing time a day BEFORE its opening — a
      // window nobody can ever sit, and a 500 from the check constraint.
      prisma.examSession.findFirst.mockResolvedValue(
        row({
          published_at: new Date(Date.now() - HOUR),
          opens_at: new Date(Date.now() + 48 * HOUR),
          closes_at: new Date(Date.now() + 96 * HOUR),
        }),
      );

      await expect(service.reopen(identity, 'session-1', 24)).rejects.toThrow(
        'EXAM_NOT_CLOSED',
      );
      expect(prisma.examSession.update).not.toHaveBeenCalled();
    });

    it('refuses to reopen one that is still open, which would shorten it', async () => {
      prisma.examSession.findFirst.mockResolvedValue(open());

      await expect(service.reopen(identity, 'session-1', 24)).rejects.toThrow(
        'EXAM_NOT_CLOSED',
      );
    });

    it('refuses to reopen a cancelled sitting', async () => {
      prisma.examSession.findFirst.mockResolvedValue(
        row({ cancelled_at: new Date() }),
      );

      await expect(service.reopen(identity, 'session-1', 24)).rejects.toThrow(
        'EXAM_CANCELLED',
      );
    });

    it('refuses to reopen one that was never published', async () => {
      await expect(service.reopen(identity, 'session-1', 24)).rejects.toThrow(
        'EXAM_NOT_PUBLISHED',
      );
    });
  });
});
