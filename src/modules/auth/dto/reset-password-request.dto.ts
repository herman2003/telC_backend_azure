import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  Matches,
} from 'class-validator';
import { StrongPassword } from '../../../shared/strong-password.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResetPasswordRequestDto {
  @ApiProperty({ format: 'email', example: 'ada@example.com' })
  @IsNotEmpty()
  @IsEmail()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  email: string;

  @ApiProperty({
    description: 'Six-digit one-time code from the password-recovery email.',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'Reset code must be six digits' })
  token: string;

  @ApiProperty({
    minLength: 8,
    format: 'password',
    description:
      'At least 8 characters with an uppercase letter, a digit and a special character; at most 72 bytes (T2).',
  })
  @IsNotEmpty()
  @StrongPassword()
  newPassword: string;

  @ApiProperty({
    description: 'Stable identifier for this browser or app installation.',
  })
  @IsNotEmpty()
  @IsString()
  deviceId: string;

  @ApiPropertyOptional({ example: 'Chrome on Windows' })
  @IsOptional()
  @IsString()
  deviceName?: string;
}
