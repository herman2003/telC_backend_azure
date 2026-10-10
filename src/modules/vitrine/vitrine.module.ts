import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RateLimitModule } from '../../shared/rate-limit.module';
import { VitrineController } from './vitrine.controller';
import { VitrineDemoService } from './vitrine-demo.service';
import { VitrineDownloadsService } from './vitrine-downloads.service';

@Module({
  imports: [AuthModule, RateLimitModule],
  controllers: [VitrineController],
  providers: [VitrineDownloadsService, VitrineDemoService],
})
export class VitrineModule {}
