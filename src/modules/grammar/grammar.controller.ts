import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
  GrammarOfTheDayDto,
  SubmitGrammarExerciseDto,
  SubmitGrammarExerciseResponseDto,
} from './dto/grammar.dto';
import { GrammarService } from './grammar.service';

@ApiTags('Grammar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StudentSubscriptionGuard)
@Controller('api/grammar')
export class GrammarController {
  constructor(private readonly grammar: GrammarService) {}

  @Get('of-the-day')
  @ApiOperation({ summary: 'Grammar theme of the day (lesson + progress)' })
  @ApiOkResponse({ type: GrammarOfTheDayDto })
  ofTheDay(
    @CurrentStudent() student: AccessTokenPayload,
  ): Promise<GrammarOfTheDayDto> {
    return this.grammar.getOfTheDay(student.studentId);
  }

  @Post('of-the-day/lesson/complete')
  @ApiOperation({ summary: 'Mark today’s lesson as read; unlock exercise 0' })
  @ApiOkResponse({ type: CompleteLessonResponseDto })
  completeLesson(
    @CurrentStudent() student: AccessTokenPayload,
  ): Promise<CompleteLessonResponseDto> {
    return this.grammar.completeLesson(student.studentId);
  }

  @Get('exercises/of-the-day')
  @ApiOperation({
    summary: 'Today’s exercises (no answers); status locked|unlocked|completed',
  })
  @ApiOkResponse({ type: GrammarExercisesOfTheDayDto })
  exercisesOfTheDay(
    @CurrentStudent() student: AccessTokenPayload,
  ): Promise<GrammarExercisesOfTheDayDto> {
    return this.grammar.getExercisesOfTheDay(student.studentId);
  }

  @Post('exercises/:exerciseId/submit')
  @ApiOperation({
    summary: 'Submit an answer; requires success to unlock next',
  })
  @ApiOkResponse({ type: SubmitGrammarExerciseResponseDto })
  @ApiConflictResponse({ description: 'GRAMMAR_STEP_LOCKED' })
  submit(
    @CurrentStudent() student: AccessTokenPayload,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
    @Body() body: SubmitGrammarExerciseDto,
  ): Promise<SubmitGrammarExerciseResponseDto> {
    return this.grammar.submitExercise(
      student.studentId,
      exerciseId,
      body.answer,
    );
  }

  @Get('topics/:topicId')
  @ApiOperation({ summary: 'Today’s topic by UUID (404 if not today)' })
  @ApiOkResponse({ type: GrammarOfTheDayDto })
  topicById(
    @CurrentStudent() student: AccessTokenPayload,
    @Param('topicId', ParseUUIDPipe) topicId: string,
  ): Promise<GrammarOfTheDayDto> {
    return this.grammar.getTopicById(student.studentId, topicId);
  }
}
