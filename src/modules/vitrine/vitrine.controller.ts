import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { RateLimitService } from '../../shared/services/rate-limit.service';
import { DemoRequestDto } from './dto/demo-request.dto';
import {
  type DownloadEntry,
  VitrineDownloadsService,
} from './vitrine-downloads.service';
import { VitrineDemoService } from './vitrine-demo.service';

@ApiTags('Vitrine')
@Controller('api/vitrine')
export class VitrineController {
  constructor(
    private readonly downloads: VitrineDownloadsService,
    private readonly demo: VitrineDemoService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Get('downloads')
  @ApiOperation({
    summary: 'Student app download catalogue for the marketing site',
    description:
      'Returns web / Windows / macOS / Linux / Android entries. A null url means the platform is not published yet (vitrine shows “soon”).',
  })
  @ApiOkResponse({
    schema: {
      example: {
        platforms: [
          {
            id: 'web',
            url: 'https://app.lerniqo.tech',
            version: null,
            sizeLabel: null,
            minVersion: null,
          },
        ],
      },
    },
  })
  listDownloads(): { platforms: DownloadEntry[] } {
    return { platforms: this.downloads.list() };
  }

  @Post('demo-requests')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Book a sales demo from the marketing site',
    description:
      'Validates the Berlin business-hours slot, emails a confirmation to the requester (Email-DemoClient) and alerts the team (Email-DemoEquipe).',
  })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  @ApiBadRequestResponse({
    description: 'SLOT_INVALID | SLOT_OUTSIDE_WINDOW | validation errors',
  })
  @ApiTooManyRequestsResponse()
  @ApiBadGatewayResponse({ description: 'EMAIL_DELIVERY_FAILED' })
  async requestDemo(
    @Ip() ip: string,
    @Body() dto: DemoRequestDto,
  ): Promise<{ ok: true }> {
    await this.rateLimit.checkVitrineDemoRequestLimit(
      ip || 'unknown',
      dto.email,
    );
    return this.demo.requestDemo(dto);
  }
}
