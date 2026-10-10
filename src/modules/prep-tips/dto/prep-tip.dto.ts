import { ApiProperty } from '@nestjs/swagger';

export class PrepTipSummaryDto {
  @ApiProperty({
    enum: ['hoeren', 'lesen', 'sprachbausteine', 'schreiben', 'sprechen'],
    example: 'lesen',
  })
  skill: string;

  @ApiProperty({ example: 1 })
  teil: number;

  @ApiProperty({ example: 'Lesen Teil 1 — Globalverstehen' })
  title: string;
}

export class PrepTipDto extends PrepTipSummaryDto {
  @ApiProperty({
    example: 'Den globalen Inhalt von Kleinanzeigen erfassen.',
  })
  objective: string;

  @ApiProperty({ type: [String] })
  strategy: string[];

  @ApiProperty({ type: [String] })
  traps: string[];

  @ApiProperty({
    example: 'Danach: ein Lesen-Teil-1 aus einem Modelltest üben.',
  })
  practiceHint: string;
}
