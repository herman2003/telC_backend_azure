import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from '../../shared/services/notifications.service';

@Module({
  // No SubscriptionAccessModule: nothing here asks about a subscription,
  // and importing it would suggest something does.
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
