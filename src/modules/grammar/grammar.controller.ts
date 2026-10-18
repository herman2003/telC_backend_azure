import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { StudentSubscriptionGuard } from '../../shared/guards/student-subscription.guard';
import { CurrentStudent } from '../../shared/decorators/current-student.decorator';
import type { AccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import {
  CompleteLessonResponseDto,
  GrammarExercisesOfTheDayDto,
  GrammarLangQueryDto,
  GrammarOfTheDayDto,
  GrammarPracticeExercisesDto,
  GrammarPracticeLevelsDto,
  GrammarPracticeProgressDto,
  GrammarPracticeQueryDto,
  GrammarPracticeSessionDto,
  SubmitGrammarExerciseDto,
  SubmitGrammarExerciseResponseDto,
  SubmitGrammarPracticeDto,
  SubmitGrammarPracticeResponseDto,
} from './dto/grammar.dto';
import { GrammarService } from './grammar.service';

@ApiTags('Grammar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StudentSubscriptionGuard)
@Controller('api/grammar')
export class GrammarController {
  constructor(private readonly grammar: GrammarService) {}

  @Get('of-the-day')
  @ApiOperation({
    summary: 'Grammar theme of the day (lesson + progress)',
    description:
      'Pass optional `lang` (fr|en|de, default fr) to localize title, rule, notes, and example glosses.',
  })
  @ApiOkResponse({ type: GrammarOfTheDayDto })
  ofTheDay(
    @CurrentStudent() student: AccessTokenPayload,
    @Query() query: GrammarLangQueryDto,
  ): Promise<GrammarOfTheDayDto> {
    return this.grammar.getOfTheDay(student.studentId, new Date(), {
      isGuest: student.isGuest === true,
      lang: query.lang,
    });
  }

  @Post('of-the-day/lesson/complete')
  @ApiOperation({ summary: 'Mark today’s lesson as read; unlock exercise 0' })
  @ApiOkResponse({ type: CompleteLessonResponseDto })
  completeLesson(
    @CurrentStudent() student: AccessTokenPayload,
  ): Promise<CompleteLessonResponseDto> {
    return this.grammar.completeLesson(student.studentId, new Date(), {
      isGuest: student.isGuest === true,
    });
  }

  @Get('levels')
  @ApiOperation({
    summary:
      'Free-practice level presets (timer hints + fixed questionCount 10/15/20)',
  })
  @ApiOkResponse({ type: GrammarPracticeLevelsDto })
  levels(): GrammarPracticeLevelsDto {
    return this.grammar.getLevels();
  }

  @Get('exercises/of-the-day')
  @ApiOperation({
    summary:
      'Today’s exercises with answers + explanation (ADR 0001); status locked|unlocked|completed',
    description:
      'Pass optional `lang` (fr|en|de, default fr) to localize prompts and explanations. Answers are included like Sprachbausteine / Lesen / practice.',
  })
  @ApiOkResponse({ type: GrammarExercisesOfTheDayDto })
  exercisesOfTheDay(
    @CurrentStudent() student: AccessTokenPayload,
    @Query() query: GrammarLangQueryDto,
  ): Promise<GrammarExercisesOfTheDayDto> {
    return this.grammar.getExercisesOfTheDay(student.studentId, new Date(), {
      isGuest: student.isGuest === true,
      lang: query.lang,
    });
  }

  @Get('exercises/practice')
  @ApiOperation({
    summary:
      'Practice QCM for today’s grammar topic only (not the full catalogue); optional difficulty filter',
    description:
      'Returns today’s topic QCMs (with answers). Optional `difficulty` = easy|medium|hard → 10 / 15 / 20 questions. Pass `lang` (fr|en|de, default fr) to localize prompt and explanation.',
  })
  @ApiOkResponse({ type: GrammarPracticeExercisesDto })
  practiceExercises(
    @CurrentStudent() student: AccessTokenPayload,
    @Query() query: GrammarPracticeQueryDto,
  ): Promise<GrammarPracticeExercisesDto> {
    return this.grammar.getPracticeExercises(query.difficulty, {
      lang: query.lang,
      isGuest: student.isGuest === true,
      studentId: student.studentId,
    });
  }

  @Post('practice/submit')
  @ApiOperation({
    summary:
      'Submit a free-practice session (no of-the-day locks); persists score like other training modules',
  })
  @ApiOkResponse({ type: SubmitGrammarPracticeResponseDto })
  submitPractice(
    @CurrentStudent() student: AccessTokenPayload,
    @Body() body: SubmitGrammarPracticeDto,
  ): Promise<SubmitGrammarPracticeResponseDto> {
    return this.grammar.submitPractice(student.studentId, body, {
      isGuest: student.isGuest === true,
    });
  }

  @Get('practice/sessions')
  @ApiOperation({ summary: 'Free-practice session history for the student' })
  @ApiOkResponse({ type: [GrammarPracticeSessionDto] })
  practiceSessions(
    @CurrentStudent() student: AccessTokenPayload,
  ): Promise<GrammarPracticeSessionDto[]> {
    if (student.isGuest === true) {
      return Promise.resolve([]);
    }
    return this.grammar.getPracticeSessions(student.studentId);
  }

  @Get('practice/progress')
  @ApiOperation({
    summary: 'Free-practice progress summary (count, average, last session)',
  })
  @ApiOkResponse({ type: GrammarPracticeProgressDto })
  practiceProgress(
    @CurrentStudent() student: AccessTokenPayload,
  ): Promise<GrammarPracticeProgressDto> {
    if (student.isGuest === true) {
      return Promise.resolve({
        attemptCount: 0,
        averageScore: null,
        lastAttempt: null,
      });
    }
    return this.grammar.getPracticeProgress(student.studentId);
  }

  @Post('exercises/:exerciseId/submit')
  @ApiOperation({
    summary: 'Submit an answer; requires success to unlock next',
    description:
      'Pass optional `lang` (fr|en|de, default fr) to localize the explanation.',
  })
  @ApiOkResponse({ type: SubmitGrammarExerciseResponseDto })
  @ApiConflictResponse({ description: 'GRAMMAR_STEP_LOCKED' })
  submit(
    @CurrentStudent() student: AccessTokenPayload,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
    @Body() body: SubmitGrammarExerciseDto,
    @Query() query: GrammarLangQueryDto,
  ): Promise<SubmitGrammarExerciseResponseDto> {
    return this.grammar.submitExercise(
      student.studentId,
      exerciseId,
      body.answer,
      new Date(),
      { isGuest: student.isGuest === true, lang: query.lang },
    );
  }

  @Get('topics/:topicId')
  @ApiOperation({
    summary: 'Today’s topic by UUID (404 if not today)',
    description:
      'Pass optional `lang` (fr|en|de, default fr) to localize the topic payload.',
  })
  @ApiOkResponse({ type: GrammarOfTheDayDto })
  topicById(
    @CurrentStudent() student: AccessTokenPayload,
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Query() query: GrammarLangQueryDto,
  ): Promise<GrammarOfTheDayDto> {
    return this.grammar.getTopicById(student.studentId, topicId, new Date(), {
      isGuest: student.isGuest === true,
      lang: query.lang,
    });
  }
}
