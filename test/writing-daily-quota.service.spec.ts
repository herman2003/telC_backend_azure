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

  it(`allows submit when fewer than ${FREE_WRITING_CORRECTIONS_PER_DAY} training attempts today`, async () => {
    prisma.writingAttempt.count.mockResolvedValue(1);

    await expect(service.assertMaySubmit('student-1')).resolves.toBeUndefined();
    expect(prisma.writingAttempt.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          student_id: 'student-1',
          exam_attempt_id: null,
          status: { in: ['pending', 'completed'] },
        }),
      }),
    );
  });

  it('refuses the third training submit the same UTC day', async () => {
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
