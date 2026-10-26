import { Controller, Get, Ip } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { RateLimitService } from '../../shared/services/rate-limit.service';
import { PartnerCentersResponseDto } from './dto/partner-centers-response.dto';
import { PartnerCentersService } from './partner-centers.service';

@ApiTags('Public')
@Controller('api/public')
export class PublicController {
  constructor(
    private readonly partners: PartnerCentersService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Get('partner-centers')
  @ApiOperation({
    summary: 'Centers with logos for the marketing partners strip',
    description:
      'Unauthenticated. Returns centers that uploaded a logo (name, logoUrl, city). Empty list when none qualify — the vitrine hides the section. IP rate-limited.',
  })
  @ApiOkResponse({ type: PartnerCentersResponseDto })
  @ApiTooManyRequestsResponse({ description: 'RATE_LIMIT_EXCEEDED' })
  async listPartnerCenters(
    @Ip() ip: string,
  ): Promise<PartnerCentersResponseDto> {
    await this.rateLimit.checkPartnerCentersLimit(ip || 'unknown');
    return this.partners.listPartners();
  }
}
