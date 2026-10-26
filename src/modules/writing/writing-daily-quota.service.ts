import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { FREE_WRITING_CORRECTIONS_PER_DAY } from '../../shared/services/entitlement-spend.service';
import { trainingAiSchreibenUsedWhere } from '../../shared/writing-ai-quota';

export { FREE_WRITING_CORRECTIONS_PER_DAY };

/**
 * Product quota for training Schreiben AI corrections (not exam attempts).
 * A1/A2 FORMULAR auto-scores do not consume this allowance.
 */
@Injectable()
export class WritingDailyQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  /** How many of Start's free training AI corrections remain today (UTC). */
  async remainingToday(studentId: string, now = new Date()): Promise<number> {
    const used = await this.prisma.writingAttempt.count({
      where: trainingAiSchreibenUsedWhere(studentId, now),
    });
    return Math.max(0, FREE_WRITING_CORRECTIONS_PER_DAY - used);
  }

  /**
   * Refuses a new training letter AI submission when the free two are used
   * and the caller has no credit path. Prefer `WritingService.submit`, which
   * also spends `AI_SCHREIBEN_CREDIT` after the free two.
   *
   * FORMULAR auto-scores and exam attempts do not count.
   */
  async assertMaySubmit(studentId: string, now = new Date()): Promise<void> {
    if ((await this.remainingToday(studentId, now)) > 0) return;

    throw new HttpException(
      {
        messageKey: 'writingDailyLimit',
        message:
          'Vous avez utilisé vos 2 corrections Schreiben du jour. Réessayez demain.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
