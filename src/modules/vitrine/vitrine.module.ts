import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RateLimitModule } from '../../shared/rate-limit.module';
import { PartnerCentersService } from './partner-centers.service';
import { PublicController } from './public.controller';
import { VitrineController } from './vitrine.controller';
import { VitrineDemoService } from './vitrine-demo.service';
import { VitrineDownloadsService } from './vitrine-downloads.service';

@Module({
  imports: [AuthModule, RateLimitModule],
  controllers: [VitrineController, PublicController],
  providers: [
    VitrineDownloadsService,
    VitrineDemoService,
    PartnerCentersService,
  ],
})
export class VitrineModule {}
