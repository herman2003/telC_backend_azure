import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ClientAttemptId } from '../../student-activity/attempt-id.decorator';

export class GrammarDayMetaDto {
  @ApiProperty({ example: '2026-10-13' })
  date: string;

  @ApiProperty({ example: 286 })
  indexInEpoch: number;

  @ApiProperty()
  nextThemeAt: string;
}

export class GrammarLangQueryDto {
  @ApiPropertyOptional({
    enum: ['fr', 'en', 'de'],
    default: 'fr',
    description: 'Course UI language (default fr)',
  })
  @IsOptional()
  @IsString()
  @IsIn(['fr', 'en', 'de'], { message: 'lang must be fr, en, or de' })
  lang?: 'fr' | 'en' | 'de';
}

export class GrammarExampleDto {
  /** Always the German example sentence. */
  @ApiProperty()
  de: string;

  /** Translation / gloss for the selected `lang` (null when lang=de). */
  @ApiPropertyOptional({ nullable: true })
  gloss?: string | null;
}

export class GrammarTopicDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ enum: ['fr', 'en', 'de'] })
  lang: string;

  /** Localized lesson title for `lang`. */
  @ApiProperty()
  title: string;

  @ApiProperty()
  category: string;

  @ApiProperty({ type: [String] })
  cefrLevels: string[];

  /** Localized long-form rule / lesson body for `lang`. */
  @ApiProperty()
  rule: string;

  @ApiPropertyOptional({ nullable: true })
  notes?: string | null;

  @ApiProperty({ type: [GrammarExampleDto] })
  examples: GrammarExampleDto[];

  /** Local CDN/static URL when GRAMMAR_IMAGES_PUBLIC_BASE_URL is set; otherwise null. */
  @ApiPropertyOptional({ nullable: true })
  imageUrl?: string | null;
}

export class GrammarProgressDto {
  @ApiProperty()
  lessonCompleted: boolean;

  @ApiProperty()
  nextExerciseIndex: number;

  @ApiProperty()
  exercisesTotal: number;

  @ApiProperty()
  exercisesCompleted: number;
}

export class GrammarOfTheDayDto {
  @ApiPropertyOptional()
  modelltestNumber?: number;

  @ApiProperty({ type: GrammarDayMetaDto })
  day: GrammarDayMetaDto;

  @ApiProperty({ type: GrammarTopicDto })
  topic: GrammarTopicDto;

  @ApiProperty({ type: GrammarProgressDto })
  progress: GrammarProgressDto;
}

export class GrammarExerciseItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  index: number;

  @ApiProperty({ enum: ['easy', 'medium', 'hard'] })
  difficulty: string;

  @ApiProperty({ enum: ['mcq', 'cloze'] })
  kind: string;

  /** Localized prompt for the requested `lang` (fallback FR). */
  @ApiProperty()
  prompt: string;

  @ApiPropertyOptional({ type: [String] })
  options?: string[] | null;

  /** Correct answer — same ADR 0001 pattern as Sprachbausteine / Lesen / practice. */
  @ApiProperty()
  answer: string;

  /** Localized explanation for the requested `lang` (fallback FR). */
  @ApiPropertyOptional({ nullable: true })
  explanation?: string | null;

  /**
   * @deprecated Prefer `explanation`. Same localized value for short FE compat.
   */
  @ApiPropertyOptional({ nullable: true })
  explanationFr?: string | null;

  @ApiProperty({ enum: ['locked', 'unlocked', 'completed'] })
  status: string;
}

export class GrammarExercisesOfTheDayDto {
  @ApiProperty({ format: 'uuid' })
  topicId: string;

  @ApiProperty()
  topicSlug: string;

  @ApiProperty({ type: GrammarDayMetaDto })
  day: GrammarDayMetaDto;

  @ApiProperty()
  lessonCompleted: boolean;

  @ApiProperty({ type: [GrammarExerciseItemDto] })
  exercises: GrammarExerciseItemDto[];
}

export class CompleteLessonResponseDto {
  @ApiProperty()
  lessonCompleted: boolean;

  @ApiProperty()
  nextExerciseIndex: number;
}

export class SubmitGrammarExerciseDto {
  @ApiProperty({ example: 'der' })
  @IsString()
  @MinLength(1)
  answer: string;
}

export class SubmitGrammarExerciseResponseDto {
  @ApiProperty()
  correct: boolean;

  /** Localized explanation for the requested `lang` (fallback FR). */
  @ApiPropertyOptional({ nullable: true })
  explanation?: string | null;

