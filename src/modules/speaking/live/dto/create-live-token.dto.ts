import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Start an Elena live session in one of two modes:
 *
 * - **Exam (Start Sprechen Modul):** `teilNumber` (+ optional modelltest)
 * - **Mit Elena (credits):** `topicId` from the Lerniqo catalogue
 *
 * Exactly one mode per request. The client never sends prompt text.
 */
export class CreateLiveTokenDto {
  @ApiPropertyOptional({
    example: 2,
    enum: [1, 2, 3],
    description: 'Exam path: which Teil. Omit when using topicId.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  teilNumber?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Modelltest for the exam path. Defaults to 1. Ignored for topicId.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  modelltest?: number;

  @ApiPropertyOptional({
    example: 'b1-t2-001',
    description:
      'Mit Elena path: catalogue topic id from GET /api/speaking/elena-topics. Credits only.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  topicId?: string;
}
