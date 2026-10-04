import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

const CENTER_ERROR_MESSAGES: Record<string, string> = {
  CENTER_SESSION_CREATION_FAILED:
    'Unable to start a session. Please try again.',
  CENTER_SESSION_RETRY_EXHAUSTED:
    'Authentication is temporarily unavailable. Please try again.',
  CENTER_SESSION_EXPIRED: 'This session has expired. Please log in again.',
  CENTER_SESSION_REVOKED:
    'This session is no longer valid. Please log in again.',
  VERIFICATION_TOKEN_EXPIRED:
    'That verification link has expired. Register again to receive a new one.',
  VERIFICATION_TOKEN_INVALID:
    'That verification link is not valid or has already been used.',
  RESET_CODE_EXPIRED: 'That reset code has expired. Request a new one.',
  RESET_CODE_INVALID: 'That reset code is not valid.',
  EMAIL_DELIVERY_FAILED: 'Verification email delivery failed.',
  INVALID_CENTER_REFRESH_TOKEN:
    'This session is no longer valid. Please log in again.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',
  EXAM_SESSION_NOT_FOUND: 'That exam session does not exist.',
  MODELLTEST_NOT_FOUND: 'That Modelltest does not exist.',
  OPENS_AT_IN_PAST: 'The opening time must be in the future.',
  ACCESS_WINDOW_INVALID: 'The access window must be 24, 48 or 72 hours.',
  EXAM_ALREADY_OPEN:
    'This exam has already opened and can no longer be changed.',
  EXAM_ALREADY_PUBLISHED: 'This exam has already been published.',
  EXAM_NOT_PUBLISHED: 'This exam has not been published yet.',
  EXAM_NOT_CLOSED:
    'Only a closed exam can be reopened. Change its closing time instead.',
  EXAM_CANCELLED: 'This exam was cancelled.',
  NO_PARTICIPANTS: 'Choose at least one participant before publishing.',
  NOT_ENOUGH_EXAM_SLOTS:
    'You do not have enough exam slots for every participant.',
  EXAM_SLOTS_REQUIRED: 'Buy an exam place before choosing a Modelltest.',
  STUDENT_NOT_IN_CENTER:
    'One of those students does not belong to your center.',
};

@Catch()
export class CenterExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CenterExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      const errorName =
        exception instanceof Error ? exception.name : 'UnknownError';
      this.logger.error(
        `Unexpected error while handling a center request (${errorName})`,
      );
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Unexpected error',
      });
      return;
    }

    const status = exception.getStatus();
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      response.status(status).json({
        error: payload,
        message: CENTER_ERROR_MESSAGES[payload] || payload,
      });
      return;
    }

    if (typeof payload === 'object' && payload !== null) {
      const body = payload as Record<string, unknown>;
      if (Array.isArray(body.message)) {
        response.status(status).json({
          error: 'VALIDATION_ERROR',
          message: body.message,
        });
        return;
      }

      if (typeof body.message === 'string') {
        const code = body.message;

        // Extras are carried through, not discarded. A refusal is only useful
        // if the detail that makes it actionable survives the rewrite:
        // `requiredSeatsTotal` is the number a center must send next, and
        // `subscriptionStatus` is what lets a dashboard say which state to
        // fix. Rebuilding the body from `message` alone silently dropped both.
        //
        // Nest's own `statusCode` and `error` are removed rather than echoed,
        // so a response never carries two different values for `error`.
        const extra = { ...body };
        delete extra.message;
        delete extra.statusCode;
        delete extra.error;

        response.status(status).json({
          error: code,
          message: CENTER_ERROR_MESSAGES[code] || code,
          ...extra,
        });
        return;
      }
    }

    response.status(status).json({
      error: 'REQUEST_FAILED',
      message: 'Request failed',
    });
  }
}
