import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CenterAccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { CenterExceptionFilter } from './center-exception.filter';
import { CurrentCenterUser } from './decorators/current-center-user.decorator';
import { CenterErrorResponseDto } from './dto/center-error-response.dto';
import {
  ExamModelltestContentDto,
  ExamModelltestDto,
} from './dto/exam-modelltests.dto';
import { ExamModelltestsService } from './exam-modelltests.service';
import { CenterAuthGuard } from './guards/center-auth.guard';

@ApiTags('Center Exam Modelltests')
@ApiBearerAuth()
@Controller('api/centers/me/exam-modelltests')
@UseFilters(CenterExceptionFilter)
@UseGuards(CenterAuthGuard)
export class ExamModelltestsController {
  constructor(private readonly catalogue: ExamModelltestsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List complete Modelltests available for a paid exam',
    description:
      'Requires at least one confirmed, unspent MANUAL or AI exam slot. Payment intents do not unlock the catalogue.',
  })
  @ApiOkResponse({ type: [ExamModelltestDto] })
  @ApiForbiddenResponse({
    type: CenterErrorResponseDto,
    description: 'EXAM_SLOTS_REQUIRED',
  })
  @ApiUnauthorizedResponse({ type: CenterErrorResponseDto })
  list(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
  ): Promise<ExamModelltestDto[]> {
    return this.catalogue.list(user);
  }

  @Get(':number')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Full Modelltest content for manager preview (no answer keys)',
    description:
      'Loads the real `modelltests` row by number (same completeness rules as the catalogue). Returns Lesen, Sprachbausteine, Hören, Schreiben and Sprechen content with answer keys stripped. Requires an exam slot, same as the list.',
  })
  @ApiOkResponse({ type: ExamModelltestContentDto })
  @ApiForbiddenResponse({
    type: CenterErrorResponseDto,
    description: 'EXAM_SLOTS_REQUIRED',
  })
  @ApiNotFoundResponse({
    type: CenterErrorResponseDto,
    description: 'MODELLTEST_NOT_FOUND',
  })
  @ApiUnauthorizedResponse({ type: CenterErrorResponseDto })
  getContent(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('number', ParseIntPipe) number: number,
  ): Promise<ExamModelltestContentDto> {
    return this.catalogue.getContent(user, number);
  }
}
