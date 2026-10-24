import { PushController } from './push/push.controller';
import { PushService } from './push/push.service';
import { PushCryptoService } from './push/push-crypto.service';
import { FirebasePushService } from './push/firebase-push.service';
import { PushWorkerService } from './push/push-worker.service';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from '../../shared/services/notifications.service';

@Module({
  // No SubscriptionAccessModule: nothing here asks about a subscription,
  // and importing it would suggest something does.
  imports: [AuthModule],
  controllers: [NotificationsController, PushController],
  providers: [
    NotificationsService,
    PushService,
    PushCryptoService,
    FirebasePushService,
    PushWorkerService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
