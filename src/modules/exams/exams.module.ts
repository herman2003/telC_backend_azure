import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionAccessModule } from '../../shared/subscription-access.module';
import { ExamSittingController } from './exam-sitting.controller';
import { ExamSittingService } from '../centers/exam-sitting.service';
import { ExamBlockContentService } from '../centers/exam-block-content.service';
import { ExamScoringService } from '../centers/exam-scoring.service';
import { ExamSessionPolicyService } from '../centers/exam-session-policy.service';
import { LesenService } from '../lesen/lesen.service';
import { SprachbausteineService } from '../sprachbausteine/sprachbausteine.service';

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
  controllers: [ExamSittingController],
  providers: [
    ExamSittingService,
    ExamBlockContentService,
    ExamScoringService,
    ExamSessionPolicyService,
    LesenService,
    SprachbausteineService,
  ],
})
export class ExamsModule {}
