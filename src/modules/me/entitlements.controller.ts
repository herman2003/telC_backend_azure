import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentStudent } from '../../shared/decorators/current-student.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { EntitlementSpendService } from '../../shared/services/entitlement-spend.service';
import { MyEntitlementsDto } from './dto/my-entitlements.dto';

/**
 * What this student holds, in one call.
 *
 * No subscription guard, deliberately. A student whose center has lapsed must
 * still be able to see what is waiting for them — that is the screen that
 * explains why nothing works, and telling them nothing at all would leave the
 * app guessing.
 */
@ApiTags('Me')
@ApiBearerAuth()
@Controller('api/me/entitlements')
@UseGuards(JwtAuthGuard)
export class MyEntitlementsController {
  constructor(private readonly entitlements: EntitlementSpendService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'What I hold',
    description:
      'Everything the app needs to decide what to show: the two timed add-ons, how many free Elena sessions are left this month and when they come back, and how many credits this student can actually spend. `creditsAvailable` is already the smaller of the center pool and this seat’s remaining cap — one number, so no client has to work out the same minimum. `frozen` means the center stopped paying: nothing is lost and nothing is spendable.',
  })
  @ApiOkResponse({ type: MyEntitlementsDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  mine(@CurrentStudent() student: AccessTokenPayload) {
    return this.entitlements.forStudent(student.studentId);
  }
}
