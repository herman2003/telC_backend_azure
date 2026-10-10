import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type DownloadEntry,
  VitrineDownloadsService,
} from './vitrine-downloads.service';

@ApiTags('Vitrine')
@Controller('api/vitrine')
export class VitrineController {
  constructor(private readonly downloads: VitrineDownloadsService) {}

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
          {
            id: 'windows',
            url: null,
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
}