  /**
   * @deprecated Prefer `explanation`. Same localized value for short FE compat.
   */
  @ApiPropertyOptional({ nullable: true })
  explanationFr?: string | null;

  @ApiProperty()
  nextExerciseIndex: number;
}

export class GrammarPracticeQueryDto {
  @ApiPropertyOptional({ enum: ['easy', 'medium', 'hard'] })
  @IsOptional()
  @IsString()
  @IsIn(['easy', 'medium', 'hard'], {
    message: 'difficulty must be easy, medium, or hard',
  })
  difficulty?: string;

  @ApiPropertyOptional({
    enum: ['fr', 'en', 'de'],
    default: 'fr',
    description: 'UI language for prompt / explanation (default fr)',
  })
  @IsOptional()
  @IsString()
  @IsIn(['fr', 'en', 'de'], { message: 'lang must be fr, en, or de' })
  lang?: string;
}

export class GrammarPracticeExerciseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** Localized prompt for the requested `lang` (fallback FR). */
  @ApiProperty()
  prompt: string;

  @ApiPropertyOptional({ type: [String], nullable: true })
  options: string[] | null;

  @ApiProperty()
  answer: string;

  /** Localized explanation for the requested `lang` (fallback FR). */
  @ApiPropertyOptional({ nullable: true })
  explanation: string | null;

  /**
   * @deprecated Prefer `explanation`. Same localized value for short FE compat.
   */
  @ApiPropertyOptional({ nullable: true })
  explanationFr: string | null;

  @ApiProperty({ enum: ['easy', 'medium', 'hard'] })
  difficulty: string;
}

export class GrammarPracticeExercisesDto {
  @ApiProperty({ type: [GrammarPracticeExerciseDto] })
  exercises: GrammarPracticeExerciseDto[];
}

export class GrammarPracticeLevelDto {
  @ApiProperty({ example: '1' })
  id: string;

  @ApiProperty({ enum: ['easy', 'medium', 'hard'] })
  difficulty: string;

  @ApiProperty({ example: 5, description: 'Client timer hint (minutes)' })
  durationMinutes: number;

  @ApiProperty({
    example: 10,
    description:
      'Fixed QCM count for this level (increases as difficulty rises: 10 / 15 / 20)',
  })
  questionCount: number;
}

export class GrammarPracticeLevelsDto {
  @ApiProperty({ type: [GrammarPracticeLevelDto] })
  levels: GrammarPracticeLevelDto[];
}

export class SubmitGrammarPracticeDto {
  @ApiProperty({
    description: 'Map of exerciseId → student answer',
    example: {
      '11111111-1111-4111-8111-111111111111': 'der',
      '22222222-2222-4222-8222-222222222222': 'die',
    },
    additionalProperties: { type: 'string' },
  })
  @IsObject()
  answers: Record<string, string>;

  @ApiPropertyOptional({ enum: ['easy', 'medium', 'hard'] })
  @IsOptional()
  @IsString()
  @IsIn(['easy', 'medium', 'hard'], {
    message: 'difficulty must be easy, medium, or hard',
  })
  difficulty?: string;

  @ApiPropertyOptional({ example: 300 })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @ClientAttemptId()
  attemptId?: string;
}

export class SubmitGrammarPracticeResponseDto {
  @ApiProperty({ format: 'uuid' })
  attemptId: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  score: number;

  @ApiProperty()
  correctCount: number;

  @ApiProperty()
  total: number;

  @ApiProperty({
    description: 'Correct answer per submitted exercise id',
    additionalProperties: { type: 'string' },
  })
  answerKey: Record<string, string>;
}

export class GrammarPracticeSessionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  attemptId: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  score: number;

  @ApiProperty({ example: 100 })
  maxScore: number;

  @ApiProperty()
  correctCount: number;

  @ApiProperty()
  total: number;

  @ApiPropertyOptional({ enum: ['easy', 'medium', 'hard'], nullable: true })
  difficulty: string | null;

  @ApiPropertyOptional({ nullable: true })
  durationSeconds: number | null;

  @ApiProperty({ enum: ['completed'] })
  status: 'completed';

  @ApiProperty({ nullable: true })
  completedAt: string | null;

  @ApiProperty()
  date: string;
}

export class GrammarPracticeProgressDto {
  @ApiProperty()
  attemptCount: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Rounded mean of session scores, null when no attempts',
  })
  averageScore: number | null;

  @ApiPropertyOptional({ type: GrammarPracticeSessionDto, nullable: true })
  lastAttempt: GrammarPracticeSessionDto | null;
}
