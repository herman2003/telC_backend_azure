import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { StudentSubscriptionGuard } from '../../shared/guards/student-subscription.guard';
import { CurrentStudent } from '../../shared/decorators/current-student.decorator';
import type { AccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { ModelltestsService } from './modelltests.service';
import type { ModelltestOfTheWeekDto } from './dto/modelltest.dto';

/**
 * Start-only: which training Modelltest is current for the 7-day window.
 * Intentionally not PrepPassGuard — catalogue list/detail stay gated.
 * Guests rotate only among demo-allowlisted Modelltests.
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
}
