import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Skill } from '@prisma/client';
import { Trim } from './center-validation.decorators';

export class RecordExamMarkDto {
  @ApiProperty({
    enum: ['SCHREIBEN', 'SPRECHEN'],
    description:
      'Only these two. The rest were marked against an answer key, and a person overwriting one would make an exam negotiable.',
  })
  @IsIn(['SCHREIBEN', 'SPRECHEN'])
  skill: Skill;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teil: number;

  @ApiProperty({
    example: 32,
    description:
      "In telc's points for that Teil, which is what an examiner writes on the form — not a percentage.",
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  points: number;

  @ApiPropertyOptional({
    maxLength: 500,
    example: 'Oral on 12 Oct, examiner K. Mbarga',
    description: 'For the oral that happened in the center, days later.',
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ExamHalfDto {
  @ApiProperty({ example: 138 }) points: number;
  @ApiProperty({ example: 225 }) maxPoints: number;
  @ApiProperty({ example: 61, description: 'Shown, never decided on.' })
  percent: number;
  @ApiProperty({ description: 'At least 60% of this half.' }) passed: boolean;
}

export class ExamCandidateRowDto {
  @ApiProperty() studentId: string;
  @ApiProperty({ nullable: true }) attemptId: string | null;
  @ApiProperty({ nullable: true }) firstName: string | null;
  @ApiProperty({ nullable: true }) lastName: string | null;
  @ApiProperty({ nullable: true }) email: string | null;

  @ApiProperty({
    enum: ['PASSED', 'FAILED', 'INCOMPLETE', 'NOT_TAKEN'],
    description:
      'INCOMPLETE means a human mark is still missing, never that the candidate failed. NOT_TAKEN is somebody admitted who never started.',
  })
  outcome: string;

  @ApiProperty({ type: ExamHalfDto, nullable: true })
  written: ExamHalfDto | null;
  @ApiProperty({ type: ExamHalfDto, nullable: true })
  oral: ExamHalfDto | null;

  @ApiProperty({ type: [String], example: ['SPRECHEN'] })
  awaiting: string[];
  @ApiProperty({ nullable: true }) releasedAt: Date | null;
}
