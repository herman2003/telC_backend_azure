import { FirebasePushService } from './firebase-push.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
} from '@nestjs/swagger';
import { CurrentStudent } from '../../../shared/decorators/current-student.decorator';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../../../shared/interfaces/token-payload.interface';
import { RateLimitService } from '../../../shared/services/rate-limit.service';
import { PushService } from './push.service';
import {
  RegisterPushDto,
  PushPreferencesDto,
  PushEndpointResponseDto,
  PushPreferencesResponseDto,
} from './push.dto';
@ApiTags('Push notifications')
@ApiBearerAuth()
@Controller('api/me')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(
    private readonly push: PushService,
    private readonly limits: RateLimitService,
    private readonly firebase: FirebasePushService,
  ) {}
  @Get('push-status')
  @ApiOperation({
    summary:
      'Non-secret provider readiness; inbox stays available when push is disabled',
  })
  status() {
    return this.firebase.status;
  }
  @ApiOkResponse({ type: PushEndpointResponseDto })
  @Put('push-endpoint')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Register the authenticated installation; never returns its provider token',
  })
  async register(
    @CurrentStudent() user: AccessTokenPayload,
    @Body() dto: RegisterPushDto,
  ) {
    await this.limits.checkPushWriteLimit(user.studentId);
    return this.push.register(user, dto);
  }
  @Delete('push-endpoint')
  @HttpCode(200)
  @ApiOperation({ summary: 'Disable this installation before logout' })
  remove(@CurrentStudent() user: AccessTokenPayload) {
    return this.push.remove(user);
  }
  @ApiOkResponse({ type: PushPreferencesResponseDto })
  @Get('notification-preferences')
  @ApiOperation({
    summary: 'Read account-wide preferences and local quiet hours',
  })
  preferences(@CurrentStudent() user: AccessTokenPayload) {
    return this.push.preferences(user);
  }
  @ApiOkResponse({ type: PushPreferencesResponseDto })
  @Put('notification-preferences')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update account-wide preferences' })
  async update(
    @CurrentStudent() user: AccessTokenPayload,
    @Body() dto: PushPreferencesDto,
  ) {
    await this.limits.checkPushWriteLimit(user.studentId);
    return this.push.updatePreferences(user, dto);
  }
}
