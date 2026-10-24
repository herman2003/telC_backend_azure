import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientAttemptId } from '../../student-activity/attempt-id.decorator';

export class SubmitListeningDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  modelltestNumber?: number;

  @ApiProperty({
    description: 'Teil id — must match the type used in GET /exercise',
    example: '1',
    enum: ['1', '2', '3'],
  })
  @IsNotEmpty({ message: 'type is required' })
  @IsString()
  type: string;

  @ApiProperty({
    description:
      'true = the attempt was taken under time pressure, false = practice. ' +
      'Recorded on the attempt only. It does NOT suppress the answer key: ' +
      'the response carries answerKey either way.',
    example: false,
  })
  @IsBoolean()
  timed: boolean;

  @ApiProperty({
    description: 'Must match the content_revision returned by GET /exercise',
    example: 'modelltest-1-teil-1-v1',
  })
  @IsNotEmpty({ message: 'content_revision is required' })
  @IsString()
  content_revision: string;

  @ApiProperty({
    description:
      'B1/B2: question id → "+" / "−". A1/A2: itemNumber (string) → value by aufgabentyp. At least one entry required.',
    example: { q41: '+', q42: '+', q43: '-', q44: '+', q45: '-' },
  })
  @IsObject({ message: 'answers must be an object' })
  answers: Record<string, unknown>;

  @ClientAttemptId()
  attemptId?: string;

  @ApiPropertyOptional({ example: 540, description: 'Time spent, in seconds.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;
}
