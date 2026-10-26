import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DiffOpDto {
  @ApiProperty({ enum: ['equal', 'delete', 'insert'] })
  op: 'equal' | 'delete' | 'insert';

  @ApiProperty()
  text: string;
}

export class InlineCorrectionDto {
  @ApiProperty({ description: 'Original (incorrect) text fragment' })
  original: string;

  @ApiProperty({ description: 'Corrected text fragment' })
  corrected: string;

  @ApiPropertyOptional({ description: 'Explanation in German' })
  explanation?: string;

  @ApiPropertyOptional({ enum: ['grammar', 'vocabulary', 'spelling', 'style'] })
  errorType?: string;
}

export class ExerciseAttemptDto {
  @ApiProperty({ description: 'Attempt UUID' })
  id: string;

  @ApiPropertyOptional({
    description: 'ISO 8601 completion or creation timestamp',
  })
  date?: string;

  @ApiPropertyOptional({
    description: 'Human-readable date label (Heute / Gestern / dd.mm.yyyy)',
  })
  dateLabel?: string;

  @ApiPropertyOptional({
    description: 'Overall score 0–100',
    minimum: 0,
    maximum: 100,
  })
  score?: number | null;

  @ApiPropertyOptional({ description: 'AI feedback in German' })
  feedback?: string;

  @ApiPropertyOptional({ description: 'Time spent writing in seconds' })
  durationSeconds?: number | null;

  @ApiPropertyOptional({ description: "The student's original submitted text" })
  originalText?: string;

  @ApiPropertyOptional({
    description: 'AI-rewritten corrected version of the text',
  })
  correctedText?: string;

  @ApiPropertyOptional({
    description: 'Word-level diff between originalText and correctedText',
    type: [DiffOpDto],
  })
  diff?: DiffOpDto[];

  @ApiPropertyOptional({
    description: 'Number of required bullet points the student addressed (0–5)',
    minimum: 0,
    maximum: 5,
  })
  pointsAddressed?: number;

  @ApiPropertyOptional({
    description:
      'telc Deutsch B1 Schriftlicher Ausdruck: A–D on I/II/III and points /45',
    example: {
      taskFulfilment: 'B',
      communicativeDesign: 'A',
      formalAccuracy: 'C',
      points: 27,
    },
  })
  telcRating?: {
    taskFulfilment: 'A' | 'B' | 'C' | 'D';
    communicativeDesign: 'A' | 'B' | 'C' | 'D';
    formalAccuracy: 'A' | 'B' | 'C' | 'D';
    points: number;
  };

  @ApiPropertyOptional({
    description:
      'A1/A2 TEXT_SCHREIBEN half-point rubric (training AI). Absent for B1/B2.',
    example: {
      scheme: 'A1_A2',
      contentPointBands: ['FULL', 'FULL', 'PARTIAL'],
      communicativeDesign: 'FULL',
      points: 8.5,
      maxPoints: 10,
    },
  })
  a12Rating?: {
    scheme: 'A1_A2';
    contentPointBands: Array<'FULL' | 'PARTIAL' | 'NONE'>;
    communicativeDesign: 'FULL' | 'PARTIAL' | 'NONE';
    points: number;
    maxPoints: number;
  };

  @ApiPropertyOptional({
    description: 'List of inline corrections (max 10)',
    type: [InlineCorrectionDto],
  })
  corrections?: InlineCorrectionDto[];

  // ── Shared by every module's history (D29). Added, never replacing the
  // fields above, which the app already reads.

  @ApiPropertyOptional({
    description: 'Same as `id`; the name every module shares',
  })
  attemptId?: string;

  @ApiPropertyOptional({
    enum: ['hoeren', 'lesen', 'sprachbausteine', 'schreiben', 'sprechen'],
  })
  skill?: string;

  @ApiPropertyOptional({ example: 2 })
  teil?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'The scale `score` is on. 100 for every module today.',
  })
  maxScore?: number;

  @ApiPropertyOptional({
    enum: ['completed', 'pending'],
    description: '`pending` while a Writing attempt waits for its correction',
  })
  status?: 'completed' | 'pending';

  @ApiPropertyOptional({
    nullable: true,
    description: 'ISO 8601, null while pending',
  })
  completedAt?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  modelltestId?: string | null;
}
