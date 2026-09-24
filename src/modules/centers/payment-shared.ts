import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../shared/services/prisma.service';
import type { CenterAccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { deriveOnboardingState, suppliedLocationOf } from './center-onboarding';

/**
 * The manager is carried as well as the center, because profile completeness
 * asks about the signed-in manager's phone — the same manager the dashboard
 * asks about, so both surfaces answer alike.
 */
export type SignedCenterIdentity = Pick<
  CenterAccessTokenPayload,
  'centerId' | 'centerUserId'
>;

const UNIQUE_VIOLATION = 'P2002';
const IDEMPOTENCY_COLUMN = 'idempotency_key';

/**
 * Refuses a center that has not finished its profile, naming every field it
 * still owes.
 *
 * Shared by every center product rather than copied into each: a center told
 * it may pay for seats and refused when it pays for exam slots would be two
 * implementations of one rule disagreeing.
 *
 * The `missing` list is what makes the refusal actionable — a client renders
 * the remaining checklist from it rather than holding a second copy of the
 * rules, so a fourth required field changes nothing on the frontend.
 */
export async function assertCenterProfileComplete(
  prisma: PrismaService,
  identity: SignedCenterIdentity,
): Promise<void> {
  const manager = await prisma.centerUser.findFirst({
    // Scoped by center as well as id, so a manager id from another center
    // cannot be used to answer this question.
    where: { id: identity.centerUserId, center_id: identity.centerId },
    select: {
      phone: true,
      center: {
        select: { country_code: true, city_id: true, city_other: true },
      },
    },
  });

  if (!manager) {
    throw new NotFoundException('CENTER_NOT_FOUND');
  }

  const onboarding = deriveOnboardingState({
    // Through the shared helper, so the till and the dashboard agree on what
    // "complete" means. A center told it is ready to pay, then refused when
    // it pays, is the worst possible place for these two to differ.
    ...suppliedLocationOf(manager.center),
    phone: manager.phone,
  });

  if (!onboarding.complete) {
    throw new ForbiddenException({
      message: 'CENTER_PROFILE_INCOMPLETE',
      missing: onboarding.missing,
    });
  }
}

/**
 * Whether this error is the idempotency index rejecting a duplicate.
 *
 * The constraint is checked, not just the code. Other unique indexes exist on
 * these paths, so treating any P2002 as a replay would look for a row by
 * idempotency key, not find one, and answer a server bug with 409
 * IDEMPOTENCY_KEY_REUSED — a client error the client cannot act on and nobody
 * can debug from the response.
 */
export function isIdempotencyViolation(error: unknown): boolean {
  if (
    typeof error !== 'object' ||
    error === null ||
    (error as { code?: unknown }).code !== UNIQUE_VIOLATION
  ) {
    return false;
  }

  return violatedColumns(error).includes(IDEMPOTENCY_COLUMN);
}

/**
 * Which columns a unique violation names.
 *
 * Two shapes, because this runs on the `PrismaPg` driver adapter. The adapter
 * reports the constraint under `meta.driverAdapterError`, and `meta.target` —
 * what Prisma's own engine sets, and what the documentation describes — is
 * simply absent. Reading only `target` therefore matched nothing and quietly
 * turned every replay back into a 500, which is how this function earned its
 * test.
 *
 * Both are read so the behaviour does not depend on which one a future Prisma
 * release populates.
 */
function violatedColumns(error: object): string[] {
  const meta = (error as { meta?: Record<string, unknown> }).meta ?? {};

  const target = meta.target;
  if (Array.isArray(target)) {
    return target.map(String);
  }
  if (typeof target === 'string') {
    return [target];
  }

  const fields = (
    meta as {
      driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } };
    }
  ).driverAdapterError?.cause?.constraint?.fields;

  return Array.isArray(fields) ? fields.map(String) : [];
}
