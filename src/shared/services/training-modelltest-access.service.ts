import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { CefrLevel } from '@prisma/client';
import { getSevenDayPeriod } from '../../modules/modelltests/seven-day-period';
import { PrismaService } from './prisma.service';
import { EntitlementSpendService } from './entitlement-spend.service';

/**
 * Start may train on the current weekly Modelltest; Prep Pass unlocks the
 * full training pool for the student's CEFR level. Guests are handled by
 * PrepPassGuard, not here.
 *
 * Option A: every training MT access requires modelltest.level === student.level.
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

  /**
   * School seats must have a CEFR level (from the activation code or center).
   * Guests never call this — they skip the CEFR gate in Phase 1.
   */
  async requireStudentLevel(studentId: string): Promise<CefrLevel> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { level: true },
    });
    if (!student?.level) {
      throw new ForbiddenException({
        message: 'LEVEL_REQUIRED',
        messageKey: 'levelRequired',
      });
    }
    return student.level;
  }

  /**
   * Ensures the named training Modelltest matches the student's level.
   * Call even when Prep Pass is active (Prep Pass must not skip CEFR).
   */
  async assertLevelAllows(
    studentId: string,
    modelltestNumber: number,
  ): Promise<void> {
    const level = await this.requireStudentLevel(studentId);
    const mt = await this.prisma.modelltest.findFirst({
      where: { number: modelltestNumber, exam_only: false },
      select: { level: true },
    });
    if (!mt || mt.level !== level) {
      throw new ForbiddenException({
        message: 'LEVEL_MISMATCH',
        messageKey: 'levelMismatch',
      });
    }
  }

  async assertMayAccess(
    studentId: string,
    modelltestNumber: number,
    now: Date = new Date(),
  ): Promise<void> {
    // CEFR first — Prep Pass only widens how many MT of that level are open.
    await this.assertLevelAllows(studentId, modelltestNumber);

    let decision;
    try {
      decision = await this.entitlements.mayUse(studentId, 'PREP_PASS', now);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ServiceUnavailableException('PREP_PASS_CHECK_UNAVAILABLE');
    }

    if (decision.allowed) return;

    const weekly = await this.weeklyModelltestNumber(studentId, now);
    if (modelltestNumber === weekly) return;

    throw new ForbiddenException({
      message: 'PREP_PASS_REQUIRED',
      messageKey: 'prepPassRequired',
      reason: decision.reason ?? 'NOT_HELD',
    });
  }

  /**
   * Weekly rotation within the student's CEFR training pool.
   * Guests: pass `opts.isGuest: true` to use the unscoped training pool.
   */
  async weeklyModelltestNumber(
    studentId: string,
    now: Date = new Date(),
    opts: { isGuest?: boolean } = {},
  ): Promise<number> {
    const where =
      opts.isGuest === true
        ? { exam_only: false }
        : {
            exam_only: false,
            level: await this.requireStudentLevel(studentId),
          };

    const rows = await this.prisma.modelltest.findMany({
      where,
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
