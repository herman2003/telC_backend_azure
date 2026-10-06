import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { StudentSubscriptionGuard } from '../../shared/guards/student-subscription.guard';
import { PrepPassGuard } from '../../shared/guards/prep-pass.guard';
import { ModelltestsService } from './modelltests.service';
import type {
  ModelltestDetailDto,
  ModelltestListItemDto,
} from './dto/modelltest.dto';

/**
 * Prep Pass training catalogue. Start subscription is still required (seat),
 * and an active Prep Pass unlocks the series.
 */
@UseGuards(JwtAuthGuard, StudentSubscriptionGuard, PrepPassGuard)
@Controller('api/modelltests')
export class ModelltestsController {
  constructor(private readonly service: ModelltestsService) {}

  @Get()
  getAll(): Promise<ModelltestListItemDto[]> {
    return this.service.getAll();
  }

  @Get(':number')
  getByNumber(@Param('number') number: string): Promise<ModelltestDetailDto> {
    return this.service.getByNumber(+number);
  }
}
