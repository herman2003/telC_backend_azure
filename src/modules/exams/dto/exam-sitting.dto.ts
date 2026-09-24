import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';
import { ExamBlock } from '@prisma/client';

export class SaveExamAnswersDto {
  @ApiProperty({
    description:
      'The whole answer set for this block, keyed SKILL_TEIL. Sent in full rather than as a delta: a client that has to merge is a client that can lose an answer.',
    example: { LESEN_1: { '1': 'a' }, SPRACHBAUSTEINE_1: { '21': '21b' } },
  })
  @IsObject()
  answers: Record<string, Record<string, unknown>>;
}

export class SubmitExamBlockDto {
  @ApiPropertyOptional({
    description:
      'The final answers. Ignored when the submit arrives after the deadline — what was saved in time is what counts.',
  })
  @IsOptional()
  @IsObject()
  answers?: Record<string, Record<string, unknown>>;
}

export class ExamBlockTimerDto {
  @ApiProperty({ enum: ExamBlock }) block: ExamBlock;
  @ApiProperty() startedAt: Date;
  @ApiProperty({ description: 'An instant. The countdown is rendered from it.' })
  deadlineAt: Date;

  @ApiProperty({
    description:
      "The server's clock. Render deadlineAt minus this, so a device set to the wrong hour still counts down correctly.",
  })
  serverNow: Date;

  @ApiProperty({ example: 5400 }) remainingSeconds: number;
}

export class ExamSectionScoreDto {
  @ApiProperty({ example: 'LESEN' }) skill: string;
  @ApiProperty({ example: '1' }) teil: string;
  @ApiProperty({ nullable: true, example: 75 }) score: number | null;
  @ApiProperty({ description: 'A human still has to mark it.' })
  pending: boolean;
}

export class SubmitExamBlockResultDto {
  @ApiProperty({ enum: ExamBlock }) block: ExamBlock;
  @ApiProperty() submittedAt: Date;

  @ApiProperty({
    description:
      'True when the submit arrived after the deadline. The block was closed on the answers saved before it.',
  })
  late: boolean;

  @ApiProperty({ type: [ExamSectionScoreDto] })
  sections: ExamSectionScoreDto[];
}
