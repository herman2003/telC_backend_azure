import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_SEATS_TOTAL } from '../pricing.service';

/**
 * The seats to pay for. A total, not an increment — the same shape the quote
 * endpoint takes, so a center pays for exactly what it was quoted.
 *
 * The idempotency key travels as a header rather than a field, following the
 * convention every payment API uses: it is part of how the request is made
 * rather than part of what is being bought.
 */
export class CreatePaymentDto {
  @ApiProperty({ minimum: 1, maximum: MAX_SEATS_TOTAL, example: 10 })
  @IsInt()
  @Min(1)
  @Max(MAX_SEATS_TOTAL)
  seats: number;
}

/**
 * Which payment method to open at checkout.
 *
 * `notchpay` — Orange Money / MTN Mobile Money (via Notch Collect).
 * `stripe` — card.
 * They are different methods; both can be configured on the server at once.
 */
export class StartCheckoutDto {
  @ApiProperty({
    enum: ['notchpay', 'stripe'],
    example: 'notchpay',
    description:
      'notchpay = Mobile Money (Orange / MTN). stripe = card. Required.',
  })
  @IsIn(['notchpay', 'stripe'])
  provider: 'notchpay' | 'stripe';
}

export class PaymentResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;

  @ApiProperty({ example: 10 }) seats: number;

  @ApiProperty({
    example: 4500,
    description:
      'The price per seat that applied when this payment was created, so an old invoice stays truthful after the list price moves.',
  })
  unitPriceXaf: number;
  @ApiProperty({ example: 92500 }) amountXaf: number;

  @ApiProperty({
    enum: ['PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED'],
    example: 'PENDING',
    description:
      'Always PENDING today. Only a verified provider event may advance it, and that arrives in Phase 7 — a payment record grants nothing on its own.',
  })
  status: string;

  @ApiProperty({ format: 'date-time' }) createdAt: Date;
}

/**
 * Where to send the center to pay.
 *
 * The provider's own transaction reference is deliberately absent. A client
 * needs somewhere to go, not an identifier it has no use for.
 */
export class CheckoutSessionResponseDto {
  @ApiProperty({ format: 'uuid' }) paymentId: string;

  @ApiProperty({
    example: 'https://checkout.fake-payments.invalid/fake_2f1c',
    description:
      'Redirect the center here. Calling checkout again for the same payment returns the same URL rather than opening a second provider transaction.',
  })
  checkoutUrl: string;

  @ApiProperty({
    enum: ['notchpay', 'stripe'],
    example: 'notchpay',
    description: 'Payment method that opened this checkout.',
  })
  provider: string;
}

export class ListPaymentsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  // Capped for the same reason the student roster is: a dashboard refresh must
  // not be able to turn into an unbounded query.
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class PaymentPageDto {
  @ApiProperty({ type: [PaymentResponseDto] }) payments: PaymentResponseDto[];
  @ApiProperty({ example: 1 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) pageSize: number;
}
