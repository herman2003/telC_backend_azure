import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ScoresDto {
  @ApiProperty({ example: 75 })
  @IsNumber()
  @Min(0)
  @Max(100)
  grammar: number;

  @ApiProperty({ example: 72 })
  @IsNumber()
  @Min(0)
  @Max(100)
  vocabulary: number;

  @ApiProperty({ example: 80 })
  @IsNumber()
  @Min(0)
  @Max(100)
  coherence: number;

  @ApiProperty({ example: 76 })
  @IsNumber()
  @Min(0)
  @Max(100)
  overall: number;
}

export class CorrectionDto {
  @ApiProperty({ example: 'Ich gehen oft ins Kino' })
  @IsString()
  original: string;

  @ApiProperty({ example: 'Ich gehe oft ins Kino' })
  @IsString()
  corrected: string;

  @ApiProperty({
    example:
      "Das Verb 'gehen' muss in der ersten Person konjugiert werden: 'ich gehe'.",
  })
  @IsString()
  explanation: string;

  @ApiProperty({ example: 'grammar', enum: ['grammar', 'vocabulary'] })
  @IsString()
  error_type: 'grammar' | 'vocabulary';
}

export class TelcSprechenRatingDto {
  @ApiProperty({ enum: ['A', 'B', 'C', 'D'], example: 'B' })
  @IsString()
  expression: 'A' | 'B' | 'C' | 'D';

  @ApiProperty({ enum: ['A', 'B', 'C', 'D'], example: 'A' })
  @IsString()
  taskFulfilment: 'A' | 'B' | 'C' | 'D';

  @ApiProperty({ enum: ['A', 'B', 'C', 'D'], example: 'C' })
  @IsString()
  formalAccuracy: 'A' | 'B' | 'C' | 'D';

  @ApiProperty({ enum: ['A', 'B', 'C', 'D'], example: 'B' })
  @IsString()
  pronunciation: 'A' | 'B' | 'C' | 'D';

  @ApiProperty({ example: 24, description: 'M10 points for this Teil' })
  @IsNumber()
  points: number;

  @ApiProperty({ example: 30, description: '15 for Teil 1, 30 for Teil 2/3' })
  @IsNumber()
  maxPoints: number;

  @ApiProperty({ example: 2, enum: [1, 2, 3] })
  @IsNumber()
  teilNumber: 1 | 2 | 3;
}

export class SpeakingEvaluationResponseDto {
  @ApiProperty({
    example:
      'Hallo! Hier sind die Ergebnisse deiner Sprechübung für Teil 1. Insgesamt hast du 76 von 100 Punkten erreicht. Dein Wortschatz ist sehr gut. Achte noch auf die Verbkonjugation — du hast zum Beispiel gesagt: ich gehen — richtig wäre ich gehe. Weiter so, du machst gute Fortschritte!',
  })
  @IsString()
  evaluationText: string;

  @ApiProperty({ type: ScoresDto })
  @ValidateNested()
  @Type(() => ScoresDto)
  scores: ScoresDto;

  @ApiProperty({
    type: TelcSprechenRatingDto,
    required: false,
    description:
      'telc M10 A–D grades + points (T1 /15, T2–T3 /30). Preferred display. Absent on legacy stored evaluations.',
  })
  @ValidateNested()
  @Type(() => TelcSprechenRatingDto)
  telcRating?: TelcSprechenRatingDto;

  @ApiProperty({ type: [CorrectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CorrectionDto)
  corrections: CorrectionDto[];

  @ApiProperty({
    example:
      'Der Schüler spricht klar und verwendet abwechslungsreiche Ausdrücke.',
  })
  @IsString()
  strengths: string;

  @ApiProperty({
    example: 'Die Verbkonjugation sollte noch verbessert werden.',
  })
  @IsString()
  areas_for_improvement: string;

  @ApiProperty({
    required: false,
    description:
      'A1/A2 official M10 task bands (practice estimate). Absent for B1/B2.',
  })
  a12M10?: Record<string, unknown>;
}
