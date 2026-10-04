import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import { EntitlementProduct } from '@prisma/client';
import { MAX_ENTITLEMENTS_PER_ORDER } from '../entitlement-purchase.service';

/** Enough seats for a large school in one order. */
const MAX_CODES = 500;

/**
 * Deliberately generous, and deliberately bounded.
 *
 * Assigned remaining is what a manager types, so there is no natural maximum
 * — but an unbounded integer in a request body is how a fat finger becomes a
 * bill.
 */
const MAX_CAP = 10_000;

export class SetCapDto {
  @ApiProperty({
    example: 12,
    minimum: 0,
    maximum: MAX_CAP,
    description:
      'How many AI Speaking credits this seat holds (assigned remaining). Absolute: typing 12 moves the delta from/to the unallocated school pool. Zero returns unused credits to the pool; already-spent sessions stay spent.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_CAP)
  cap: number;
}

export class PurchaseEntitlementsDto {
  @ApiProperty({
    enum: EntitlementProduct,
    description:
      'Which add-on. Priced server-side: 300 XAF a credit, 3,000 a Prep Pass, 2,000 a month of AI Assisted Learning.',
  })
  @IsEnum(EntitlementProduct)
  product: EntitlementProduct;

  @ApiProperty({
    example: 40,
    minimum: 1,
    maximum: MAX_ENTITLEMENTS_PER_ORDER,
    description:
      'How many. Credits go into the unallocated school pool (then optionally onto seats via codeIds); passes and months are taken from the pool one at a time as they are handed out.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ENTITLEMENTS_PER_ORDER)
  quantity: number;

  @ApiPropertyOptional({
    type: [String],
    description:
      'The seats this is being bought for, as activation code ids. Optional: a center may top the unallocated pool now and assign later. Applied by the webhook, never at this request \u2014 nothing is granted before money moves.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(MAX_CODES)
  @IsUUID('4', { each: true })
  codeIds?: string[];

  @ApiPropertyOptional({
    example: 10,
    minimum: 1,
    description:
      'How many credits to assign to each chosen seat from this purchase. Required alongside codeIds; without it the pool is credited and nothing is assigned yet.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capPerCode?: number;
}

export class EntitlementPaymentDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: EntitlementProduct }) kind: EntitlementProduct;
  @ApiProperty({ example: 40 }) quantity: number;
  @ApiProperty({ example: 300 }) unitPriceXaf: number;
  @ApiProperty({ example: 12000 }) amountXaf: number;

  @ApiProperty({
    example: 'PENDING',
    description:
      'Always PENDING here. Only a verified provider event turns it into an entitlement.',
  })
  status: string;

  @ApiProperty() createdAt: Date;
}

export class PoolDto {
  @ApiProperty({ enum: EntitlementProduct }) product: EntitlementProduct;
  @ApiProperty({
    example: 140,
    description:
      'Unallocated stock for AI Speaking (not yet assigned to a seat). For period products, units waiting to be granted.',
  })
  balance: number;

  @ApiProperty({
    description:
      "True when the center's Start subscription has lapsed. Nothing is lost and nothing is spendable; paying restores exactly what is here. Worth saying out loud in the UI — it is the center's own money waiting for them.",
  })
  frozen: boolean;
}

export class CapDto {
  @ApiProperty() codeId: string;
  @ApiProperty({ example: 'LQ-4F2A-9C31' }) code: string;

  @ApiProperty({
    nullable: true,
    description:
      'Who held the code when they redeemed it, or null for one not handed out yet. A manager thinks in students; the row is stored against the seat.',
  })
  holder: string | null;

  @ApiProperty({ enum: EntitlementProduct }) product: EntitlementProduct;
  @ApiProperty({
    example: 12,
    description: 'Assigned remaining credits on this seat.',
  })
  cap: number;
  @ApiProperty({
    example: 6,
    description: 'Lifetime credits spent from this seat (reporting).',
  })
  used: number;
}

export class AssignedDto {
  @ApiProperty({ enum: EntitlementProduct }) product: EntitlementProduct;
  @ApiProperty({ example: 14, description: 'Seats holding a live period.' })
  seats: number;
}

export class CappedSummaryDto {
  @ApiProperty({ enum: EntitlementProduct }) product: EntitlementProduct;

  @ApiProperty({
    example: 14,
    description: 'How many seats currently hold assigned AI Speaking credits.',
  })
  seats: number;
}

export class EntitlementsOverviewDto {
  @ApiProperty({ type: [PoolDto] }) pools: PoolDto[];

  @ApiProperty({
    type: [CappedSummaryDto],
    description:
      'Counts, not the seats themselves. A center with five hundred codes would otherwise be sent fifteen hundred rows to render two numbers; the list is at GET /entitlements/{product}/codes.',
  })
  capped: CappedSummaryDto[];

  @ApiProperty({ type: [AssignedDto] }) assigned: AssignedDto[];
}

export class CappedCodesQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @ApiPropertyOptional({
    description: 'Matches the code itself or the name of whoever holds it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CappedCodesPageDto {
  @ApiProperty({ type: [CapDto] }) codes: CapDto[];
  @ApiProperty({ example: 137 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) pageSize: number;
}

export class GrantedPeriodDto {
  @ApiProperty({ enum: EntitlementProduct }) product: EntitlementProduct;

  @ApiProperty({
    description:
      'Counted from now, not from when the pass was bought. A center that buys twenty in September and hands one out in November gives that student sixty days from November.',
  })
  expiresAt: Date;
}
