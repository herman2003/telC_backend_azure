import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { MAX_SEATS_TOTAL } from '../pricing.service';

/**
 * The seats a center wants.
 *
 * THE NUMBER IS A TOTAL, not an increment. A center holding ten seats that
 * wants five more sends fifteen. That is also why the server can compare it
 * directly against the students it already has.
 *
 * The global pipe runs with `forbidNonWhitelisted`, so a price, a total, a
 * currency or another center's id is refused rather than ignored. That refusal
 * is the security boundary of the whole phase: quietly dropping an `amount`
 * would leave a client believing it had set the price.
 */
export class SubscriptionQuoteRequestDto {
  @ApiProperty({
    minimum: 1,
    maximum: MAX_SEATS_TOTAL,
    example: 10,
    description: 'Total seats to hold, at least the contract minimum.',
  })
  @IsInt()
  @Min(1)
  @Max(MAX_SEATS_TOTAL)
  seats: number;
}

export class SubscriptionQuoteResponseDto {
  @ApiProperty({ example: 10, description: 'Total seats requested (not an increment).' })
  seats: number;

  @ApiProperty({
    example: 4500,
    description:
      "What this center pays per seat HT: its own stamped price if it already holds paid seats, otherwise today's list price. Never read from the request.",
  })
  unitPriceXaf: number;

  @ApiProperty({
    example: 53100,
    description:
      'TTC amount due now. Full pack on first purchase / renewal; day-prorata on mid-period additions (same figure create-payment charges).',
  })
  totalXaf: number;

  @ApiProperty({
    example: 6,
    description:
      'Seats this charge covers: the whole pack, or only seats being added mid-period.',
  })
  billableSeats: number;

  @ApiProperty({
    enum: ['full_pack', 'mid_period_addition'],
    example: 'mid_period_addition',
  })
  billingKind: 'full_pack' | 'mid_period_addition';

  @ApiPropertyOptional({
    nullable: true,
    example: 27,
    description: 'Douala whole days left in the period (mid-period additions only).',
  })
  daysLeft: number | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 31,
    description: 'Douala whole days in the open period (mid-period additions only).',
  })
  daysInPeriod: number | null;

  @ApiProperty({
    example: 23600,
    description: 'HT amount due now (before 18% VAT).',
  })
  amountHtXaf: number;
}
