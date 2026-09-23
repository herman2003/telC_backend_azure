import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { StudentSubscriptionGuard } from '../../shared/guards/student-subscription.guard';
import { ModelltestsService } from './modelltests.service';
import type {
  ModelltestDetailDto,
  ModelltestListItemDto,
} from './dto/modelltest.dto';

/**
 * The Modelltest content, open to every student whose school is paying.
 *
 * It used to be the line between Start and Pro. With Start the only plan
 * (2026-09-23) there is no tier to compare, so the subscription guard is the
 * whole rule here, exactly as for per-skill practice. What the new pricing
 * sells instead — Prep Pass, Exam Day — gets its own check when it is built.
 */
@UseGuards(JwtAuthGuard, StudentSubscriptionGuard)
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
