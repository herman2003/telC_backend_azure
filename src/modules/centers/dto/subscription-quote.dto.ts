import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({ example: 10, description: 'Seats this quote covers.' })
  seats: number;

  @ApiProperty({
    example: 4500,
    description:
      "What this center pays per seat: its own stamped price if it already holds seats, otherwise today's list price. Never read from the request.",
  })
  unitPriceXaf: number;

  @ApiProperty({ example: 45000, description: 'seats × unitPriceXaf.' })
  totalXaf: number;
}
