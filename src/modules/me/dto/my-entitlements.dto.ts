import { ApiProperty } from '@nestjs/swagger';

export class HeldPeriodDto {
  @ApiProperty({ description: 'Whether it is held and has not run out.' })
  active: boolean;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  expiresAt: Date | null;
}

export class AiSpeakingEntitlementDto {
  @ApiProperty({
    example: 3,
    description:
      'Free Elena sessions left this calendar month. Start includes five, and they are always spent before any credit.',
  })
  freeRemaining: number;

  @ApiProperty({
    description:
      'When the free allowance comes back: the start of the next month, UTC.',
  })
  resetsAt: Date;

  @ApiProperty({
    example: 8,
    description:
      "The smaller of what the center has left and what is left of this seat's cap — what this student can actually spend, rather than two numbers for the app to reconcile.",
  })
  creditsAvailable: number;
}

export class MyEntitlementsDto {
  @ApiProperty({ type: HeldPeriodDto }) prepPass: HeldPeriodDto;
  @ApiProperty({ type: HeldPeriodDto }) aiAssisted: HeldPeriodDto;
  @ApiProperty({ type: AiSpeakingEntitlementDto })
  aiSpeaking: AiSpeakingEntitlementDto;

  @ApiProperty({
    description:
      "True when the center's Start subscription has lapsed. Nothing is lost and nothing is spendable; everything above is what comes back the moment it is paid. Worth saying plainly rather than showing zeroes.",
  })
  frozen: boolean;
}
