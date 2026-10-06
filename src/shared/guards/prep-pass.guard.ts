import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EntitlementSpendService } from '../services/entitlement-spend.service';

interface PrepPassRequest {
  student?: { studentId?: string; isGuest?: boolean };
}

/**
 * Training library gate for Prep Pass (Hören / Lesen / Sprachbausteine /
 * Modelltest catalogue).
 *
 * Runs after JwtAuthGuard. Guests are refused — Prep Pass is a paid seat
 * product. A student without an active pass gets `prepPassRequired` so the
 * app can upsell.
 */
@Injectable()
export class PrepPassGuard implements CanActivate {
  constructor(private readonly entitlements: EntitlementSpendService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PrepPassRequest>();
    const studentId = request.student?.studentId;

    if (!studentId || request.student?.isGuest === true) {
      throw new ForbiddenException({
        message: 'PREP_PASS_REQUIRED',
        messageKey: 'prepPassRequired',
      });
    }

    try {
      const decision = await this.entitlements.mayUse(studentId, 'PREP_PASS');
      if (decision.allowed) return true;

      throw new ForbiddenException({
        message: 'PREP_PASS_REQUIRED',
        messageKey: 'prepPassRequired',
        reason: decision.reason,
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ServiceUnavailableException('PREP_PASS_CHECK_UNAVAILABLE');
    }
  }
}
