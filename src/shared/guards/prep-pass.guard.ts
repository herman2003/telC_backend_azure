import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TrainingModelltestAccessService } from '../services/training-modelltest-access.service';

interface PrepPassRequest {
  student?: { studentId?: string; isGuest?: boolean };
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
}

/**
 * Training library gate: Prep Pass unlocks the full pool; Start alone may
 * reach the current weekly Modelltest (Hören / Lesen / Sprachbausteine /
 * catalogue). Guests pass through — the demo JWT contract already promises
 * Reading / Listening / Sprachbausteine without a seat.
 *
 * When the request does not name a Modelltest (list/sessions), Start may
 * proceed; handlers that default content to MT 1 must still pass that number
 * (or call the access service) so non-weekly defaults stay blocked.
 */
@Injectable()
export class PrepPassGuard implements CanActivate {
  constructor(private readonly access: TrainingModelltestAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PrepPassRequest>();
    const studentId = request.student?.studentId;

    if (request.student?.isGuest === true) {
      return true;
    }

    if (!studentId) {
      throw new ForbiddenException({
        message: 'PREP_PASS_REQUIRED',
        messageKey: 'prepPassRequired',
      });
    }

    try {
      if (await this.access.isPrepPassActive(studentId)) {
        return true;
      }

      const modelltestNumber = extractModelltestNumber(request);
      if (modelltestNumber === null) {
        return true;
      }

      await this.access.assertMayAccess(studentId, modelltestNumber);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new ServiceUnavailableException('PREP_PASS_CHECK_UNAVAILABLE');
    }
  }
}

function extractModelltestNumber(request: PrepPassRequest): number | null {
  const raw =
    request.query?.modelltest ??
    request.body?.modelltestNumber ??
    request.params?.number;

  if (raw === undefined || raw === null || raw === '') {
    return null;
  }

  const n = typeof raw === 'number' ? raw : Number(String(raw));
  if (!Number.isInteger(n) || n < 1) {
    return null;
  }
  return n;
}
