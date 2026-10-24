import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LesenTeil1Dto } from './lesen-teil1.dto';
import { LesenTeil2Dto } from './lesen-teil2.dto';
import { LesenTeil3Dto } from './lesen-teil3.dto';

/** One A1/A2 Lesen Teil from the generic model (keys present — ADR 0001). */
export class LesenGenericSectionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'LESEN_1' })
  sectionId!: string;

  @ApiProperty({ example: 'RICHTIG_FALSCH' })
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
 * B1/B2: `teil1`/`teil2`/`teil3` present.
 * A1/A2: `sections` present; the B1 teil fields are absent (not stubbed).
 */
export class LesenExerciseResponseDto {
  @ApiProperty()
  contentRevision!: string;

  @ApiProperty()
  issuedAt!: string;

  @ApiPropertyOptional({ type: () => LesenTeil1Dto })
  teil1?: LesenTeil1Dto;

  @ApiPropertyOptional({ type: () => LesenTeil2Dto })
  teil2?: LesenTeil2Dto;

  @ApiPropertyOptional({ type: () => LesenTeil3Dto })
  teil3?: LesenTeil3Dto;

  @ApiPropertyOptional({ type: () => [LesenGenericSectionDto] })
  sections?: LesenGenericSectionDto[];
}
