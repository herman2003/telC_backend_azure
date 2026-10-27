/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { HttpException, HttpStatus } from '@nestjs/common';
import {
  FREE_WRITING_CORRECTIONS_PER_DAY,
  WritingDailyQuotaService,
} from '../src/modules/writing/writing-daily-quota.service';

describe('WritingDailyQuotaService', () => {
  let prisma: { writingAttempt: { count: jest.Mock } };
  let service: WritingDailyQuotaService;

  beforeEach(() => {
    prisma = { writingAttempt: { count: jest.fn() } };
    service = new WritingDailyQuotaService(prisma as never);
  });

  it(`allows submit when fewer than ${FREE_WRITING_CORRECTIONS_PER_DAY} AI letters today`, async () => {
    prisma.writingAttempt.count.mockResolvedValue(1);

    await expect(service.assertMaySubmit('student-1')).resolves.toBeUndefined();

    const countArg = prisma.writingAttempt.count.mock.calls[0]?.[0] as {
      where: {
        student_id: string;
        exam_attempt_id: null;
        OR: unknown[];
      };
    };
    expect(countArg.where.student_id).toBe('student-1');
    expect(countArg.where.exam_attempt_id).toBeNull();
    // FORMULAR (completed, no feedback) must not match this filter.
    expect(countArg.where.OR).toEqual([
      { status: 'pending' },
      { status: 'completed', feedback: { not: null } },
    ]);
  });

  it('refuses the third AI letter the same UTC day', async () => {
    prisma.writingAttempt.count.mockResolvedValue(2);

    try {
      await service.assertMaySubmit('student-1');
      fail('expected refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      expect((error as HttpException).getResponse()).toMatchObject({
        messageKey: 'writingDailyLimit',
      });
    }
  });
});
