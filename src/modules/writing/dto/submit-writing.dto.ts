import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientAttemptId } from '../../student-activity/attempt-id.decorator';

function isGenericFormularSubmit(dto: SubmitWritingDto): boolean {
  return (
    typeof dto.teil_id === 'string' &&
    dto.teil_id.length > 0 &&
    typeof dto.modelltestNumber === 'number' &&
    dto.modelltestNumber >= 1 &&
    dto.answers != null &&
    typeof dto.answers === 'object'
  );
}

export class SubmitWritingDto {
  @ApiProperty({
    description:
      'UUID of the writing exercise (B1/B2 row id, or A1/A2 section id from GET /api/writing/exercise)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsNotEmpty({ message: 'exerciseId is required' })
  @IsString()
  exerciseId: string;

  @ApiPropertyOptional({
    description: "The student's written text (B1/B2 letter). Omit for A1/A2 FORMULAR.",
    example: 'Sehr geehrte Damen und Herren, ich schreibe Ihnen bezüglich...',
    minLength: 1,
  })
  @ValidateIf((dto) => !isGenericFormularSubmit(dto))
  @IsNotEmpty({ message: 'content is required' })
  @IsString()
  @MinLength(1, { message: 'content must not be empty' })
  content?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @ValidateIf((dto) => isGenericFormularSubmit(dto))
  @IsInt()
  @Min(1)
  modelltestNumber?: number;

  @ApiPropertyOptional({
    description: 'Schreiben Teil id (`"1"`, `"2"`) for A1/A2 FORMULAR submit',
    example: '1',
  })
  @ValidateIf((dto) => isGenericFormularSubmit(dto))
  @IsString()
  teil_id?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'A1/A2 FORMULAR: itemNumber (string) → answer value',
  })
  @ValidateIf((dto) => isGenericFormularSubmit(dto))
  @IsObject()
  answers?: Record<string, unknown>;

  @ClientAttemptId()
  attemptId?: string;

  @ApiPropertyOptional({ example: 540, description: 'Time spent, in seconds.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;
}

export { isGenericFormularSubmit };
