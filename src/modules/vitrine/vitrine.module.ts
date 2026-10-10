import { Module } from '@nestjs/common';
import { VitrineController } from './vitrine.controller';
import { VitrineDownloadsService } from './vitrine-downloads.service';

@Module({
  controllers: [VitrineController],
  providers: [VitrineDownloadsService],
})
export class VitrineModule {}
