import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PrepTipsService } from './prep-tips.service';
import { PrepTipDto, PrepTipSummaryDto } from './dto/prep-tip.dto';

@ApiTags('Prep tips')
@ApiBearerAuth()
@Controller('api/prep-tips')
@UseGuards(JwtAuthGuard)
export class PrepTipsController {
  constructor(private readonly tips: PrepTipsService) {}

  @Get()
  @ApiOperation({
    summary: 'List micro-lesson tip sheets (one per telc Teil)',
    description:
      'Short strategy/trap cards for Start students. Free; does not replace Prep Pass content.',
  })
  @ApiOkResponse({ type: [PrepTipSummaryDto] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  list(): PrepTipSummaryDto[] {
    return this.tips.list();
  }

  @Get(':skill/:teil')
  @ApiOperation({ summary: 'Get one tip sheet by skill + Teil' })
  @ApiOkResponse({ type: PrepTipDto })
  @ApiNotFoundResponse({ description: 'Unknown skill/teil combination' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  get(@Param('skill') skill: string, @Param('teil') teil: string): PrepTipDto {
    return this.tips.get(skill, teil);
  }
}
