import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListeningQuestionDto {
  @ApiProperty({ example: 'q41' })
  id: string;

  @ApiProperty({
    example: 'Für Manfred Rienke ist das Fortbildungsangebot wichtig.',
  })
  prompt: string;
}

/** One item of an A1/A2 Hören Teil (keys stripped on GET; scored on submit). */
export class ListeningGenericItemDto {
  @ApiProperty()
  itemNumber: number;

  @ApiPropertyOptional({ nullable: true })
  prompt: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Per-item picture (e.g. A2 phone note); text prompt is fallback',
  })
  imageUrl?: string | null;

  @ApiPropertyOptional({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        content: { type: 'string' },
        imageUrl: { type: 'string', nullable: true },
      },
    },
  })
  options: { key: string; content: string; imageUrl?: string | null }[];
}

/**
 * One Hören Teil as training serves it — same fields as exam `getExamTeil`.
 *
 * No durable audio URL: the client spends a play via
 * `POST /api/listening/audio/:audioId/play`, then streams through the API.
 *
 * A1/A2 add `aufgabentyp` + `items` (authoritative). B1 keeps `questions` as
 * Richtig/Falsch prompts only.
 */
export class ListeningExerciseDto {
  @ApiProperty({
    description:
      'Listening exercise id — pass to POST .../audio/{audioId}/play',
    example: '06cbc490-dc63-4ea1-b491-c1a569d88489',
  })
  audioId: string;

  @ApiProperty({
    description:
      'Strict-mode play hint from exam_plays_allowed (usually 1). Training free ' +
      'ignores this; timed training and Exam Day treat it as once. Zweimal is in the MP3.',
    example: 1,
  })
  playsAllowed: number;

  @ApiProperty({
    description:
      'Content version string — send back unchanged in submit as content_revision',
    example: 'modelltest-1-teil-1-v1',
  })
  contentRevision: string;

  @ApiProperty({
    description: 'Image URL for this Teil (Cloudflare R2)',
    example:
      'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/hoerverstehen_teil1.png',
  })
  imagePath: string;

  @ApiProperty({
    description:
      'Richtig(+)/falsch(−) statements (B1/B2). For A1/A2 prefer `items`.',
    type: [ListeningQuestionDto],
  })
  questions: ListeningQuestionDto[];

  @ApiPropertyOptional({
    description: 'A1/A2: Aufgabenart of this Teil',
    example: 'KURZANTWORT',
  })
  aufgabentyp?: string;

  @ApiPropertyOptional({
    description: 'A1/A2: e.g. HOEREN_1',
    example: 'HOEREN_1',
  })
  sectionId?: string;

  @ApiPropertyOptional({
    description: 'A1/A2: section material (word banks, texts, …)',
  })
  material?: unknown;

  @ApiPropertyOptional({
    description:
      'A1/A2: authoritative items (no answer key on GET — scored on submit)',
    type: [ListeningGenericItemDto],
  })
  items?: ListeningGenericItemDto[];
}
