import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { EntitlementsService } from './entitlements.service';
import {
  EntitlementsOverviewDto,
  GrantedPeriodDto,
  SetCapDto,
} from './dto/entitlements.dto';

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
  constructor(private readonly entitlements: EntitlementsService) {}

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

  @Put('codes/:codeId/entitlements/:product')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Let one seat draw on the pool, or give it a period',
    description:
      'For AI_SPEAKING_CREDIT this sets the cap and spends nothing — the pool is spent when a session runs, and the number replaces whatever was there because a manager typing 12 means twelve. For PREP_PASS and AI_ASSISTED_LEARNING it takes one from the pool and grants the period, counted from now.',
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
    summary: 'Stop a seat drawing on the pool',
    description:
      'Sets the cap to zero. Never a refund and never a period cut short: a student keeps the sixty days their center bought them, and their already-spent sessions stay spent. What this stops is the next one.',
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

  /** A path parameter is a string until something checks it. */
  private requireProduct(product: string): EntitlementProduct {
    if (!PRODUCTS.has(product)) {
      throw new BadRequestException('UNKNOWN_PRODUCT');
    }
    return product as EntitlementProduct;
  }
}

export type { GrantedPeriodDto };
