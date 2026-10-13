import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { StudentSubscriptionGuard } from '../../shared/guards/student-subscription.guard';
import { CurrentStudent } from '../../shared/decorators/current-student.decorator';
import type { AccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { ModelltestsService } from './modelltests.service';
import type {
  ModelltestOfTheWeekContentDto,
  ModelltestOfTheWeekDto,
} from './dto/modelltest.dto';

/**
 * Start-only: which training Modelltest is current for the 7-day window,
 * and (separately) its full exercise content with keys.
 * Intentionally not PrepPassGuard — catalogue list/detail stay gated.
 * Guests may resolve the weekly number; they may not load keys.
 */
@UseGuards(JwtAuthGuard, StudentSubscriptionGuard)
@Controller('api/modelltests')
export class ModelltestOfTheWeekController {
  constructor(private readonly service: ModelltestsService) {}

  @Get('of-the-week')
  getOfTheWeek(
    @CurrentStudent() student: AccessTokenPayload | null,
  ): Promise<ModelltestOfTheWeekDto> {
    return this.service.getOfTheWeek(new Date(), {
      isGuest: student?.isGuest === true,
    });
  }

  @Get('of-the-week/content')
  getOfTheWeekContent(
    @CurrentStudent() student: AccessTokenPayload | null,
  ): Promise<ModelltestOfTheWeekContentDto> {
    return this.service.getOfTheWeekContent(new Date(), {
      isGuest: student?.isGuest === true,
    });
  }
}
