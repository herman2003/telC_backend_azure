import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionAccessModule } from '../../shared/subscription-access.module';
import { VocabController } from './vocab.controller';
import { VocabService } from './vocab.service';

@Module({
  imports: [AuthModule, SubscriptionAccessModule],
  controllers: [VocabController],
  providers: [VocabService],
  exports: [VocabService],
})
export class VocabModule {}
