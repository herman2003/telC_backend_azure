import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { EntitlementProduct } from '@prisma/client';

/**
 * Deliberately generous, and deliberately bounded.
 *
 * A cap is a ceiling a manager types, so there is no natural maximum — but an
 * unbounded integer in a request body is how a fat finger becomes a bill.
 */
const MAX_CAP = 10_000;

export class SetCapDto {
  @ApiProperty({
    example: 12,
    minimum: 0,
    maximum: MAX_CAP,
    description:
      'How much of the pool this seat may draw, in total. Not per month — nothing resets it. Zero is legal and is how a student is stopped; their already-spent sessions stay spent.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_CAP)
  cap: number;
}

export class PoolDto {
  @ApiProperty({ enum: EntitlementProduct }) product: EntitlementProduct;
  @ApiProperty({ example: 140 }) balance: number;

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
  @ApiProperty({ example: 12 }) cap: number;
  @ApiProperty({ example: 6 }) used: number;
}

export class AssignedDto {
  @ApiProperty({ enum: EntitlementProduct }) product: EntitlementProduct;
  @ApiProperty({ example: 14, description: 'Seats holding a live period.' })
  seats: number;
}

export class EntitlementsOverviewDto {
  @ApiProperty({ type: [PoolDto] }) pools: PoolDto[];
  @ApiProperty({ type: [CapDto] }) caps: CapDto[];
  @ApiProperty({ type: [AssignedDto] }) assigned: AssignedDto[];
}

export class GrantedPeriodDto {
  @ApiProperty({ enum: EntitlementProduct }) product: EntitlementProduct;

  @ApiProperty({
    description:
      'Counted from now, not from when the pass was bought. A center that buys twenty in September and hands one out in November gives that student sixty days from November.',
  })
  expiresAt: Date;
}
