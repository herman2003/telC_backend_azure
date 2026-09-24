import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CefrLevel, ExamGradingTier } from '@prisma/client';
import { ACCESS_WINDOW_HOURS } from '../exam-session-policy.service';
import { Trim } from './center-validation.decorators';

/** One sitting cannot hold more candidates than a school has students, and a
 *  list longer than this is a client bug rather than a school. */
const MAX_PARTICIPANTS = 500;

export class CreateExamSessionDto {
  @ApiProperty({
    example: 'Examen séquentiel B1 — Octobre',
    maxLength: 120,
    description:
      'The center own wording. Lerniqo imposes no taxonomy of exam types.',
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 2, description: 'Which Modelltest they sit.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  modelltestNumber: number;

  @ApiProperty({
    example: '2026-10-05T09:00:00.000Z',
    description: 'When candidates may begin. Must be in the future.',
  })
  @Type(() => Date)
  @IsDate()
  opensAt: Date;

  @ApiProperty({
    enum: ACCESS_WINDOW_HOURS,
    example: 48,
    description:
      'How long the sitting admits candidates. The closing time is computed from it and is never sent by the client.',
  })
  @Type(() => Number)
  @IsIn([...ACCESS_WINDOW_HOURS])
  accessWindowHours: number;
}

export class UpdateExamSessionDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  modelltestNumber?: number;

  @ApiPropertyOptional({ example: '2026-10-05T09:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  opensAt?: Date;

  @ApiPropertyOptional({ enum: ACCESS_WINDOW_HOURS, example: 48 })
  @IsOptional()
  @Type(() => Number)
  @IsIn([...ACCESS_WINDOW_HOURS])
  accessWindowHours?: number;
}

export class ReopenExamSessionDto {
  @ApiProperty({
    enum: ACCESS_WINDOW_HOURS,
    example: 24,
    description: 'Counted from now, not from the original opening.',
  })
  @Type(() => Number)
  @IsIn([...ACCESS_WINDOW_HOURS])
  accessWindowHours: number;
}

export class SetParticipantsDto {
  @ApiProperty({
    type: [String],
    description:
      'The whole list, not a delta. Students must belong to the signed center.',
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(MAX_PARTICIPANTS)
  @IsUUID('4', { each: true })
  studentIds: string[];
}

export class ListExamSessionsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

export class EligibleStudentsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize: number = 50;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Matches a name or an email, case-insensitively.',
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class ExamSessionDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'Examen séquentiel B1 — Octobre' }) name: string;
  @ApiProperty({ enum: CefrLevel, example: 'B1' }) level: CefrLevel;
  @ApiProperty({ example: 2 }) modelltestNumber: number;
  @ApiProperty({ example: 'Modelltest 2' }) modelltestTitle: string;

  @ApiProperty({
    enum: ExamGradingTier,
    description:
      'What the center bought: MANUAL is the 1,000 XAF product, AI the 1,500 one. Fixed when the sitting publishes.',
  })
  gradingTier: ExamGradingTier;

  @ApiProperty({
    enum: ['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED'],
    description:
      'Derived from the timestamps on every read, never stored, so it is correct whether or not any job has run.',
  })
  status: string;

  @ApiProperty() opensAt: Date;
  @ApiProperty({ description: 'Computed from the access window.' })
  closesAt: Date;
  @ApiProperty({ nullable: true }) publishedAt: Date | null;
  @ApiProperty({ example: 15 }) participantCount: number;
  @ApiProperty() createdAt: Date;
}

export class ExamSessionListDto {
  @ApiProperty({ type: [ExamSessionDto] }) sessions: ExamSessionDto[];
  @ApiProperty({ example: 4 }) total: number;
}

export class EligibleStudentDto {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true }) firstName: string | null;
  @ApiProperty({ nullable: true }) lastName: string | null;
  @ApiProperty({ nullable: true }) email: string | null;
  @ApiProperty({ description: 'Already admitted to this sitting.' })
  selected: boolean;

  @ApiProperty({
    description:
      'Has already worked on this Modelltest in training, so their score in an exam using it would say nothing. Show it as a warning; it does not block anything.',
  })
  trainedOnModelltest: boolean;
}

export class EligibleStudentListDto {
  @ApiProperty({ type: [EligibleStudentDto] }) students: EligibleStudentDto[];
  @ApiProperty({ example: 42 }) total: number;
}

export class SetParticipantsResultDto {
  @ApiProperty({ example: 15 }) participantCount: number;
  @ApiProperty({
    example: 0,
    description:
      'Slots taken by this change. Zero while the sitting is a draft; one per candidate added to a published sitting.',
  })
  slotsSpent: number;
}

export class PublishExamSessionResultDto {
  @ApiProperty() publishedAt: Date;
  @ApiProperty({ example: 15 }) participantCount: number;
  @ApiProperty({ example: 15 }) slotsSpent: number;
  @ApiProperty({ example: 5 }) slotsRemaining: number;
}
