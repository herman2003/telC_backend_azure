import { ApiProperty } from '@nestjs/swagger';

export class ExamModelltestDto {
  @ApiProperty({ example: 2 })
  number: number;

  @ApiProperty({ example: 'Modelltest 2' })
  title: string;
}
