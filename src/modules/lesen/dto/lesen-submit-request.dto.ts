import {
  IsString,
  IsInt,
  Min,
  Max,
  IsObject,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientAttemptId } from '../../student-activity/attempt-id.decorator';

export class LesenSubmitRequestDto {
  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  modelltestNumber?: number;

  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  exercise_type_id!: string;

  @ApiProperty()
  @IsString()
  teil_id!: string;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    deprecated: true,
    description: 'Ignored; score is calculated by the backend',
  })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  score_percent?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  remark?: string;

  @ApiProperty()
  @IsString()
  tested_at!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'B1/B2: string answers per question id. A1/A2: itemNumber → value by aufgabentyp (may be boolean for Richtig/Falsch).',
  })
  @IsObject()
  answers!: Record<string, unknown>;

  @ClientAttemptId()
  attemptId?: string;

  @ApiPropertyOptional({ example: 540, description: 'Time spent, in seconds.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;
}

export class LesenSubmitResponseDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The stored attempt: the id the app sent, or a new one. Absent for a guest, whose attempts are not kept.',
  })
  attemptId?: string;

  @ApiProperty()
  score!: number;

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

  @ApiPropertyOptional({
    description:
      'A1/A2 Training: authored Corrigé packages keyed by item number ("1"). See docs/contracts/training-correction-package.md',
  })
  correction?: Record<string, Record<string, unknown>>;
}
