import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { EntitlementProduct } from '@prisma/client';
import type { CenterAccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { CenterExceptionFilter } from './center-exception.filter';
import { CurrentCenterUser } from './decorators/current-center-user.decorator';
import { CenterAuthGuard } from './guards/center-auth.guard';
import { CenterErrorResponseDto } from './dto/center-error-response.dto';
import { RateLimitService } from '../../shared/services/rate-limit.service';
import { EntitlementPurchaseService } from './entitlement-purchase.service';
import { EntitlementsService } from './entitlements.service';
import {
  CappedCodesPageDto,
  CappedCodesQueryDto,
  EntitlementPaymentDto,
  EntitlementsOverviewDto,
  GrantedPeriodDto,
  PurchaseEntitlementsDto,
  SetCapDto,
} from './dto/entitlements.dto';

/** Long enough for a uuid and then some; anything longer is a client bug. */
const MAX_IDEMPOTENCY_KEY_LENGTH = 200;

const PRODUCTS = new Set<string>(Object.values(EntitlementProduct));

/**
 * The add-ons a center holds, and who it lets draw on them.
 *
 * No checkout route here, for the same reason there is none on exam slots: an
 * add-on purchase is an ordinary payment, opened at
 * `POST /api/payments/:paymentId/checkout` like everything else.
 *
 * Every route addresses an **activation code**, not a student. A code exists
 * before anybody holds it, so a center can buy ahead, and a seat that changes
 * hands carries what was bought for it (ADR 0002). The dashboard shows names.
 */
@ApiTags('Center Entitlements')
@ApiBearerAuth()
@Controller('api/centers/me')
@UseFilters(CenterExceptionFilter)
@UseGuards(CenterAuthGuard)
export class EntitlementsController {
  constructor(
    private readonly entitlements: EntitlementsService,
    private readonly purchases: EntitlementPurchaseService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Get('entitlements')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'What this center holds',
    description:
      'Every pool with its balance, every seat with a cap, and how many seats hold a live period. `frozen` is true when Start has lapsed: nothing is lost, nothing is spendable, and paying restores it.',
  })
  @ApiOkResponse({ type: EntitlementsOverviewDto })
  @ApiUnauthorizedResponse({ type: CenterErrorResponseDto })
  overview(@CurrentCenterUser() user: CenterAccessTokenPayload) {
    return this.entitlements.overview(user);
  }

  @Get('entitlements/:product/codes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Which seats may draw on this pool',
    description:
      'Paged, because a school’s seat count is not bounded by anything this API controls and an unbounded list is a slow page waiting for its first big customer. Seats stopped at zero are included: that is the row a manager comes here to raise again.',
  })
  @ApiParam({ name: 'product', enum: EntitlementProduct })
  @ApiOkResponse({ type: CappedCodesPageDto })
  @ApiUnauthorizedResponse({ type: CenterErrorResponseDto })
  cappedCodes(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('product') product: string,
    @Query() query: CappedCodesQueryDto,
  ) {
    return this.entitlements.cappedCodes(
      user,
      this.requireProduct(product),
      query,
    );
  }

  @Post('entitlements/purchase')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Buy an add-on',
    description:
      'Records the intention and grants nothing: only a verified provider event credits the pool. Open it at POST /api/payments/{paymentId}/checkout, exactly as for seats and exam slots. Picking seats here is optional \u2014 a center may top the pool up now and decide who draws on it later.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'A value unique to this attempt, such as a uuid. Retrying with it is safe; reusing it for a different product, quantity or set of seats is refused, because all three are part of what was agreed.',
  })
  @ApiCreatedResponse({ type: EntitlementPaymentDto })
  @ApiBadRequestResponse({ type: CenterErrorResponseDto })
  @ApiConflictResponse({
    description: 'IDEMPOTENCY_KEY_REUSED',
    type: CenterErrorResponseDto,
  })
  async purchase(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Body() dto: PurchaseEntitlementsDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    // The same limiter as seats and exam slots, keyed on the center: the
    // idempotency index stops duplicates of one intent, and nothing stops a
    // flood of distinct ones, because a fresh key is a fresh payment by
    // design.
    await this.rateLimitService.checkPaymentCreateLimit(user.centerId);

    return this.purchases.purchase(
      user,
      this.requireIdempotencyKey(idempotencyKey),
      {
        product: dto.product,
        quantity: dto.quantity,
        codeIds: dto.codeIds,
        capPerCode: dto.capPerCode,
      },
    );
  }

  @Put('codes/:codeId/entitlements/:product')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign credits to a seat, or give it a period',
    description:
      'For AI_SPEAKING_CREDIT this sets assigned remaining on the seat and moves the delta from/to the unallocated school pool (typing 12 means twelve). For PREP_PASS and AI_ASSISTED_LEARNING it takes one from the pool and grants the period, counted from now.',
  })
  @ApiParam({ name: 'product', enum: EntitlementProduct })
  @ApiBadRequestResponse({
    description: 'NOT_ENOUGH_ENTITLEMENTS, PRODUCT_HAS_NO_CAP',
    type: CenterErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'CODE_NOT_IN_CENTER',
    type: CenterErrorResponseDto,
  })
  assign(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('codeId', ParseUUIDPipe) codeId: string,
    @Param('product') product: string,
    @Body() dto: SetCapDto,
  ) {
    const chosen = this.requireProduct(product);

    // Which of the two this means is decided by the product, not by the
    // caller: a cap on a Prep Pass and a period of credits are both nonsense,
    // and letting a client ask for either would mean answering nonsense.
    return chosen === 'AI_SPEAKING_CREDIT'
      ? this.entitlements.setCap(user, codeId, chosen, dto.cap)
      : this.entitlements.grantPeriod(user, codeId, chosen);
  }

  @Delete('codes/:codeId/entitlements/:product')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Return unused AI Speaking credits to the school pool',
    description:
      'For AI_SPEAKING_CREDIT, unused assigned credits go back to unallocated stock and the seat is cleared. Never a card refund and never a period cut short: a student keeps the sixty days their center bought them, and already-spent sessions stay spent.',
  })
  @ApiParam({ name: 'product', enum: EntitlementProduct })
  @ApiNotFoundResponse({
    description: 'CODE_NOT_IN_CENTER',
    type: CenterErrorResponseDto,
  })
  revoke(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('codeId', ParseUUIDPipe) codeId: string,
    @Param('product') product: string,
  ) {
    return this.entitlements.revoke(user, codeId, this.requireProduct(product));
  }

  private requireIdempotencyKey(raw?: string): string {
    const key = raw?.trim();

    if (!key || key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');
    }

    return key;
  }

  /** A path parameter is a string until something checks it. */
  private requireProduct(product: string): EntitlementProduct {
    if (!PRODUCTS.has(product)) {
      throw new BadRequestException('UNKNOWN_PRODUCT');
    }
    return product as EntitlementProduct;
  }
}

export type { GrantedPeriodDto };
