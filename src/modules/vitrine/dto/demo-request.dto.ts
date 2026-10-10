import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class DemoRequestDto {
  @ApiProperty({ example: 'Amina Ngo', maxLength: 120 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName: string;

  @ApiProperty({ format: 'email', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'WhatsApp number with country prefix, e.g. +237 6XX…',
    example: '+237 690 00 00 00',
    maxLength: 40,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  whatsapp: string;

  @ApiProperty({ example: 'Sprachschule Douala', maxLength: 160 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  centerName: string;

  @ApiProperty({
    description: 'Student-count band chosen on the vitrine form',
    example: '20–50',
    maxLength: 32,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  studentBand: string;

  @ApiProperty({
    description:
      'Start of the 30-minute slot as ISO-8601. Must fall on a Berlin Mon–Sat demo window (07:00–12:00 or 16:00–20:00, :00/:30).',
    example: '2026-10-13T09:00:00.000Z',
  })
  @IsISO8601({ strict: true })
  slotStart: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional({
    enum: ['fr', 'en', 'de'],
    description: 'Site language — drives the confirmation email copy',
  })
  @IsOptional()
  @IsIn(['fr', 'en', 'de'])
  locale?: 'fr' | 'en' | 'de';
}
