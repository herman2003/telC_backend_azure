import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { StudentSubscriptionGuard } from '../../shared/guards/student-subscription.guard';
import { CurrentStudent } from '../../shared/decorators/current-student.decorator';
import type { AccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import {
  UpdateVocabProgressDto,
  VocabEntryCardDto,
  VocabLangQueryDto,
  VocabOfTheWeekDto,
  VocabProgressSummaryDto,
  VocabSearchQueryDto,
} from './dto/vocab.dto';
import { VocabService } from './vocab.service';

@ApiTags('Vocab')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StudentSubscriptionGuard)
@Controller('api/vocab')
export class VocabController {
  constructor(private readonly vocab: VocabService) {}

  @Get('of-the-week')
  @ApiOperation({
    summary: 'Weekly vocab pack (100 key lemmas, 5 natures)',
  })
  @ApiOkResponse({ type: VocabOfTheWeekDto })
  ofTheWeek(
    @CurrentStudent() student: AccessTokenPayload,
    @Query() query: VocabLangQueryDto,
  ): Promise<VocabOfTheWeekDto> {
    return this.vocab.getOfTheWeek(student.studentId, new Date(), {
      isGuest: student.isGuest === true,
      lang: query.lang,
    });
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search catalogue lemmas (no add — Wordchat lookup)',
  })
  @ApiOkResponse({ type: [VocabEntryCardDto] })
  search(@Query() query: VocabSearchQueryDto): Promise<VocabEntryCardDto[]> {
    const limit = query.limit ? Number(query.limit) : 20;
    return this.vocab.search(query.q, {
      pos: query.pos,
      limit: Number.isFinite(limit) ? limit : 20,
      lang: query.lang,
    });
  }

  @Get('me/progress')
  @ApiOperation({ summary: 'Vocab progress counts for the student' })
  @ApiOkResponse({ type: VocabProgressSummaryDto })
  meProgress(
    @CurrentStudent() student: AccessTokenPayload,
  ): Promise<VocabProgressSummaryDto> {
    return this.vocab.getMyProgress(student.studentId, {
      isGuest: student.isGuest === true,
    });
  }

  @Get('entries/:entryId')
  @ApiOperation({
    summary: 'Vocab entry detail (senses + conjugation if verb)',
  })
  @ApiOkResponse({ type: VocabEntryCardDto })
  entry(
    @CurrentStudent() student: AccessTokenPayload,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Query() query: VocabLangQueryDto,
  ): Promise<VocabEntryCardDto> {
    return this.vocab.getEntry(student.studentId, entryId, {
      isGuest: student.isGuest === true,
      lang: query.lang,
    });
  }

  @Put('entries/:entryId/progress')
  @ApiOperation({ summary: 'Mark entry learning | known' })
  updateProgress(
    @CurrentStudent() student: AccessTokenPayload,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() body: UpdateVocabProgressDto,
  ): Promise<{ status: string }> {
    return this.vocab.updateProgress(student.studentId, entryId, body, {
      isGuest: student.isGuest === true,
    });
  }
}
