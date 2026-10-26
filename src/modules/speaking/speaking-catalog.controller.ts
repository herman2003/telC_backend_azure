import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiQuery,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { StudentSubscriptionGuard } from '../../shared/guards/student-subscription.guard';
import { AccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { SpeakingService } from './services/speaking.service';
import type { TeilListItemDto, SessionHistoryItemDto } from './dto';
import { SpeakingExerciseResponseDto } from './dto/speaking-exercise-response.dto';
import { assertGuestMayAccessModelltest } from '../../shared/guest-modelltest-access';

/**
 * Catalog endpoints for Sprechen: exercise (A1/A2), list of Teils and session history.
 * GET /api/speaking/exercise, GET /api/speaking/teils, GET /api/speaking/sessions
 */
@ApiTags('Speaking')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@UseGuards(JwtAuthGuard, StudentSubscriptionGuard)
@Controller('api/speaking')
export class SpeakingCatalogController {
  constructor(private readonly speakingService: SpeakingService) {}

  @Get('exercise')
  @ApiOperation({
    summary: 'Get the Sprechen exercise for a given Modelltest number (A1/A2)',
    description:
      'Returns generic SPRECHEN sections for A1/A2 Modelltests. ' +
      'For B1/B2 use GET /api/speaking/teils instead.',
  })
  @ApiQuery({
    name: 'modelltest',
    required: true,
    description: 'Modelltest number (e.g. 9 for A1)',
    example: 9,
  })
  @ApiOkResponse({ type: SpeakingExerciseResponseDto })
  @ApiNotFoundResponse({
    description:
      'No generic Sprechen exercise for this Modelltest (B1/B2 or missing content)',
  })
  @ApiBadRequestResponse({
    description: 'modelltest query param is missing or not a number',
  })
  async getExerciseByModelltest(
    @Request() req: { student?: AccessTokenPayload },
    @Query('modelltest') modelltest: string,
  ): Promise<SpeakingExerciseResponseDto> {
    const number = parseInt(modelltest, 10);
    if (!modelltest || isNaN(number)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'modelltest query param is required and must be a number',
        messageKey: 'speakingMissingModelltest',
      });
    }
    assertGuestMayAccessModelltest(req.student?.isGuest, number);
    return this.speakingService.getExerciseByModelltest(number);
  }

  /**
   * GET /api/speaking/teils
   * Returns the list of 3 Teils (metadata for list/detail screens).
   */
  @Get('teils')
  getTeils(
    @Request() req: { student?: AccessTokenPayload },
    @Query('modelltest') modelltest?: string,
  ): Promise<TeilListItemDto[]> {
    return this.speakingService.getTeils(
      this.parseModelltest(modelltest),
      req.student?.studentId,
    );
  }

  /**
   * GET /api/speaking/sessions
   * Returns session history for the authenticated student.
   * Query: teilNumber (1|2|3), limit (default 50).
   */
  @Get('sessions')
  async getSessions(
    @Request() req: { student: AccessTokenPayload },
    @Query('teilNumber') teilNumber?: string,
    @Query('limit') limitStr?: string,
  ): Promise<SessionHistoryItemDto[]> {
    const studentId = req.student?.studentId;
    if (!studentId) {
      return [];
    }
    const teil = teilNumber ? parseInt(teilNumber, 10) : undefined;
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    return this.speakingService.getSessions(studentId, teil, limit);
  }

  private parseModelltest(value?: string): number {
    if (value === undefined || value === '') return 1;
    if (!/^\d+$/.test(value) || Number(value) < 1) {
      throw new BadRequestException(
        'modelltest query param must be a positive integer',
      );
    }
    return Number(value);
  }
}
