import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** One A1/A2 Sprechen Teil from the generic model (keys present — ADR 0001). */
export class SpeakingGenericSectionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'SPRECHEN_1' })
  sectionId!: string;

  @ApiProperty({ example: 'SICH_VORSTELLEN' })
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
 * A1/A2 response for GET /api/speaking/exercise?modelltest=.
 * B1/B2: use GET /api/speaking/teils (this endpoint returns 404).
 */
export class SpeakingExerciseResponseDto {
  @ApiProperty()
  contentRevision!: string;

  @ApiProperty()
  issuedAt!: string;

  @ApiProperty({ type: () => [SpeakingGenericSectionDto] })
  sections!: SpeakingGenericSectionDto[];
}
