import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { PaymentStatus } from '@prisma/client';
import { MAX_EXAM_SLOTS_PER_ORDER } from '../exam-slots.service';

export class PurchaseExamSlotsDto {
  @ApiProperty({
    example: 10,
    minimum: 1,
    maximum: MAX_EXAM_SLOTS_PER_ORDER,
    description:
      'How many candidates to buy exam places for. There is no minimum: a sitting for three is an ordinary thing a school does.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_EXAM_SLOTS_PER_ORDER)
  quantity: number;
}

export class ExamSlotBalanceDto {
  @ApiProperty({
    example: 7,
    description: 'Bought and not yet spent. One goes per candidate at publish.',
  })
  slotsRemaining: number;
}

export class ExamSlotPaymentDto {
  @ApiProperty() id: string;

  @ApiProperty({
    example: 'EXAM_SLOTS',
    description:
      'What the payment bought. Slots share the payments table with seats, so an invoice list reads this to tell them apart.',
  })
  kind: 'EXAM_SLOTS';

  @ApiProperty({ example: 10 }) quantity: number;
  @ApiProperty({ example: 1000 }) unitPriceXaf: number;
  @ApiProperty({ example: 10000 }) amountXaf: number;

  @ApiProperty({
    enum: PaymentStatus,
    description: 'PENDING until a verified provider event says otherwise.',
  })
  status: PaymentStatus;

  @ApiProperty() createdAt: Date;
}
