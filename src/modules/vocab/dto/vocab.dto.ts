import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class VocabSenseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sortOrder: number;

  /** Localized meaning for `lang` (null when lang=de). */
  @ApiPropertyOptional({ nullable: true })
  meaning: string | null;

  /** Localized example gloss for `lang` (null when lang=de). */
  @ApiPropertyOptional({ nullable: true })
  exampleGloss: string | null;

  /** Localized note for `lang` (null when lang=de). */
  @ApiPropertyOptional({ nullable: true })
  note: string | null;

  /** Kept for backward compat / Wordchat; prefer `meaning` + `lang`. */
  @ApiProperty()
  meaningFr: string;

  @ApiPropertyOptional()
  meaningEn: string | null;

  @ApiProperty()
  exampleDe: string;

  @ApiPropertyOptional()
  exampleFr: string | null;

  @ApiPropertyOptional()
  exampleEn: string | null;

  @ApiPropertyOptional()
  noteFr: string | null;

  @ApiPropertyOptional()
  noteEn: string | null;
}

export class VocabConjugationDto {
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  praesens?: Record<string, string>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  praeteritum?: Record<string, string>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  perfekt?: Record<string, string>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  konjunktiv_ii?: Record<string, string>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  imperativ?: Record<string, string>;
}

export class VocabLangQueryDto {
  @ApiPropertyOptional({
    enum: ['fr', 'en', 'de'],
    description: 'Course UI language (default fr) — same as grammar',
  })
  @IsOptional()
  @IsIn(['fr', 'en', 'de'], { message: 'lang must be fr, en, or de' })
  lang?: string;
}

export class VocabEntryCardDto {
  @ApiProperty({ enum: ['fr', 'en', 'de'] })
  lang: string;

  @ApiProperty()
  id: string;

  @ApiProperty()
  lemma: string;

  @ApiProperty({ enum: ['noun', 'verb', 'adj', 'adv', 'prep', 'other'] })
  pos: string;

  @ApiPropertyOptional()
  article: string | null;

  @ApiPropertyOptional()
  gender: string | null;

  @ApiPropertyOptional()
  plural: string | null;

  @ApiPropertyOptional()
  cefrLevel: string | null;

  @ApiPropertyOptional()
  auxiliary: string | null;

  @ApiPropertyOptional()
  separable: boolean | null;

  @ApiPropertyOptional()
  partizipIi: string | null;

  @ApiPropertyOptional()
  comparative: string | null;

  @ApiPropertyOptional()
  superlative: string | null;

  @ApiPropertyOptional()
  governsCase: string | null;

  @ApiProperty({ type: [VocabSenseDto] })
  senses: VocabSenseDto[];

  @ApiPropertyOptional({ type: VocabConjugationDto })
  conjugation: VocabConjugationDto | null;

  @ApiPropertyOptional({ enum: ['learning', 'known', null] })
  progressStatus: string | null;
}

export class VocabOfTheWeekDto {
  @ApiProperty({ enum: ['fr', 'en', 'de'] })
  lang: string;

  @ApiProperty()
  modelltestNumber: number;

  @ApiProperty()
  title: string;

  @ApiProperty()
  period: { start: string; end: string };

  @ApiProperty({ type: [VocabEntryCardDto] })
  nouns: VocabEntryCardDto[];

  @ApiProperty({ type: [VocabEntryCardDto] })
  verbs: VocabEntryCardDto[];

  @ApiProperty({ type: [VocabEntryCardDto] })
  adjectives: VocabEntryCardDto[];

  @ApiProperty({ type: [VocabEntryCardDto] })
  adverbs: VocabEntryCardDto[];

  @ApiProperty({ type: [VocabEntryCardDto] })
  prepositions: VocabEntryCardDto[];
}

export class VocabSearchQueryDto extends VocabLangQueryDto {
  @ApiProperty({ minLength: 1, maxLength: 64 })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  q: string;

  @ApiPropertyOptional({ enum: ['noun', 'verb', 'adj', 'adv', 'prep'] })
  @IsOptional()
  @IsIn(['noun', 'verb', 'adj', 'adv', 'prep'])
  pos?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: string;
}

export class UpdateVocabProgressDto {
  @ApiProperty({ enum: ['learning', 'known'] })
  @IsIn(['learning', 'known'])
  status: 'learning' | 'known';
}

export class VocabProgressSummaryDto {
  @ApiProperty()
  learningCount: number;

  @ApiProperty()
  knownCount: number;
}
