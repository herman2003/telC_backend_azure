import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { CefrLevel } from '@prisma/client';

export class FindPartnerDto {
  /**
   * Shown to a stranger, so it is constrained to something that reads as a
   * first name. Digits are rejected because an unconstrained name field in
   * front of strangers is a contact-sharing channel — the obvious use being to
   * broadcast a phone number or WhatsApp handle into the lobby.
   */
  @ApiProperty({ example: 'Anna', maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(/^[^\d]+$/, {
    message: 'displayName must not contain digits',
  })
  displayName: string;

  @ApiPropertyOptional({
    enum: CefrLevel,
    default: 'B1',
    description:
      'The level to be paired at. Only B1 has topics today; a level without ' +
      'them is refused with a reason when the room is opened, not here.',
  })
  @IsOptional()
  @IsEnum(CefrLevel)
  level?: CefrLevel;
}
