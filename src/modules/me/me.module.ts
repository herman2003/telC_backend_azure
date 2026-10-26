import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionAccessModule } from '../../shared/subscription-access.module';
import { MyEntitlementsController } from './entitlements.controller';

/**
 * A student's own view of what they hold.
 *
 * `SubscriptionAccessModule` for `EntitlementSpendService`, not for the guard:
 * this route deliberately answers a student whose center has lapsed, because
 * that is exactly when they need to be told what is waiting for them.
 */
@Module({
  imports: [AuthModule, SubscriptionAccessModule],
  controllers: [MyEntitlementsController],
})
export class MeModule {}
