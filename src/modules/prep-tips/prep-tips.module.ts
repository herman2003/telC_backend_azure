import { Module } from '@nestjs/common';
import { SubscriptionAccessModule } from '../../shared/subscription-access.module';
import { AuthModule } from '../auth/auth.module';
import { PrepTipsController } from './prep-tips.controller';
import { PrepTipsService } from './prep-tips.service';

@Module({
  imports: [AuthModule, SubscriptionAccessModule],
  controllers: [PrepTipsController],
  providers: [PrepTipsService],
  exports: [PrepTipsService],
})
export class PrepTipsModule {}
