import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionAccessModule } from '../../shared/subscription-access.module';
import { GrammarController } from './grammar.controller';
import { GrammarService } from './grammar.service';

@Module({
  imports: [AuthModule, SubscriptionAccessModule],
  controllers: [GrammarController],
  providers: [GrammarService],
  exports: [GrammarService],
})
export class GrammarModule {}
