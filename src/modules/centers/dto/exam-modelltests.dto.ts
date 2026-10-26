import { ApiProperty } from '@nestjs/swagger';
import { CefrLevel } from '@prisma/client';

export class ExamModelltestDto {
  @ApiProperty({ example: 2 })
  number: number;

  @ApiProperty({ example: 'Modelltest 2' })
  title: string;

  /**
   * Which exam this paper is. A manager choosing a sitting is choosing a CEFR
   * level, and the picker used to return the number and title alone — so the
   * choice was made blind, and the candidates found out at the sitting.
   */
  @ApiProperty({ enum: CefrLevel, example: 'B1' })
  level: CefrLevel;
}

/**
 * Full Modelltest payload for a center manager preview.
 *
 * Built from the real `modelltests` row and its linked exercises. Answer-key
 * fields are stripped server-side (`withoutAnswerKey`); they must never appear
 * in this response.
 */
export class ExamModelltestContentDto {
  @ApiProperty({ example: 2 })
  number: number;

  @ApiProperty({ example: 'Modelltest 2' })
  title: string;

  @ApiProperty({
    description:
      'Exercise content keyed by skill. Same builders as the exam paper, without correct answers / answerKey / transcript. Hören Teile also include audioUrl for manager listening.',
    example: {
      LESEN: {},
      SPRACHBAUSTEINE: {},
      HOEREN: [
        {
          audioId: 'uuid',
          audioUrl: 'https://cdn.example/teil1.mp3',
          playsAllowed: 1,
          imagePath: 'https://cdn.example/img.png',
          contentRevision: 'modelltest-2-hoeren-teil1-v1',
          questions: [{ id: 'q41', prompt: '…' }],
        },
      ],
      SCHREIBEN: {},
      SPRECHEN: [],
    },
  })
  sections: {
    LESEN: unknown;
    SPRACHBAUSTEINE: unknown;
    HOEREN: unknown[];
    SCHREIBEN: unknown;
    SPRECHEN: unknown[];
  };
}
