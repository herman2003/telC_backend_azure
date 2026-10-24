import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ListeningController } from './listening.controller';
import { TrainingAudioController } from './training-audio.controller';
import { ListeningService } from './listening.service';
import { TrainingAudioService } from './training-audio.service';
import { EXAM_AUDIO_SECRET } from '../centers/exam-audio.service';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionAccessModule } from '../../shared/subscription-access.module';
import { GenericExamContentService } from '../../shared/services/generic-exam-content.service';

@Module({
  imports: [AuthModule, SubscriptionAccessModule],
  controllers: [ListeningController, TrainingAudioController],
  providers: [
    ListeningService,
    GenericExamContentService,
    TrainingAudioService,
    {
      provide: EXAM_AUDIO_SECRET,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.getOrThrow<string>('TOKEN_HMAC_SECRET'),
    },
  ],
  exports: [ListeningService],
})
export class ListeningModule {}
