import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WritingExerciseContact {
  @ApiProperty({ example: 'CenterBüros GmbH' })
  name: string;

  @ApiProperty({ type: [String], example: ['Neuer Wall 120', '50160 Köln'] })
  lines: string[];
}

export class WritingExerciseStimulus {
  @ApiProperty({ example: 'Büroräume in Neubaukomplex zu vermieten!' })
  heading: string;

  @ApiPropertyOptional({
    example: 'In unserem neu gebauten Bürogebäude sind noch Räume frei',
  })
  body?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['zentrale Lage', 'Kaffeeküche'],
  })
  features?: string[];

  @ApiPropertyOptional({
    example: 'Vereinbaren Sie einen Besichtigungstermin...',
  })
  callToAction?: string;

  @ApiPropertyOptional({ type: WritingExerciseContact })
  contact?: WritingExerciseContact;
}

export class WritingExerciseDto {
  @ApiProperty({
    description: 'Exercise UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id: string;

  @ApiProperty({
    description:
      'Which Schreiben task of the Modelltest this is. B1 has one, so it is ' +
      '1 there. B2 offers two and the candidate answers exactly one.',
    example: 1,
  })
  part: number;

  @ApiProperty({ example: 'E-Mail / Brief' })
  title: string;

  @ApiPropertyOptional({ example: 'Formeller Brief' })
  subtitle?: string;

  @ApiProperty({ enum: ['brief', 'forumsbeitrag'], example: 'brief' })
  taskType: 'brief' | 'forumsbeitrag';

  @ApiPropertyOptional({ example: 'Sie sehen folgende Anzeige:' })
  intro?: string;

  @ApiPropertyOptional({ type: WritingExerciseStimulus })
  stimulus?: WritingExerciseStimulus;

  @ApiProperty({
    description: 'Main task instructions shown to the student',
    example:
      'Sie arbeiten in einem Übersetzerbüro. Schreiben Sie einen Brief...',
  })
  taskInstructions: string;

  @ApiProperty({
    description: 'Required content points the student must address',
    type: [String],
    example: [
      'Beschreiben Sie Ihr Unternehmen.',
      'Was für Räume brauchen Sie?',
    ],
  })
  bulletPoints: string[];

  @ApiPropertyOptional({
    description: 'Closing reminder shown below the bullet points',
    example: 'Vergessen Sie nicht Datum und Anrede.',
  })
  closingReminder?: string;

  @ApiProperty({
    description:
      'Suggested Vorbereitung (prep) duration before the editor unlocks',
    example: 120,
  })
  prepDurationSeconds: number;

  @ApiProperty({
    description: 'Suggested writing timer after Vorbereitung (telc ~30 min)',
    example: 30,
  })
  writingDurationMinutes: number;

  @ApiProperty({
    description:
      'Register checklist for Vorbereitung (soft — does not block Weiter)',
    type: [String],
    example: ['Betreff', 'Anrede', 'Einleitung', 'Schluss'],
  })
  registerChecklist: string[];

  @ApiPropertyOptional({
    description:
      'Shared by every task of a one-of-N choice; absent when there is no ' +
      'choice to make.',
    example: 'b2-modelltest-1-schreiben',
  })
  choiceGroupId?: string;

  /**
   * Every task the candidate may choose between, this one included.
   *
   * Absent unless there is a choice, so a client that knows nothing about one
   * keeps rendering the response itself as the task — which is what B1 has
   * always been. The answer is submitted with the chosen task's own `id`.
   *
   * Entries never nest: a task inside a choice carries no `choices` of its
   * own.
   */
  @ApiPropertyOptional({
    type: () => [WritingExerciseDto],
    description:
      'All tasks of the choice, including this one. Absent when there is no ' +
      'choice. Submit with the chosen task id.',
  })
  choices?: WritingExerciseDto[];
}
