import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionAccessModule } from '../../shared/subscription-access.module';
import { CenterAuthController } from './center-auth.controller';
import { CenterAuthService } from './center-auth.service';
import { CenterExceptionFilter } from './center-exception.filter';
import { CenterProfileController } from './center-profile.controller';
import { CenterProfileService } from './center-profile.service';
import { CenterSubscriptionController } from './center-subscription.controller';
import { CenterSubscriptionService } from './center-subscription.service';
import { CenterStudentsController } from './center-students.controller';
import { ExamSessionsController } from './exam-sessions.controller';
import { ExamSlotsController } from './exam-slots.controller';
import { ExamResultsController } from './exam-results.controller';
import { ExamResultService } from './exam-result.service';
import { ExamGradingService } from './exam-grading.service';
import { ExamReleaseService } from './exam-release.service';
import { ExamSlotsService } from './exam-slots.service';
import { ExamSessionsService } from './exam-sessions.service';
import { ExamParticipantsService } from './exam-participants.service';
import { ExamSessionPolicyService } from './exam-session-policy.service';
import { CenterStudentsService } from './center-students.service';
import { SubscriptionPolicyService } from './subscription-policy.service';
import { PricingService } from './pricing.service';
import { CenterSeatsService } from './center-seats.service';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { PaymentWebhookService } from './payment-webhook.service';
import { PaymentActivationService } from './payment-activation.service';
import { PaymentCheckoutService } from './payment-checkout.service';
import {
  PAYMENT_PROVIDER_REGISTRY,
  buildPaymentProviderRegistry,
} from './payment-providers/payment-provider';
import type { PaymentProviderSettings } from './payment-providers/payment-provider';
import { CenterAuthGuard } from './guards/center-auth.guard';
import { CenterSubscriptionGuard } from './guards/center-subscription.guard';
import { CentersService } from './centers.service';
import { CenterTrialService } from './center-trial.service';
import { CenterActivationCodesController } from './center-activation-codes.controller';
import { CenterActivationCodesService } from './center-activation-codes.service';
import { CodeRedemptionController } from './code-redemption.controller';
import { CodeRedemptionService } from './code-redemption.service';
import { ProgressModule } from '../progress/progress.module';
import { CenterSupportController } from './center-support.controller';
import { CenterSupportService } from './center-support.service';

@Module({
  // SubscriptionAccessModule imports nothing, so this cannot close a cycle
  // back through AuthModule.
  imports: [AuthModule, SubscriptionAccessModule, ProgressModule],
  controllers: [
    CenterAuthController,
    CenterActivationCodesController,
    CodeRedemptionController,
    CenterProfileController,
    CenterSubscriptionController,
    CenterStudentsController,
    ExamSessionsController,
    ExamSlotsController,
    ExamResultsController,
    CenterSupportController,
    PaymentsController,
    PaymentWebhooksController,
  ],
  providers: [
    CentersService,
    CenterAuthService,
    CenterProfileService,
    CenterSubscriptionService,
    CenterTrialService,
    CenterActivationCodesService,
    CodeRedemptionService,
    CenterSupportService,
    ExamSessionsService,
    ExamSlotsService,
    ExamResultService,
    ExamGradingService,
    ExamReleaseService,
    ExamParticipantsService,
    ExamSessionPolicyService,
    SubscriptionPolicyService,
    PricingService,
    CenterSeatsService,
    PaymentsService,
    PaymentActivationService,
    PaymentCheckoutService,
    PaymentWebhookService,
    // Notch (Mobile Money) and Stripe (card) both register when their keys
    // are present — they are different methods, not alternatives. See
    // buildPaymentProviderRegistry.
    {
      provide: PAYMENT_PROVIDER_REGISTRY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const settings: PaymentProviderSettings = {
          PAYMENT_PROVIDER: config.get<string>('PAYMENT_PROVIDER'),
          NODE_ENV: config.get<string>('NODE_ENV'),
          FAKE_PAYMENT_WEBHOOK_SECRET: config.get<string>(
            'FAKE_PAYMENT_WEBHOOK_SECRET',
          ),
          NOTCHPAY_PUBLIC_KEY:
            config.get<string>('NOTCHPAY_PUBLIC_KEY') ??
            config.get<string>('NOTCHPAY_API_KEY'),
          NOTCHPAY_PRIVATE_KEY: config.get<string>('NOTCHPAY_PRIVATE_KEY'),
          NOTCHPAY_WEBHOOK_SECRET:
            config.get<string>('NOTCHPAY_WEBHOOK_SECRET') ??
            config.get<string>('NOTCHPAY_HASH_KEY'),
          NOTCHPAY_BASE_URL: config.get<string>('NOTCHPAY_BASE_URL'),
          NOTCHPAY_CALLBACK_URL: config.get<string>('NOTCHPAY_CALLBACK_URL'),
          STRIPE_SECRET_KEY: config.get<string>('STRIPE_SECRET_KEY'),
          STRIPE_WEBHOOK_SECRET: config.get<string>('STRIPE_WEBHOOK_SECRET'),
          STRIPE_SUCCESS_URL: config.get<string>('STRIPE_SUCCESS_URL'),
          STRIPE_CANCEL_URL: config.get<string>('STRIPE_CANCEL_URL'),
          STRIPE_ALLOW_LIVE_KEYS: config.get<string>('STRIPE_ALLOW_LIVE_KEYS'),
        };
        return buildPaymentProviderRegistry(settings);
      },
    },
    CenterStudentsService,
    CenterAuthGuard,
    CenterSubscriptionGuard,
    CenterExceptionFilter,
  ],
  exports: [CentersService, SubscriptionPolicyService],
})
export class CentersModule {}
