import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CenterAccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { PrismaService } from '../../shared/services/prisma.service';
import { isUniqueViolationOn } from '../../shared/prisma-errors';
import { generateActivationCode } from './activation-code-format';
import {
  toActivationCodeView,
  type ActivationCodeView,
} from './activation-code-view';
import {
  TRIAL_DURATION_DAYS,
  TRIAL_ELENA_CREDITS,
  TRIAL_EXAM_SLOTS,
  TRIAL_PACKAGE_SEATS,
  TRIAL_SCHREIBEN_CREDITS,
} from './trial-package';

export { TRIAL_DURATION_DAYS } from './trial-package';

/**
 * How many times a colliding random code is redrawn before giving up.
 *
 * At 30^8 combinations a single collision is already unlikely; three in a row
 * means something other than chance, and the caller should hear about it
 * rather than loop. Retries the whole claim (three codes), not one code.
 */
const CODE_DRAW_ATTEMPTS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

type SignedCenterIdentity = Pick<
  CenterAccessTokenPayload,
  'centerUserId' | 'centerId'
>;

export interface TrialStarted {
  trialEndsAt: Date;
  codes: ActivationCodeView[];
}

/**
 * Starts Pilote Exam Day: the clock, three Start seats/codes, Exam Day slots
 * and AI credit pools.
 *
 * The clock starts HERE, when the manager presses the button. Registration
 * only leaves a placeholder seat; this call sets quantity to three and mints
 * the codes, so a centre that never starts a trial does not hold the pack.
 */
@Injectable()
export class CenterTrialService {
  constructor(private readonly prisma: PrismaService) {}

  async start(identity: SignedCenterIdentity): Promise<TrialStarted> {
    const subscription = await this.prisma.centerSubscription.findUnique({
      where: { center_id: identity.centerId },
      select: { trial_started_at: true, paid_until: true },
    });

    if (!subscription) {
      throw new NotFoundException('CENTER_SUBSCRIPTION_NOT_FOUND');
    }

    if (subscription.paid_until !== null) {
      throw new ConflictException('ALREADY_PAID');
    }

    if (subscription.trial_started_at !== null) {
      throw new ConflictException('TRIAL_ALREADY_USED');
    }

    for (let attempt = 1; ; attempt++) {
      try {
        return await this.claimTrial(identity.centerId);
      } catch (error) {
        if (
          !isUniqueViolationOn(error, 'code') ||
          attempt >= CODE_DRAW_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }

  /**
   * One transaction: claim the trial, set seats, mint codes, grant gifts.
   */
  private async claimTrial(centerId: string): Promise<TrialStarted> {
    return this.prisma.$transaction(async (tx) => {
      const startedAt = new Date();
      const endsAt = new Date(
        startedAt.getTime() + TRIAL_DURATION_DAYS * DAY_MS,
      );

      const claimed = await tx.centerSubscription.updateMany({
        where: {
          center_id: centerId,
          trial_started_at: null,
          paid_until: null,
        },
        data: { trial_started_at: startedAt, trial_ends_at: endsAt },
      });

      if (claimed.count !== 1) {
        throw new ConflictException('TRIAL_ALREADY_USED');
      }

      await tx.centerSeat.upsert({
        where: { center_id: centerId },
        create: {
          center_id: centerId,
          quantity: TRIAL_PACKAGE_SEATS,
          unit_price_xaf: 0,
        },
        update: { quantity: TRIAL_PACKAGE_SEATS },
      });

      const codes: ActivationCodeView[] = [];
      for (let i = 0; i < TRIAL_PACKAGE_SEATS; i++) {
        const code = await tx.activationCode.create({
          data: {
            center_id: centerId,
            code: generateActivationCode(),
            expires_at: endsAt,
          },
        });
        codes.push(toActivationCodeView(code));
      }

      await tx.center.update({
        where: { id: centerId },
        data: { exam_slots_remaining: { increment: TRIAL_EXAM_SLOTS } },
      });

      await tx.centerEntitlementPool.upsert({
        where: {
          center_id_product: {
            center_id: centerId,
            product: 'AI_SPEAKING_CREDIT',
          },
        },
        create: {
          center_id: centerId,
          product: 'AI_SPEAKING_CREDIT',
          balance: TRIAL_ELENA_CREDITS,
        },
        update: { balance: { increment: TRIAL_ELENA_CREDITS } },
      });

      await tx.centerEntitlementPool.upsert({
        where: {
          center_id_product: {
            center_id: centerId,
            product: 'AI_SCHREIBEN_CREDIT',
          },
        },
        create: {
          center_id: centerId,
          product: 'AI_SCHREIBEN_CREDIT',
          balance: TRIAL_SCHREIBEN_CREDITS,
        },
        update: { balance: { increment: TRIAL_SCHREIBEN_CREDITS } },
      });

      return { trialEndsAt: endsAt, codes };
    });
  }
}
