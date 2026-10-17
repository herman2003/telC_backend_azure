import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PartnerCenterItemDto {
  @ApiProperty({ example: 'dbd3e66d-4970-4b96-a095-3a99e7f5a823' })
  id: string;

  @ApiProperty({ example: 'Sprachschule Douala' })
  name: string;

  @ApiProperty({
    example: 'https://cdn.lerniqo.tech/center-logos/sprachschule.png',
  })
  logoUrl: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Douala',
    description: 'Display city when the center completed location onboarding.',
  })
  city: string | null;
}

export class PartnerCentersResponseDto {
  @ApiProperty({ type: [PartnerCenterItemDto] })
  centers: PartnerCenterItemDto[];
}
