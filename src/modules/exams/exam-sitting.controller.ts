import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { ExamBlock } from '@prisma/client';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentStudent } from '../../shared/decorators/current-student.decorator';
import type { AccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { ExamSittingService } from '../centers/exam-sitting.service';
import { ExamBlockContentService } from '../centers/exam-block-content.service';
import { ExamScoringService } from '../centers/exam-scoring.service';
import { ExamAudioService } from '../centers/exam-audio.service';
import { ExamReleaseService } from '../centers/exam-release.service';
import { EvaluationService } from '../speaking/services/evaluation.service';
import {
  ExamBlockTimerDto,
  ExamSpeakingDto,
  SaveExamAnswersDto,
  SubmitExamBlockDto,
  SubmitExamBlockResultDto,
} from './dto/exam-sitting.dto';

/**
 * A candidate sitting an exam.
 *
 * Deliberately NOT behind `StudentSubscriptionGuard`, unlike every other
 * learning route. The center already paid for this candidate's place when it
 * published the sitting, and refusing them because the school's monthly plan
 * lapsed would take the exam fee and grant nothing. The participant row is
 * the access rule here — see `ExamSittingService.start`.
 */
@ApiTags('Exams')
@ApiBearerAuth()
@Controller('api/exams')
@UseGuards(JwtAuthGuard)
export class ExamSittingController {
  constructor(
    private readonly sitting: ExamSittingService,
    private readonly content: ExamBlockContentService,
    private readonly scoring: ExamScoringService,
    private readonly audio: ExamAudioService,
    private readonly release: ExamReleaseService,
    private readonly speaking: EvaluationService,
  ) {}

  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'The exam sittings I am admitted to',
    description:
      'Only sittings a center admitted this student to. Each carries its status, so the app can say "opens on 5 October" rather than showing a button that fails — and its `gradingTier`: on AI the sitting will ask the candidate to speak Teil by Teil and send the transcript, on MANUAL nothing about Sprechen touches the app because it happens in the room.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  mySessions(@CurrentStudent() student: AccessTokenPayload) {
    return this.sitting.mySessions(student.studentId);
  }

  @Get('attempts/:attemptId/result')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'My result, once my center has released it',
    description:
      'Exactly what was released and nothing more — a snapshot, so a re-mark cannot change a verdict under me between two refreshes. Until the center releases, this answers RESULT_NOT_RELEASED: the exam has no result as far as I am concerned.',
  })
  @ApiBadRequestResponse({ description: 'RESULT_NOT_RELEASED' })
  @ApiNotFoundResponse({ description: 'EXAM_ATTEMPT_NOT_FOUND' })
  myResult(
    @CurrentStudent() student: AccessTokenPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.release.forStudent(student.studentId, attemptId);
  }

  @Post('sessions/:sessionId/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Begin the exam, or return the attempt already begun',
    description:
      'Refused unless the sitting is open and this student was admitted to it. Called twice, it returns the same attempt: an exam you can restart is not an exam.',
  })
  @ApiBadRequestResponse({ description: 'EXAM_NOT_OPEN' })
  @ApiNotFoundResponse({ description: 'NOT_A_PARTICIPANT' })
  start(
    @CurrentStudent() student: AccessTokenPayload,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sitting.start(student.studentId, sessionId);
  }

  @Get('attempts/:attemptId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Where I am in the exam',
    description:
      'Every block with its state and the time left, plus the server clock. This is what a reload calls: nothing is lost and nothing is given back. It also carries `gradingTier`, which is what decides whether to draw the Sprechen step at all: only an AI sitting has one, and POST attempts/{id}/speaking refuses on a MANUAL one with EXAM_TIER_WITHOUT_AI.',
  })
  @ApiNotFoundResponse({ description: 'EXAM_ATTEMPT_NOT_FOUND' })
  getAttempt(
    @CurrentStudent() student: AccessTokenPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.sitting.getAttempt(student.studentId, attemptId);
  }

  @Post('attempts/:attemptId/blocks/:block/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start a timed block, or resume it',
    description:
      'Returns an absolute deadline and the server clock. Called again after a refresh it returns the SAME deadline — issuing a fresh one would hand back the time already spent.',
  })
  @ApiOkResponse({ type: ExamBlockTimerDto })
  @ApiBadRequestResponse({
    description:
      'BLOCK_OUT_OF_ORDER, BLOCK_IN_PROGRESS, BLOCK_ALREADY_SUBMITTED',
  })
  startBlock(
    @CurrentStudent() student: AccessTokenPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Param('block') block: ExamBlock,
  ) {
    return this.sitting.startBlock(student.studentId, attemptId, block);
  }

  @Get('attempts/:attemptId/blocks/:block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'The questions for a block I have started',
    description:
      'The same questions training serves, with every answer removed, plus whatever I have already saved. Only for a block that is running: the whole exam at once would let Schreiben be read during the time meant for Lesen.',
  })
  @ApiBadRequestResponse({ description: 'BLOCK_NOT_STARTED' })
  blockContent(
    @CurrentStudent() student: AccessTokenPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Param('block') block: ExamBlock,
  ) {
    return this.content.getBlockContent(student.studentId, attemptId, block);
  }

  @Post('attempts/:attemptId/audio/:audioId/play')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Spend one play of a Hoeren recording',
    description:
      'Returns a signed link, valid for about twice the recording length so a slow download does not cost the play. Call it before every play and never fall back to a bundled file: telc allows one play because the repeat is inside the recording.',
  })
  @ApiBadRequestResponse({ description: 'NO_PLAYS_LEFT, BLOCK_NOT_STARTED' })
  playAudio(
    @CurrentStudent() student: AccessTokenPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Param('audioId', ParseUUIDPipe) audioId: string,
  ) {
    return this.audio.play(student.studentId, attemptId, audioId);
  }

  @Post('attempts/:attemptId/speaking')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'An AI speaking session inside the exam (1,500 tier only)',
    description:
      'Transcribed on the device and sent as text; no audio reaches the server. The evaluation is a second opinion for the examiner, never a mark: the oral that counts happened in the center, and somebody types that score. Refused on a sitting the center did not buy it for.',
  })
  @ApiBadRequestResponse({ description: 'EXAM_TIER_WITHOUT_AI' })
  @ApiNotFoundResponse({ description: 'EXAM_ATTEMPT_NOT_FOUND' })
  async examSpeaking(
    @CurrentStudent() student: AccessTokenPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: ExamSpeakingDto,
  ) {
    const { modelltestNumber, gradingTier } =
      await this.sitting.attemptContextFor(student.studentId, attemptId);

    // What the center bought decides this, not the request. A manual sitting
    // running the model would be a bill nobody agreed to.
    if (gradingTier !== 'AI') {
      throw new BadRequestException('EXAM_TIER_WITHOUT_AI');
    }

    return this.speaking.evaluateTranscript(
      student.studentId,
      dto.teilNumber,
      dto.transcript,
      { modelltestNumber, examAttemptId: attemptId },
    );
  }

  @Put('attempts/:attemptId/blocks/:block/answers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Save what I have answered so far',
    description:
      'Call it as the candidate works, so a crash costs seconds rather than ninety minutes. Refused once the deadline passes — but what was saved before it is what gets marked.',
  })
  @ApiBadRequestResponse({ description: 'BLOCK_EXPIRED' })
  saveAnswers(
    @CurrentStudent() student: AccessTokenPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Param('block') block: ExamBlock,
    @Body() dto: SaveExamAnswersDto,
  ) {
    return this.sitting.saveAnswers(
      student.studentId,
      attemptId,
      block,
      dto.answers,
    );
  }

  @Post('attempts/:attemptId/blocks/:block/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Close a block and mark it',
    description:
      'A submit arriving after the deadline is accepted, but marked on the answers saved in time — refusing would leave the block unscored for ever, and accepting late answers would hand back time nobody had.',
  })
  @ApiOkResponse({ type: SubmitExamBlockResultDto })
  @ApiBadRequestResponse({ description: 'BLOCK_ALREADY_SUBMITTED' })
  async submitBlock(
    @CurrentStudent() student: AccessTokenPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Param('block') block: ExamBlock,
    @Body() dto: SubmitExamBlockDto,
  ): Promise<SubmitExamBlockResultDto> {
    const submitted = await this.sitting.submitBlock(
      student.studentId,
      attemptId,
      block,
      dto.answers,
    );
    const { modelltestId, modelltestNumber, gradingTier, level } =
      await this.sitting.attemptContextFor(student.studentId, attemptId);

    // Marked on what the submit settled on, never on the request body: a late
    // submit keeps the answers saved before the deadline.
    //
    // Marking is not in the same transaction as the close, so it is made
    // repeatable instead — `scoreBlock` clears this attempt's rows for these
    // skills first. If marking fails here the block is already closed, and
    // the operator can re-run it without doubling every Teil. Left as it was,
    // a failure made a block permanently submitted and permanently unscored.
    const sections = await this.scoring.scoreBlock({
      attemptId,
      studentId: student.studentId,
      modelltestId,
      modelltestNumber,
      gradingTier,
      level,
      block,
      answers: submitted.answers as Record<string, Record<string, unknown>>,
    });

    return {
      block: submitted.block,
      submittedAt: submitted.submittedAt,
      late: submitted.late,
      sections,
    };
  }
}
