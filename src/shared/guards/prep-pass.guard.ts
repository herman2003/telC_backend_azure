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
 * Training library gate: Prep Pass unlocks the full pool for the student's
 * CEFR level; Start alone may reach the current weekly Modelltest of that
 * level. Guests pass through — the demo JWT contract already promises
 * Reading / Listening / Sprachbausteine without a seat.
 *
 * When the request names a Modelltest, CEFR is checked even if Prep Pass is
 * active (Option A: pass must not skip level).
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
      const modelltestNumber = extractModelltestNumber(request);

      // Named MT: always enforce CEFR (and Prep Pass / weekly when needed).
      if (modelltestNumber !== null) {
        await this.access.assertMayAccess(studentId, modelltestNumber);
        return true;
      }

      // List / sessions with no MT number: Prep Pass or Start may proceed;
      // handlers that default to a MT must still call the access service.
      if (await this.access.isPrepPassActive(studentId)) {
        return true;
      }

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
