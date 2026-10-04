import { ApiProperty } from '@nestjs/swagger';

export class ListeningQuestionDto {
  @ApiProperty({ example: 'q41' })
  id: string;

  @ApiProperty({
    example: 'Für Manfred Rienke ist das Fortbildungsangebot wichtig.',
  })
  prompt: string;
}

/**
 * One Hören Teil as training serves it — same fields as exam `getExamTeil`.
 *
 * No durable audio URL: the client spends a play via
 * `POST /api/listening/audio/:audioId/play`, then streams through the API.
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
      'How many times this recording may be played (from exam_plays_allowed)',
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
      'Richtig(+)/falsch(−) statements. No options array — student answers each with "+" or "−".',
    type: [ListeningQuestionDto],
  })
  questions: ListeningQuestionDto[];
}
