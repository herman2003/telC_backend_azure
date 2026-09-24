import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CenterAccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { RateLimitService } from '../../shared/services/rate-limit.service';
import { CenterExceptionFilter } from './center-exception.filter';
import { CurrentCenterUser } from './decorators/current-center-user.decorator';
import { CenterAuthGuard } from './guards/center-auth.guard';
import { CenterErrorResponseDto } from './dto/center-error-response.dto';
import { ExamSlotsService } from './exam-slots.service';
import {
  ExamSlotBalanceDto,
  ExamSlotPaymentDto,
  PurchaseExamSlotsDto,
} from './dto/exam-slots.dto';

/** Long enough for a uuid and then some; anything longer is a client bug. */
const MAX_IDEMPOTENCY_KEY_LENGTH = 200;

/**
 * Buying the right to run exams.
 *
 * There is no checkout route here. A slot purchase is an ordinary payment, so
 * it is opened at `POST /api/payments/:paymentId/checkout` like any other —
 * which is the point of putting slots on the payments table rather than
 * giving them their own.
 */
@ApiTags('Center Exam Slots')
@ApiBearerAuth()
@Controller('api/centers/me/exam-slots')
@UseFilters(CenterExceptionFilter)
@UseGuards(CenterAuthGuard)
export class ExamSlotsController {
  constructor(
    private readonly slots: ExamSlotsService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'How many exam slots this center holds',
    description:
      'One is spent per candidate when a sitting is published. Publishing is refused when the balance would not cover every candidate.',
  })
  @ApiOkResponse({ type: ExamSlotBalanceDto })
  @ApiUnauthorizedResponse({ type: CenterErrorResponseDto })
  async balance(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
  ): Promise<ExamSlotBalanceDto> {
    return { slotsRemaining: await this.slots.balance(user) };
  }

  @Post('purchase')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record an intent to buy exam slots',
    description:
      'Creates a PENDING payment at 1,000 XAF a candidate, with no minimum. It grants nothing: only a verified provider event credits the balance. Open it at POST /api/payments/{paymentId}/checkout, exactly as for seats.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'A value unique to this attempt, such as a uuid. Retrying with it is safe; reusing it for a different quantity, or for a seat purchase, is refused.',
  })
  @ApiCreatedResponse({ type: ExamSlotPaymentDto })
  @ApiBadRequestResponse({ type: CenterErrorResponseDto })
  @ApiConflictResponse({ type: CenterErrorResponseDto })
  async purchase(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Body() dto: PurchaseExamSlotsDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ExamSlotPaymentDto> {
    // The same limiter as seats, keyed on the center: the idempotency index
    // stops duplicates of one intent, and nothing stops a flood of distinct
    // ones, because a fresh key is a fresh payment by design.
    await this.rateLimitService.checkPaymentCreateLimit(user.centerId);

    return this.slots.purchase(
      user,
      dto.quantity,
      this.requireIdempotencyKey(idempotencyKey),
    );
  }

  private requireIdempotencyKey(raw?: string): string {
    const key = raw?.trim();

    if (!key || key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');
    }

    return key;
  }
}
