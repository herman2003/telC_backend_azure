import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { StudentSubscriptionGuard } from '../../shared/guards/student-subscription.guard';
import { PrepPassGuard } from '../../shared/guards/prep-pass.guard';
import { CurrentStudent } from '../../shared/decorators/current-student.decorator';
import type { AccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { ModelltestsService } from './modelltests.service';
import type {
  ModelltestDetailDto,
  ModelltestListItemDto,
} from './dto/modelltest.dto';

/**
 * Training catalogue. Start sees the weekly Modelltest; Prep Pass unlocks
 * the full training pool. Guests only see Modelltests allowlisted for the
 * demo (not MT3+).
 */
@UseGuards(JwtAuthGuard, StudentSubscriptionGuard, PrepPassGuard)
@Controller('api/modelltests')
export class ModelltestsController {
  constructor(private readonly service: ModelltestsService) {}

  @Get()
  getAll(
    @CurrentStudent() student: AccessTokenPayload | null,
  ): Promise<ModelltestListItemDto[]> {
    const isGuest = student?.isGuest === true;
    return this.service.getAll({
      isGuest,
      studentId: isGuest ? undefined : student?.studentId,
    });
  }

  @Get(':number')
  getByNumber(
    @CurrentStudent() student: AccessTokenPayload | null,
    @Param('number') number: string,
  ): Promise<ModelltestDetailDto> {
    const isGuest = student?.isGuest === true;
    return this.service.getByNumber(+number, {
      isGuest,
      studentId: isGuest ? undefined : student?.studentId,
    });
  }
}
