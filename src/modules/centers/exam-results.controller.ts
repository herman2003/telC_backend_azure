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
import { ExamExportService } from './exam-export.service';
import {
  ExamAttemptResultDto,
  ExamCandidateRowDto,
  RecordExamMarkDto,
  ReleaseResultsDto,
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
    private readonly exporter: ExamExportService,
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
      "Every Teil with its points out of telc's maximum, who marked it, the two halves, and the verdict. Percentages are shown; nothing is decided on them. Includes `schreibenSubmission` — the candidate's letter for MANUAL and AI sittings — so the trainer can read and download it before typing points. AI suggestions stay on `suggestions` and are never a substitute for the text.",
  })
  @ApiOkResponse({ type: ExamAttemptResultDto })
  @ApiNotFoundResponse({ type: CenterErrorResponseDto })
  attemptResult(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.results.forAttempt(attemptId, user.centerId);
  }

  @Get('exam-sessions/:sessionId/results/export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'The whole sitting as rows, for CSV or PDF',
    description:
      'Rows rather than a file: the dashboard and the app both render already, so a PDF built here would be a library and a font for nothing. Every number is finished — a client that worked one out would eventually disagree with the screen. Unpaginated on purpose: a file missing page two is not a file.',
  })
  @ApiNotFoundResponse({ type: CenterErrorResponseDto })
  exportResults(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.exporter.forSession(user.centerId, sessionId);
  }

  @Post('exam-sessions/:sessionId/results/release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Let this sitting see their results',
    description:
      'Freezes each candidate result as it stands and shows it to them. May be done more than once — the written marks now, the verdict after the oral — and releasing again replaces what they see. Refused while any mark is missing unless you send allowIncomplete, so releasing before the oral is a decision on the record.',
  })
  @ApiBadRequestResponse({
    description:
      'RESULTS_INCOMPLETE, with how many are unmarked. Send allowIncomplete to go ahead.',
  })
  @ApiNotFoundResponse({ type: CenterErrorResponseDto })
  releaseSession(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: ReleaseResultsDto,
  ) {
    return this.release.releaseSession(user, sessionId, dto);
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
    @Body() dto: ReleaseResultsDto,
  ) {
    return this.release.releaseAttempt(user, attemptId, dto);
  }

  @Put('exam-attempts/:attemptId/marks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Give a mark a person decides',
    description:
      "In telc's points (whole or half), not a percentage. Marking again replaces the mark and records who changed it. B1/B2: Schreiben and Sprechen only. A1/A2: also any automatic Teil the answer key could not decide (see `review` on the result); a Teil the server already marked cannot be changed. Gated on that Teil's own block being submitted (Sprechen has none).",
  })
  @ApiBadRequestResponse({
    description:
      'SKILL_NOT_HUMAN_MARKED, SECTION_MARKED_BY_SERVER, BLOCK_NOT_SUBMITTED, POINTS_INVALID, POINTS_ABOVE_MAXIMUM',
  })
  recordMark(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: RecordExamMarkDto,
  ) {
    return this.grading.recordMark(user, attemptId, dto);
  }
}
