import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { getSevenDayPeriod } from '../../modules/modelltests/seven-day-period';
import { PrismaService } from './prisma.service';
import { EntitlementSpendService } from './entitlement-spend.service';

/**
 * Start may train on the current weekly Modelltest; Prep Pass unlocks the
 * full training pool. Guests are handled by PrepPassGuard, not here.
 */
@Injectable()
export class TrainingModelltestAccessService {
  constructor(
    private readonly entitlements: EntitlementSpendService,
    private readonly prisma: PrismaService,
  ) {}

  async isPrepPassActive(studentId: string, now: Date = new Date()): Promise<boolean> {
    try {
      const decision = await this.entitlements.mayUse(studentId, 'PREP_PASS', now);
      return decision.allowed;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ServiceUnavailableException('PREP_PASS_CHECK_UNAVAILABLE');
    }
  }

  async assertMayAccess(
    studentId: string,
    modelltestNumber: number,
    now: Date = new Date(),
  ): Promise<void> {
    let decision;
    try {
      decision = await this.entitlements.mayUse(studentId, 'PREP_PASS', now);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ServiceUnavailableException('PREP_PASS_CHECK_UNAVAILABLE');
    }

    if (decision.allowed) return;

    const weekly = await this.weeklyModelltestNumber(now);
    if (modelltestNumber === weekly) return;

    throw new ForbiddenException({
      message: 'PREP_PASS_REQUIRED',
      messageKey: 'prepPassRequired',
      reason: decision.reason ?? 'NOT_HELD',
    });
  }

  async weeklyModelltestNumber(now: Date = new Date()): Promise<number> {
    const rows = await this.prisma.modelltest.findMany({
      where: { exam_only: false },
      orderBy: { number: 'asc' },
      select: { number: true },
    });

    if (rows.length === 0) {
      throw new NotFoundException('No training Modelltest available');
    }

    const { periodIndex } = getSevenDayPeriod(now);
    return rows[periodIndex % rows.length].number;
  }
}
