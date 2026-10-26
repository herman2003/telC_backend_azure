import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** One A1/A2 Schreiben Teil from the generic model (keys present — ADR 0001). */
export class WritingGenericSectionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'SCHREIBEN_1' })
  sectionId!: string;

  @ApiProperty({ example: 'FORMULAR_AUSFUELLEN' })
  aufgabentyp!: string;

  @ApiProperty()
  teil!: number;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  instruction!: string;

  @ApiProperty()
  maxPoints!: number;

  @ApiProperty()
  contentRevision!: string;

  @ApiPropertyOptional()
  material?: unknown;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        itemNumber: { type: 'number' },
        prompt: { type: 'string', nullable: true },
        solution: {},
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              content: { type: 'string' },
              isCorrect: { type: 'boolean' },
            },
          },
        },
      },
    },
  })
  items!: Array<{
    itemNumber: number;
    prompt: string | null;
    solution: unknown;
    options: { key: string; content: string; isCorrect: boolean }[];
  }>;
}

/**
 * A1/A2 response for GET /api/writing/exercise?modelltest=.
 * B1/B2 returns {@link WritingExerciseDto} instead (same endpoint).
 */
export class WritingExerciseResponseDto {
  @ApiProperty()
  contentRevision!: string;

  @ApiProperty()
  issuedAt!: string;

  @ApiProperty({ type: () => [WritingGenericSectionDto] })
  sections!: WritingGenericSectionDto[];
}
