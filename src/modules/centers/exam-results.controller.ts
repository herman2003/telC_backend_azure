import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CenterAccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { CenterExceptionFilter } from './center-exception.filter';
import { CurrentCenterUser } from './decorators/current-center-user.decorator';
import { CenterAuthGuard } from './guards/center-auth.guard';
import { CenterErrorResponseDto } from './dto/center-error-response.dto';
import { ExamResultService } from './exam-result.service';
import { ExamGradingService } from './exam-grading.service';
import { ExamReleaseService } from './exam-release.service';
import {
  ExamCandidateRowDto,
  RecordExamMarkDto,
} from './dto/exam-results.dto';

/**
 * Results, as the center reads and completes them.
 *
 * Every route is scoped to the center in the token. Of everything in this
 * feature, another school's marks are the worst thing to hand out, so the
 * scoping happens in the query rather than in a check afterwards.
 */
@ApiTags('Center Exam Results')
@ApiBearerAuth()
@Controller('api/centers/me')
@UseFilters(CenterExceptionFilter)
@UseGuards(CenterAuthGuard)
export class ExamResultsController {
  constructor(
    private readonly results: ExamResultService,
    private readonly grading: ExamGradingService,
    private readonly release: ExamReleaseService,
  ) {}

  @Get('exam-sessions/:sessionId/results')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Every candidate in one sitting',
    description:
      'One row each, including those who never turned up. Six queries whatever the size of the school. INCOMPLETE means a human mark is still missing, never that the candidate failed.',
  })
  @ApiOkResponse({ type: [ExamCandidateRowDto] })
  @ApiNotFoundResponse({ type: CenterErrorResponseDto })
  @ApiUnauthorizedResponse({ type: CenterErrorResponseDto })
  sessionResults(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.results.forSession(user.centerId, sessionId);
  }

  @Get('exam-attempts/:attemptId/result')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'One candidate, Teil by Teil',
    description:
      "Every Teil with its points out of telc's maximum, who marked it, the two halves, and the verdict. Percentages are shown; nothing is decided on them.",
  })
  @ApiNotFoundResponse({ type: CenterErrorResponseDto })
  attemptResult(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.results.forAttempt(attemptId, user.centerId);
  }

  @Post('exam-sessions/:sessionId/results/release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Let this sitting see their results',
    description:
      'Freezes each candidate result as it stands and shows it to them. May be done more than once — the written marks now, the verdict after the oral — and releasing again replaces what they see. An incomplete result is released if you ask for it: "you passed the written half" is worth telling somebody a week before the oral is marked.',
  })
  @ApiNotFoundResponse({ type: CenterErrorResponseDto })
  releaseSession(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.release.releaseSession(user, sessionId);
  }

  @Post('exam-attempts/:attemptId/results/release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Let one candidate see their result',
    description: 'For the late oral, or a mark corrected after a complaint.',
  })
  @ApiNotFoundResponse({ type: CenterErrorResponseDto })
  releaseAttempt(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.release.releaseAttempt(user, attemptId);
  }

  @Put('exam-attempts/:attemptId/marks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Give a Schreiben or Sprechen mark',
    description:
      "In telc's points, not a percentage. Marking again replaces the mark and records who changed it. The other three skills were marked against an answer key and are refused here.",
  })
  @ApiBadRequestResponse({
    description: 'SKILL_NOT_HUMAN_MARKED, POINTS_ABOVE_MAXIMUM, EXAM_NOT_FINISHED',
  })
  recordMark(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: RecordExamMarkDto,
  ) {
    return this.grading.recordMark(user, attemptId, dto);
  }
}
