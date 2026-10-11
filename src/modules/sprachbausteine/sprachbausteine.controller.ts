import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { StudentSubscriptionGuard } from '../../shared/guards/student-subscription.guard';
import { PrepPassGuard } from '../../shared/guards/prep-pass.guard';
import { CurrentStudent } from '../../shared/decorators/current-student.decorator';
import type { AccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { SprachbausteineService } from './sprachbausteine.service';
import {
  SprachbausteineExerciseResponseDto,
  SubmitSprachbausteineResponseDto,
} from './dto';
import { SubmitSprachbausteineDto } from './dto/submit-sprachbausteine.dto';
import type { ExerciseAttemptDto } from '../writing/dto/exercise-attempt.dto';
import type { ExerciseTypeDto } from '../writing/dto/exercise-type.dto';
import { assertGuestMayAccessModelltest } from '../../shared/guest-modelltest-access';

/** Served when the caller omits ?modelltest= — keeps existing clients working. */
const DEFAULT_MODELLTEST = 1;

@UseGuards(JwtAuthGuard, StudentSubscriptionGuard, PrepPassGuard)
@ApiTags('Sprachbausteine')
@Controller('api/sprachbausteine')
export class SprachbausteineController {
  constructor(
    private readonly sprachbausteineService: SprachbausteineService,
  ) {}

  @Get('exercise')
  @ApiQuery({
    name: 'modelltest',
    required: false,
    schema: { type: 'integer', default: 1 },
    example: 1,
  })
  @ApiOkResponse({ type: SprachbausteineExerciseResponseDto })
  getExercise(
    // Declared as string on purpose. The global ValidationPipe in main.ts runs
    // with transform: true, so a `number` param has 'abc' coerced to NaN before
    // any parameter pipe sees it — DefaultValuePipe then substitutes 1 and the
    // caller silently receives Modelltest 1 instead of an error. Parsing the
    // raw string here keeps malformed input a 400. Same approach as
    // lesen.controller.ts and writing.controller.ts:69.
    @CurrentStudent() student: AccessTokenPayload | null,
    @Query('modelltest') modelltest?: string,
  ): Promise<SprachbausteineExerciseResponseDto> {
    if (modelltest === undefined || modelltest === '') {
      assertGuestMayAccessModelltest(student?.isGuest, DEFAULT_MODELLTEST);
      return this.sprachbausteineService.getExercise(DEFAULT_MODELLTEST);
    }

    if (!/^\d+$/.test(modelltest)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'modelltest query param must be a positive integer',
        messageKey: 'sprachbausteineInvalidModelltest',
      });
    }

    const number = Number(modelltest);
    assertGuestMayAccessModelltest(student?.isGuest, number);
    return this.sprachbausteineService.getExercise(number);
  }

  @Get('sessions')
  @ApiQuery({
    name: 'teilNumber',
    required: false,
    schema: { type: 'string', enum: ['1', '2'] },
  })
  async getSessions(
    @CurrentStudent() student: AccessTokenPayload | null,
    @Query('teilNumber') teilNumber?: string,
  ): Promise<ExerciseAttemptDto[]> {
    if (!student?.studentId) return [];
    const teil =
      teilNumber !== undefined ? parseInt(teilNumber, 10) : undefined;
    return this.sprachbausteineService.getSessions(student.studentId, teil);
  }

  @Get('teils')
  @ApiQuery({
    name: 'modelltest',
    required: false,
    schema: { type: 'integer', default: 1 },
    example: 1,
    description:
      'Which Modelltest progress to show. Defaults to 1. Start may only use the weekly MT without Prep Pass.',
  })
  async getTeils(
    @CurrentStudent() student: AccessTokenPayload | null,
    @Query('modelltest') modelltest?: string,
  ): Promise<ExerciseTypeDto[]> {
    if (!student?.studentId) return [];
    const number = this.parseModelltest(modelltest);
    assertGuestMayAccessModelltest(student.isGuest, number);
    return this.sprachbausteineService.getTeils(student.studentId, number);
  }

  @Post('submit')
  @ApiBody({ type: SubmitSprachbausteineDto })
  @ApiOkResponse({ type: SubmitSprachbausteineResponseDto })
  submit(
    @CurrentStudent() student: AccessTokenPayload | null,
    @Body() dto: SubmitSprachbausteineDto,
  ): Promise<SubmitSprachbausteineResponseDto> {
    if (!student?.studentId) {
      throw new UnauthorizedException('INVALID_ACCESS_TOKEN');
    }
    assertGuestMayAccessModelltest(student.isGuest, dto.modelltestNumber);
    return this.sprachbausteineService.submit(student.studentId, dto);
  }

  private parseModelltest(value?: string): number {
    if (value === undefined || value === '') return DEFAULT_MODELLTEST;
    if (!/^\d+$/.test(value) || Number(value) < 1) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'modelltest query param must be a positive integer',
        messageKey: 'sprachbausteineInvalidModelltest',
      });
    }
    return Number(value);
  }
}
