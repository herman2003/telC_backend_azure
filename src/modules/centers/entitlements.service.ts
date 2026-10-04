import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type EntitlementProduct } from '@prisma/client';
import type { CenterAccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { PrismaService } from '../../shared/services/prisma.service';
import { SubscriptionPolicyService } from './subscription-policy.service';

type SignedCenterIdentity = Pick<CenterAccessTokenPayload, 'centerId'>;

/**
 * How long one grant of each timed product lasts.
 *
 * Day counts rather than calendar months, unlike the subscription period, which
 * ends on an anchor day (`billing-period.ts`). A prep pass is a product that
 * lasts sixty days, not a thing with a renewal date, so there is no anchor for
 * it to follow and no month-end question to answer.
 */
export const PREP_PASS_DAYS = 60;
export const AI_ASSISTED_LEARNING_DAYS = 30;

const PERIOD_DAYS: Partial<Record<EntitlementProduct, number>> = {
  PREP_PASS: PREP_PASS_DAYS,
  AI_ASSISTED_LEARNING: AI_ASSISTED_LEARNING_DAYS,
};

/**
 * Which products are a balance drawn against a cap, and which are a period.
 *
 * The distinction is the whole shape of ADR 0002, so it is declared once here
 * rather than inferred at each call site.
 */
const CAPPED_PRODUCTS: ReadonlySet<EntitlementProduct> = new Set([
  'AI_SPEAKING_CREDIT',
]);

export interface PoolView {
  product: EntitlementProduct;
  balance: number;
  /** True when Start has lapsed: spendable again the moment it is paid. */
  frozen: boolean;
}

export interface CapView {
  codeId: string;
  code: string;
  holder: string | null;
  product: EntitlementProduct;
  cap: number;
  used: number;
}

export interface EntitlementsOverview {
  pools: PoolView[];
  /** How many seats hold a cap, per product. The seats themselves are a page
   *  at a time — see {@link EntitlementsService.cappedCodes}. */
  capped: { product: EntitlementProduct; seats: number }[];
  assigned: { product: EntitlementProduct; seats: number }[];
}

export interface CappedCodesPage {
  codes: CapView[];
  total: number;
  page: number;
  pageSize: number;
}

/** A dashboard table, not a data export. */
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

/**
 * What a center holds, and who may draw on it.
 *
 * ADR 0003 (AI Speaking): the pool is **unallocated** stock; a seat's `cap` is
 * **assigned remaining**. Assign moves stock onto the seat; spend burns the
 * seat balance; remove returns unused to the pool. Prep Pass / AI Assisted
 * Learning still leave the pool as a period grant (ADR 0002).
 *
 * Caps and periods hang off the activation code rather than the student. A
 * code exists before anybody holds it, so a center can buy ahead; and a seat
 * that changes hands carries what was bought for it, which is what the center
 * paid for. A student holds at most one connected code, so per-code and
 * per-student are the same number whenever somebody holds it.
 */
@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: SubscriptionPolicyService,
  ) {}

  /**
   * The summary a manager's screen opens with.
   *
   * Counts rather than lists. A center with five hundred codes across three
   * products would otherwise be sent fifteen hundred rows every time the
   * dashboard loaded, to render two numbers; the seats themselves come a page
   * at a time from `cappedCodes`.
   */
  async overview(
    identity: SignedCenterIdentity,
  ): Promise<EntitlementsOverview> {
    const [pools, capped, assigned, frozen] = await Promise.all([
      this.prisma.centerEntitlementPool.findMany({
        where: { center_id: identity.centerId },
        select: { product: true, balance: true },
      }),
      this.prisma.codeEntitlementCap.groupBy({
        by: ['product'],
        where: { code: { center_id: identity.centerId }, cap: { gt: 0 } },
        _count: { _all: true },
      }),
      this.prisma.codeEntitlement.groupBy({
        by: ['product'],
        where: {
          code: { center_id: identity.centerId },
          expires_at: { gt: new Date() },
        },
        _count: { _all: true },
      }),
      this.isFrozen(identity.centerId),
    ]);

    return {
      pools: pools.map((pool) => ({ ...pool, frozen })),
      capped: capped.map((row) => ({
        product: row.product,
        seats: row._count._all,
      })),
      assigned: assigned.map((row) => ({
        product: row.product,
        seats: row._count._all,
      })),
    };
  }

  /**
   * One page of the seats that may draw on a pool.
   *
   * Paged because a school's seat count is not bounded by anything this
   * service controls, and an unbounded list endpoint is a slow page waiting
   * for its first big customer.
   *
   * Zero caps are included: a seat a manager stopped is exactly the row they
   * come here to find and raise again.
   */
  async cappedCodes(
    identity: SignedCenterIdentity,
    product: EntitlementProduct,
    query: { page?: number; pageSize?: number; search?: string } = {},
  ): Promise<CappedCodesPage> {
    const page = Math.max(1, Math.trunc(query.page ?? 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE)),
    );

    const where = {
      product,
      code: {
        center_id: identity.centerId,
        ...(query.search
          ? {
              OR: [
                { code: { contains: query.search, mode: 'insensitive' } },
                {
                  linked_name: { contains: query.search, mode: 'insensitive' },
                },
              ],
            }
          : {}),
      },
    } satisfies Prisma.CodeEntitlementCapWhereInput;

    const [rows, total] = await Promise.all([
      this.prisma.codeEntitlementCap.findMany({
        where,
        select: {
          code_id: true,
          product: true,
          cap: true,
          used: true,
          code: { select: { code: true, linked_name: true } },
        },
        orderBy: { code: { code: 'asc' } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.codeEntitlementCap.count({ where }),
    ]);

    return {
      codes: rows.map((row) => ({
        codeId: row.code_id,
        code: row.code.code,
        holder: row.code.linked_name,
        product: row.product,
        cap: row.cap,
        used: row.used,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Sets how many credits this seat holds (assigned remaining).
   *
   * Absolute: a manager typing 12 means twelve on the seat. The delta is
   * taken from or returned to the unallocated pool in the same transaction,
   * so assign cannot oversubscribe stock. Zero returns everything unused.
   */
  async setCap(
    identity: SignedCenterIdentity,
    codeId: string,
    product: EntitlementProduct,
    cap: number,
  ): Promise<CapView> {
    if (!CAPPED_PRODUCTS.has(product)) {
      // A Prep Pass is sixty days, not an allowance of sixty. Silently doing
      // nothing would hide the caller's mistake.
      throw new BadRequestException('PRODUCT_HAS_NO_CAP');
    }

    const code = await this.requireOwnCode(identity, codeId);

    const row = await this.prisma.$transaction(async (tx) => {
      const current = await tx.codeEntitlementCap.findUnique({
        where: { code_id_product: { code_id: codeId, product } },
        select: { cap: true, used: true },
      });
      const previous = current?.cap ?? 0;
      const delta = cap - previous;

      if (delta > 0) {
        const moved = await tx.centerEntitlementPool.updateMany({
          where: {
            center_id: identity.centerId,
            product,
            balance: { gte: delta },
          },
          data: { balance: { decrement: delta } },
        });
        if (moved.count !== 1) {
          throw new BadRequestException('NOT_ENOUGH_ENTITLEMENTS');
        }
      } else if (delta < 0) {
        await tx.centerEntitlementPool.upsert({
          where: {
            center_id_product: {
              center_id: identity.centerId,
              product,
            },
          },
          create: {
            center_id: identity.centerId,
            product,
            balance: -delta,
          },
          update: { balance: { increment: -delta } },
        });
      }

      return tx.codeEntitlementCap.upsert({
        where: { code_id_product: { code_id: codeId, product } },
        create: { code_id: codeId, product, cap },
        update: { cap },
        select: { cap: true, used: true },
      });
    });

    return {
      codeId,
      code: code.code,
      holder: code.linked_name,
      product,
      cap: row.cap,
      used: row.used,
    };
  }

  /**
   * Takes one from the pool and puts a period on the seat.
   *
   * The pool decrement is the gate and the concurrency control in one: written
   * as a conditional update, so two managers assigning the last Prep Pass at
   * the same moment cannot both succeed. Nothing is granted when it matches no
   * row.
   */
  async grantPeriod(
    identity: SignedCenterIdentity,
    codeId: string,
    product: EntitlementProduct,
  ): Promise<{ product: EntitlementProduct; expiresAt: Date }> {
    const days = PERIOD_DAYS[product];
    if (days === undefined) {
      throw new BadRequestException('PRODUCT_HAS_NO_PERIOD');
    }

    await this.requireOwnCode(identity, codeId);

    return this.prisma.$transaction(async (tx) => {
      const spent = await tx.centerEntitlementPool.updateMany({
        where: {
          center_id: identity.centerId,
          product,
          balance: { gte: 1 },
        },
        data: { balance: { decrement: 1 } },
      });
      if (spent.count !== 1) {
        throw new BadRequestException('NOT_ENOUGH_ENTITLEMENTS');
      }

      // One statement, and the arithmetic happens in Postgres. Reading the
      // current expiry and writing a new one would let two grants issued
      // together each measure from the same starting point and lose sixty
      // days that were paid for twice.
      //
      // GREATEST(expires_at, now()) is what makes a lapsed pass start again
      // from today rather than from the date it ran out.
      const rows = await tx.$queryRaw<{ expires_at: Date }[]>`
        INSERT INTO code_entitlements (code_id, product, expires_at, created_at, updated_at)
        VALUES (
          ${codeId},
          ${product}::"EntitlementProduct",
          now() + make_interval(days => ${days}),
          now(),
          now()
        )
        ON CONFLICT (code_id, product) DO UPDATE SET
          expires_at =
            GREATEST(code_entitlements.expires_at, now())
            + make_interval(days => ${days}),
          updated_at = now()
        RETURNING expires_at
      `;

      return { product, expiresAt: rows[0].expires_at };
    });
  }

  /**
   * Returns unused assigned credits to the school pool and clears the seat.
   *
   * Never a card refund and never a period cut short. Already-spent sessions
   * stay spent (`used` is left alone).
   */
  async revoke(
    identity: SignedCenterIdentity,
    codeId: string,
    product: EntitlementProduct,
  ): Promise<{ revoked: boolean }> {
    await this.requireOwnCode(identity, codeId);

    if (!CAPPED_PRODUCTS.has(product)) {
      // Nothing to take back: the period was paid for. Answering truthfully
      // rather than throwing, because a manager asking twice is not an error.
      return { revoked: false };
    }

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.codeEntitlementCap.findUnique({
        where: { code_id_product: { code_id: codeId, product } },
        select: { cap: true },
      });
      if (!row || row.cap === 0) {
        return { revoked: false };
      }

      await tx.centerEntitlementPool.upsert({
        where: {
          center_id_product: {
            center_id: identity.centerId,
            product,
          },
        },
        create: {
          center_id: identity.centerId,
          product,
          balance: row.cap,
        },
        update: { balance: { increment: row.cap } },
      });

      await tx.codeEntitlementCap.update({
        where: { code_id_product: { code_id: codeId, product } },
        data: { cap: 0 },
      });

      return { revoked: true };
    });
  }

  /**
   * Whether this center's entitlements are spendable.
   *
   * The same rule as "Start is the door", read from the same policy the rest
   * of the system reads, because two implementations of one rule is how they
   * drift apart.
   */
  private async isFrozen(centerId: string): Promise<boolean> {
    const subscription = await this.prisma.centerSubscription.findUnique({
      where: { center_id: centerId },
      select: {
        plan: true,
        trial_started_at: true,
        trial_ends_at: true,
        paid_until: true,
      },
    });
    if (!subscription) return true;

    return !this.policy.evaluate(subscription).studentsMayLearn;
  }

  /** Scoped inside the query: an id from elsewhere is a 404, never a 403,
   *  because a 403 would confirm that somebody else's code exists. */
  private async requireOwnCode(
    identity: SignedCenterIdentity,
    codeId: string,
  ): Promise<{ code: string; linked_name: string | null }> {
    const code = await this.prisma.activationCode.findFirst({
      where: { id: codeId, center_id: identity.centerId },
      select: { code: true, linked_name: true },
    });
    if (!code) throw new NotFoundException('CODE_NOT_IN_CENTER');
    return code;
  }
}

/** Re-exported so callers do not import Prisma's enum directly. */
export type { EntitlementProduct };
export { Prisma };
