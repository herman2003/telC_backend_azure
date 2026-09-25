import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentStudent } from '../../shared/decorators/current-student.decorator';
import type { AccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { NotificationsService } from '../../shared/services/notifications.service';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({
    default: false,
    description: 'What a bell shows: only the ones not yet read.',
  })
  @IsOptional()
  // Not `@Type(() => Boolean)`: a query string carries text, and
  // Boolean('false') is true — a student asking for everything would have
  // silently received the unread list. Mapped by hand, and anything that is
  // neither word is refused rather than guessed at.
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

/**
 * What a student is told without having to look.
 *
 * No subscription guard: a notification is not learning. A student whose
 * center lapsed should still be told their exam result is ready — especially
 * then, since the exam was paid for separately.
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('api/me/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'My notifications, newest first',
    description:
      'Each carries a kind and the facts behind it — never a sentence. The app writes the wording, in the language the student reads. The unread count comes back whatever the filter, because it is what the bell shows.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  list(
    @CurrentStudent() student: AccessTokenPayload,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notifications.list(student.studentId, {
      unreadOnly: query.unreadOnly ?? false,
      limit: query.limit ?? 50,
    });
  }

  @Post(':notificationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark one read',
    description:
      'Silent when it was already read: two taps on the same bell is not an error.',
  })
  markRead(
    @CurrentStudent() student: AccessTokenPayload,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ) {
    return this.notifications.markRead(student.studentId, notificationId);
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark everything read' })
  markAllRead(@CurrentStudent() student: AccessTokenPayload) {
    return this.notifications.markAllRead(student.studentId);
  }
}
