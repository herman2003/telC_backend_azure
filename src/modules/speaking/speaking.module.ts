import { Module } from '@nestjs/common';
import { SpeakingController } from './speaking.controller';
import { SpeakingCatalogController } from './speaking-catalog.controller';
import { SpeakingService } from './services/speaking.service';
import { GeminiService } from './services/gemini.service';
import { EvaluationService } from './services/evaluation.service';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionAccessModule } from '../../shared/subscription-access.module';
import { RateLimitModule } from '../../shared/rate-limit.module';
import { RoomModule } from './room/room.module';
import { LiveTokenController } from './live/live-token.controller';
import { ExaminerPromptService } from './live/examiner-prompt.service';
import { LiveSessionLimitService } from './live/live-session-limit.service';
import { GenericExamContentService } from '../../shared/services/generic-exam-content.service';

@Module({
  imports: [AuthModule, SubscriptionAccessModule, RateLimitModule, RoomModule],
  controllers: [
    SpeakingController,
    SpeakingCatalogController,
    LiveTokenController,
  ],
  providers: [
    GenericExamContentService,
    SpeakingService,
    GeminiService,
    EvaluationService,
    ExaminerPromptService,
    LiveSessionLimitService,
  ],
  exports: [SpeakingService, GeminiService, EvaluationService],
})
export class SpeakingModule {}
