import { ApiProperty } from '@nestjs/swagger';

export class ElenaTopicDto {
  @ApiProperty({ example: 'b1-t2-001' })
  id: string;

  @ApiProperty({ example: 'B1' })
  level: string;

  @ApiProperty({ example: 2, description: 'Prompt persona Teil used for this topic.' })
  teil: number;

  @ApiProperty({ example: 'Reisen mit einer Gruppe' })
  title: string;

  @ApiProperty()
  positionA: string;

  @ApiProperty()
  positionB: string;

  @ApiProperty({ type: [String] })
  followUpQuestions: string[];
}
