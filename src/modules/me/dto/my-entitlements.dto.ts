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
      'Free Elena exam-Teil sessions left this calendar month. Start includes twelve (at most one free session per Teil per day), and they are always spent before any credit.',
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
      "Assigned remaining on this seat for AI Speaking credits — what this student can actually spend.",
  })
  creditsAvailable: number;
}

export class AiSchreibenEntitlementDto {
  @ApiProperty({
    example: 1,
    description:
      "Start's free training Schreiben AI corrections left today (UTC). Two per day, spent before any AI_SCHREIBEN_CREDIT.",
  })
  freeRemaining: number;

  @ApiProperty({
    description: 'When the free Schreiben allowance resets: next UTC midnight.',
  })
  resetsAt: Date;

  @ApiProperty({
    example: 4,
    description:
      'Assigned remaining AI_SCHREIBEN_CREDIT on this seat (after free two are used).',
  })
  creditsAvailable: number;
}

export class MyEntitlementsDto {
  @ApiProperty({ type: HeldPeriodDto }) prepPass: HeldPeriodDto;
  @ApiProperty({ type: HeldPeriodDto }) aiAssisted: HeldPeriodDto;
  @ApiProperty({ type: AiSpeakingEntitlementDto })
  aiSpeaking: AiSpeakingEntitlementDto;
  @ApiProperty({ type: AiSchreibenEntitlementDto })
  aiSchreiben: AiSchreibenEntitlementDto;

  @ApiProperty({
    description:
      "True when the center's Start subscription has lapsed. Nothing is lost and nothing is spendable; everything above is what comes back the moment it is paid. Worth saying plainly rather than showing zeroes.",
  })
  frozen: boolean;
}
