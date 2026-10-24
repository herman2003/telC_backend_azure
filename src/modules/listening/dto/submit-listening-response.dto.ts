import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitListeningResponseDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'The stored attempt: the id the app sent, or a new one when it sent none.',
  })
  attemptId: string;

  @ApiProperty({ description: 'Server-computed percentage score', example: 80 })
  score: number;

  @ApiPropertyOptional({
    description:
      'B1/B2: correct answer per question ("+" / "−"). Absent for A1/A2 — use outcomes/review.',
    example: { q41: '-', q42: '+', q43: '-', q44: '+', q45: '+' },
    additionalProperties: { type: 'string', enum: ['+', '-'] },
  })
  answerKey?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'A1/A2: per-item outcome from markGenericSection',
  })
  outcomes?: Array<{
    itemNumber: number;
    outcome: 'CORRECT' | 'WRONG' | 'UNRECOGNISED';
  }>;

  @ApiPropertyOptional({
    description:
      'A1/A2: key material for UNRECOGNISED free-text items (training self-check)',
  })
  review?: Array<{
    itemNumber: number;
    acceptedAnswers?: string[];
    solution?: unknown;
  }>;
}
