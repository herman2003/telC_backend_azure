import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class GrammarDayMetaDto {
  @ApiProperty({ example: '2026-10-13' })
  date: string;

  @ApiProperty({ example: 286 })
  indexInEpoch: number;

  @ApiProperty()
  nextThemeAt: string;
}

export class GrammarExampleDto {
  @ApiProperty()
  de: string;

  @ApiPropertyOptional()
  fr?: string | null;

  @ApiPropertyOptional()
  en?: string | null;
}

export class GrammarTopicDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  titleFr: string;

  @ApiProperty()
  titleDe: string;

  @ApiPropertyOptional()
  titleEn?: string | null;

  @ApiProperty()
  category: string;

  @ApiProperty({ type: [String] })
  cefrLevels: string[];

  @ApiProperty()
  ruleFr: string;

  @ApiProperty()
  ruleDe: string;

  @ApiPropertyOptional()
  ruleEn?: string | null;

  @ApiPropertyOptional()
  notesFr?: string | null;

  @ApiProperty({ type: [GrammarExampleDto] })
  examples: GrammarExampleDto[];
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

  @ApiPropertyOptional()
  promptDe?: string | null;

  @ApiProperty()
  promptFr: string;

  @ApiPropertyOptional({ type: [String] })
  options?: string[] | null;

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

  @ApiPropertyOptional()
  explanationFr?: string | null;

  @ApiProperty()
  nextExerciseIndex: number;
}
