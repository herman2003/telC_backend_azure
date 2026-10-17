import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PartnerCentersResponseDto } from './dto/partner-centers-response.dto';
import { PartnerCentersService } from './partner-centers.service';

@ApiTags('Public')
@Controller('api/public')
export class PublicController {
  constructor(private readonly partners: PartnerCentersService) {}

  @Get('partner-centers')
  @ApiOperation({
    summary: 'Centers with logos for the marketing partners strip',
    description:
      'Unauthenticated. Returns centers that uploaded a logo (name, logoUrl, city). Empty list when none qualify — the vitrine hides the section.',
  })
  @ApiOkResponse({ type: PartnerCentersResponseDto })
  listPartnerCenters(): Promise<PartnerCentersResponseDto> {
    return this.partners.listPartners();
  }
}
