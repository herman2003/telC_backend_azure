import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
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
import { ExamSessionsService } from './exam-sessions.service';
import { ExamParticipantsService } from './exam-participants.service';
import {
  CreateExamSessionDto,
  EligibleStudentListDto,
  EligibleStudentsQueryDto,
  ExamSessionDto,
  ExamSessionListDto,
  ListExamSessionsQueryDto,
  PublishExamSessionResultDto,
  ReopenExamSessionDto,
  SetParticipantsDto,
  SetParticipantsResultDto,
  UpdateExamSessionDto,
} from './dto/exam-sessions.dto';

/**
 * The center manager's half of the exam simulator: creating a sitting,
 * choosing who may take it, and publishing it.
 *
 * Every route is scoped to the center in the token. There is no route that
 * names a center, and a sitting belonging to another school answers 404
 * rather than 403 — a 403 would confirm the id exists.
 */
@ApiTags('Center Exam Sessions')
@ApiBearerAuth()
@Controller('api/centers/me/exam-sessions')
@UseFilters(CenterExceptionFilter)
@UseGuards(CenterAuthGuard)
export class ExamSessionsController {
  constructor(
    private readonly sessions: ExamSessionsService,
    private readonly participants: ExamParticipantsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a draft sitting',
    description:
      'Steps 1, 2 and 4 of the wizard. The closing time is computed from the access window; a client never sends it. Nothing is published and no slot is spent.',
  })
  @ApiOkResponse({ type: ExamSessionDto })
  @ApiBadRequestResponse({ type: CenterErrorResponseDto })
  @ApiUnauthorizedResponse({ type: CenterErrorResponseDto })
  create(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Body() dto: CreateExamSessionDto,
  ) {
    return this.sessions.create(user, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List this center sittings, newest first',
    description: 'The dashboard. Each carries its derived status and count.',
  })
  @ApiOkResponse({ type: ExamSessionListDto })
  list(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Query() query: ListExamSessionsQueryDto,
  ) {
    return this.sessions.list(user, query);
  }

  @Get(':sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'One sitting' })
  @ApiOkResponse({ type: ExamSessionDto })
  @ApiNotFoundResponse({ type: CenterErrorResponseDto })
  get(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessions.get(user, sessionId);
  }

  @Patch(':sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change a sitting that has not opened',
    description:
      'Publishing is not a freeze: a scheduled sitting may still be changed. Once it opens, somebody may be sitting it, and the answer is EXAM_ALREADY_OPEN.',
  })
  @ApiOkResponse({ type: ExamSessionDto })
  @ApiBadRequestResponse({ type: CenterErrorResponseDto })
  update(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: UpdateExamSessionDto,
  ) {
    return this.sessions.update(user, sessionId, dto);
  }

  @Get(':sessionId/eligible-students')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Who this center may admit',
    description:
      'Step 3 of the wizard. Marks who is already in, and who has already worked on this Modelltest in training — a student who practised it has seen the answers.',
  })
  @ApiOkResponse({ type: EligibleStudentListDto })
  eligibleStudents(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Query() query: EligibleStudentsQueryDto,
  ) {
    return this.participants.listEligible(user, sessionId, query);
  }

  @Put(':sessionId/participants')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set the admitted list',
    description:
      'The whole list, not a delta. Free while the sitting is a draft; on a published sitting each candidate added spends a slot, and removing one refunds nothing.',
  })
  @ApiOkResponse({ type: SetParticipantsResultDto })
  @ApiBadRequestResponse({ type: CenterErrorResponseDto })
  setParticipants(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: SetParticipantsDto,
  ) {
    return this.participants.setParticipants(user, sessionId, dto.studentIds);
  }

  @Post(':sessionId/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Publish the sitting',
    description:
      'Spends one exam slot per admitted candidate, in the same transaction. Publishing does not open the exam: it opens itself at the opening time.',
  })
  @ApiOkResponse({ type: PublishExamSessionResultDto })
  @ApiBadRequestResponse({ type: CenterErrorResponseDto })
  @ApiConflictResponse({ type: CenterErrorResponseDto })
  publish(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.participants.publish(user, sessionId);
  }

  @Post(':sessionId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Call the sitting off',
    description:
      'Never a delete: it was published, students were told, and somebody may ask later why it did not happen.',
  })
  @ApiOkResponse({ type: ExamSessionDto })
  cancel(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessions.cancel(user, sessionId);
  }

  @Post(':sessionId/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stop admitting candidates now',
    description: 'Before the window was due to end. The center exam, the center call.',
  })
  @ApiOkResponse({ type: ExamSessionDto })
  close(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessions.closeNow(user, sessionId);
  }

  @Post(':sessionId/reopen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Give a lapsed sitting another window',
    description: 'Counted from now. For the candidate who missed it.',
  })
  @ApiOkResponse({ type: ExamSessionDto })
  reopen(
    @CurrentCenterUser() user: CenterAccessTokenPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: ReopenExamSessionDto,
  ) {
    return this.sessions.reopen(user, sessionId, dto.accessWindowHours);
  }
}
