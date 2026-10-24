import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
  IsTimeZone,
} from 'class-validator';
export class RegisterPushDto {
  @ApiProperty({ enum: ['FCM'] }) @IsIn(['FCM']) transport: 'FCM';
  @ApiProperty({ enum: ['ANDROID', 'IOS', 'MACOS', 'WEB', 'IOS_WEB'] })
  @IsIn(['ANDROID', 'IOS', 'MACOS', 'WEB', 'IOS_WEB'])
  platform: string;
  @ApiProperty({ writeOnly: true })
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  fcmToken: string;
  @ApiProperty() @IsString() @MaxLength(100) firebaseProjectId: string;
  @ApiProperty({ enum: ['de', 'fr', 'en'] })
  @IsIn(['de', 'fr', 'en'])
  locale: string;
  @ApiProperty({ example: 'Europe/Berlin' }) @IsTimeZone() timezone: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(50) appVersion: string;
  @ApiProperty({ enum: ['GRANTED'] }) @IsIn(['GRANTED']) permission: 'GRANTED';
  @ApiProperty() @IsBoolean() backgroundCapable: boolean;
}
export class PushPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  transactionalEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsTimeZone() timezone?: string;
  @ApiPropertyOptional({ example: '21:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  quietStart?: string;
  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  quietEnd?: string;
}

export class PushEndpointResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ['ANDROID', 'IOS', 'MACOS', 'WEB', 'IOS_WEB'] })
  platform: string;
  @ApiProperty({ enum: ['GRANTED'] }) permission: string;
}
export class PushPreferencesResponseDto {
  @ApiProperty() transactionalEnabled: boolean;
  @ApiProperty({ example: 'Europe/Berlin' }) timezone: string;
  @ApiProperty({ example: '21:00' }) quietStart: string;
  @ApiProperty({ example: '08:00' }) quietEnd: string;
}
