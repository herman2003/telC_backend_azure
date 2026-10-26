import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { CefrLevel } from '@prisma/client';

export class CreateRoomQueryDto {
  /**
   * Any level the product sells. A level with no topics yet is refused
   * further in, with a reason, rather than rejected as a malformed request.
   */
  @ApiProperty({ enum: CefrLevel, example: 'B1' })
  @IsEnum(CefrLevel)
  level: CefrLevel;
}
