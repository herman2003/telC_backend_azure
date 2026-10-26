import type { Prisma } from '@prisma/client';
import { utcDayStart } from './services/entitlement-spend.service';

/**
 * Marker on training FORMULAR auto-scores (`corrections.kind`). Those rows
 * must not consume Start's free AI Schreiben corrections.
 */
export const FORMULAR_AUTO_CORRECTION_KIND = 'FORMULAR_AUTO' as const;

/**
 * Training Schreiben attempts that count toward the free AI quota (UTC day):
 * in-flight letter AI (`pending`) and completed letters that received AI
 * feedback. A1/A2 FORMULAR auto-scores are excluded (no `feedback`).
 */
export function trainingAiSchreibenUsedWhere(
  studentId: string,
  now: Date,
): Prisma.WritingAttemptWhereInput {
  return {
    student_id: studentId,
    exam_attempt_id: null,
    created_at: { gte: utcDayStart(now) },
    OR: [
      { status: 'pending' },
      {
        status: 'completed',
        feedback: { not: null },
      },
    ],
  };
}
