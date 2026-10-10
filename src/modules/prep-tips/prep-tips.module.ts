import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrepTipsController } from './prep-tips.controller';
import { PrepTipsService } from './prep-tips.service';

@Module({
  imports: [AuthModule],
  controllers: [PrepTipsController],
  providers: [PrepTipsService],
  exports: [PrepTipsService],
})
export class PrepTipsModule {}
