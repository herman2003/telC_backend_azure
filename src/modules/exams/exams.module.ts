import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionAccessModule } from '../../shared/subscription-access.module';
import { ConfigService } from '@nestjs/config';
import { ExamSittingController } from './exam-sitting.controller';
import { ExamAudioController } from './exam-audio.controller';
import {
  EXAM_AUDIO_SECRET,
  ExamAudioService,
} from '../centers/exam-audio.service';
import { ExamSittingService } from '../centers/exam-sitting.service';
import { ExamBlockContentService } from '../centers/exam-block-content.service';
import { ExamScoringService } from '../centers/exam-scoring.service';
import { ExamSessionPolicyService } from '../centers/exam-session-policy.service';
import { LesenService } from '../lesen/lesen.service';
import { SprachbausteineService } from '../sprachbausteine/sprachbausteine.service';
import { ListeningService } from '../listening/listening.service';
import { WritingService } from '../writing/writing.service';

/**
 * The candidate's half of the exam simulator.
 *
 * Separate from `CentersModule` because the caller is a student, not a
 * center: a different token, a different guard, and a different half of the
 * feature. The services are shared rather than duplicated — one rule about
 * when a block may start, wherever the question is asked from.
 */
@Module({
  imports: [AuthModule, SubscriptionAccessModule],
  controllers: [ExamSittingController, ExamAudioController],
  providers: [
    ExamSittingService,
    ExamBlockContentService,
    ExamScoringService,
    ExamAudioService,
    {
      // The same secret the rest of the system signs with. A separate one
      // would be a second thing to rotate and a second thing to forget.
      provide: EXAM_AUDIO_SECRET,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.getOrThrow<string>('TOKEN_HMAC_SECRET'),
    },
    ExamSessionPolicyService,
    LesenService,
    SprachbausteineService,
    ListeningService,
    WritingService,
  ],
})
export class ExamsModule {}
