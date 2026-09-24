import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CefrLevel, ExamGradingTier } from '@prisma/client';
import type { CenterAccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  ExamSessionPolicyService,
  type ExamSessionStatus,
} from './exam-session-policy.service';

type SignedCenterIdentity = Pick<CenterAccessTokenPayload, 'centerId'>;

/** All the content we have is B1, so the wizard offers one level. Adding A2
 *  or B2 is seeding `exam_block_durations` and widening this. */
export const EXAM_LEVEL: CefrLevel = 'B1';

export interface CreateExamSessionInput {
  name: string;
  modelltestNumber: number;
  opensAt: Date;
  accessWindowHours: number;
}

export interface UpdateExamSessionInput {
  name?: string;
  modelltestNumber?: number;
  opensAt?: Date;
  accessWindowHours?: number;
}

export interface ExamSessionView {
  id: string;
  name: string;
  level: CefrLevel;
  modelltestNumber: number;
  modelltestTitle: string;
  gradingTier: ExamGradingTier;
  status: ExamSessionStatus;
  opensAt: Date;
  closesAt: Date;
  publishedAt: Date | null;
  participantCount: number;
  createdAt: Date;
}

/** The row shape every read here projects from. */
const SESSION_SELECT = {
  id: true,
  name: true,
  level: true,
  grading_tier: true,
  opens_at: true,
  closes_at: true,
  published_at: true,
  cancelled_at: true,
  force_closed_at: true,
  created_at: true,
  modelltest: { select: { number: true, title: true } },
  _count: { select: { participants: true } },
} as const;

/**
 * A center's exam sittings: creating one, reading them back, and the
 * decisions a center may take about its own exam.
 *
 * Publishing is not here. Spending slots is one transaction with the
 * participant list, and lives in the service that owns that transaction.
 */
@Injectable()
export class ExamSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: ExamSessionPolicyService,
  ) {}

  async create(
    identity: SignedCenterIdentity,
    input: CreateExamSessionInput,
  ): Promise<ExamSessionView> {
    // Order matters only for the message the manager sees: the window is the
    // field they most often get wrong, so it is checked before the database
    // is touched at all.
    const closesAt = this.policy.closesAt(
      input.opensAt,
      input.accessWindowHours,
    );
    if (input.opensAt.getTime() <= Date.now()) {
      throw new BadRequestException('OPENS_AT_IN_PAST');
    }

    const modelltest = await this.prisma.modelltest.findUnique({
      where: { number: input.modelltestNumber },
      select: { id: true },
    });
    if (!modelltest) throw new NotFoundException('MODELLTEST_NOT_FOUND');

    const created = await this.prisma.examSession.create({
      data: {
        // From the token, never from the body: a caller able to name a center
        // could file a sitting against someone else's slots.
        center_id: identity.centerId,
        name: input.name.trim(),
        level: EXAM_LEVEL,
        modelltest_id: modelltest.id,
        opens_at: input.opensAt,
        closes_at: closesAt,
        // Explicit rather than omitted: publishing is a separate decision,
        // and a reader of this call should see that it is not made here.
        published_at: undefined,
      },
      select: SESSION_SELECT,
    });

    return this.view(created);
  }

  async list(
    identity: SignedCenterIdentity,
    query: { page: number; pageSize: number },
  ): Promise<{ sessions: ExamSessionView[]; total: number }> {
    const [rows, total] = await Promise.all([
      this.prisma.examSession.findMany({
        where: { center_id: identity.centerId },
        orderBy: { opens_at: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: SESSION_SELECT,
      }),
      this.prisma.examSession.count({
        where: { center_id: identity.centerId },
      }),
    ]);

    return { sessions: rows.map((row) => this.view(row)), total };
  }

  async get(
    identity: SignedCenterIdentity,
    sessionId: string,
  ): Promise<ExamSessionView> {
    return this.view(await this.load(identity, sessionId));
  }

  async update(
    identity: SignedCenterIdentity,
    sessionId: string,
    input: UpdateExamSessionInput,
  ): Promise<ExamSessionView> {
    const session = await this.load(identity, sessionId);
    this.requireEditable(session);

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name.trim();

    if (input.opensAt !== undefined || input.accessWindowHours !== undefined) {
      const opensAt = input.opensAt ?? session.opens_at;
      // Moving the start of a sitting moves its end. Leaving closes_at where
      // it was would silently shorten or extend the window the center chose.
      const windowHours =
        input.accessWindowHours ?? this.windowHoursOf(session);
      data.opens_at = opensAt;
      data.closes_at = this.policy.closesAt(opensAt, windowHours);
      if (opensAt.getTime() <= Date.now()) {
        throw new BadRequestException('OPENS_AT_IN_PAST');
      }
    }

    if (input.modelltestNumber !== undefined) {
      const modelltest = await this.prisma.modelltest.findUnique({
        where: { number: input.modelltestNumber },
        select: { id: true },
      });
      if (!modelltest) throw new NotFoundException('MODELLTEST_NOT_FOUND');
      data.modelltest_id = modelltest.id;
    }

    const updated = await this.prisma.examSession.update({
      where: { id: sessionId },
      data,
      select: SESSION_SELECT,
    });
    return this.view(updated);
  }

  /**
   * Calls the sitting off. Never a delete: it was published, students were
   * told, and somebody may later ask why it did not happen.
   */
  async cancel(
    identity: SignedCenterIdentity,
    sessionId: string,
  ): Promise<ExamSessionView> {
    const session = await this.load(identity, sessionId);
    if (session.cancelled_at) throw new BadRequestException('EXAM_CANCELLED');

    const updated = await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { cancelled_at: new Date() },
      select: SESSION_SELECT,
    });
    return this.view(updated);
  }

  /** Stops admitting candidates now, before the window was due to end. */
  async closeNow(
    identity: SignedCenterIdentity,
    sessionId: string,
  ): Promise<ExamSessionView> {
    const session = await this.load(identity, sessionId);
    if (session.cancelled_at) throw new BadRequestException('EXAM_CANCELLED');
    if (!session.published_at) {
      throw new BadRequestException('EXAM_NOT_PUBLISHED');
    }

    const updated = await this.prisma.examSession.update({
      where: { id: sessionId },
      data: { force_closed_at: new Date() },
      select: SESSION_SELECT,
    });
    return this.view(updated);
  }

  /**
   * Gives a lapsed sitting another window, counted from now.
   *
   * `force_closed_at` is cleared as well, or a sitting the center closed by
   * hand could never be reopened — the derived status reads that column
   * before it reads the clock.
   */
  async reopen(
    identity: SignedCenterIdentity,
    sessionId: string,
    windowHours: number,
  ): Promise<ExamSessionView> {
    const session = await this.load(identity, sessionId);
    if (session.cancelled_at) throw new BadRequestException('EXAM_CANCELLED');
    if (!session.published_at) {
      throw new BadRequestException('EXAM_NOT_PUBLISHED');
    }

    const updated = await this.prisma.examSession.update({
      where: { id: sessionId },
      data: {
        closes_at: this.policy.closesAt(new Date(), windowHours),
        force_closed_at: null,
      },
      select: SESSION_SELECT,
    });
    return this.view(updated);
  }

  /**
   * One sitting of the signed center, or 404.
   *
   * Scoped by `center_id` in the query rather than checked afterwards: a
   * center must not be able to learn that an id exists by the difference
   * between 403 and 404.
   */
  private async load(identity: SignedCenterIdentity, sessionId: string) {
    const session = await this.prisma.examSession.findFirst({
      where: { id: sessionId, center_id: identity.centerId },
      select: SESSION_SELECT,
    });
    if (!session) throw new NotFoundException('EXAM_SESSION_NOT_FOUND');
    return session;
  }

  private requireEditable(session: {
    opens_at: Date;
    closes_at: Date;
    published_at: Date | null;
    cancelled_at: Date | null;
    force_closed_at: Date | null;
  }): void {
    if (session.cancelled_at) throw new BadRequestException('EXAM_CANCELLED');
    if (!this.policy.mayEdit(session)) {
      throw new BadRequestException('EXAM_ALREADY_OPEN');
    }
  }

  /** The window a sitting currently holds, so an edit that moves only the
   *  opening keeps the length the center chose. */
  private windowHoursOf(session: { opens_at: Date; closes_at: Date }): number {
    return Math.round(
      (session.closes_at.getTime() - session.opens_at.getTime()) /
        (60 * 60 * 1000),
    );
  }

  private view(row: {
    id: string;
    name: string;
    level: CefrLevel;
    grading_tier: ExamGradingTier;
    opens_at: Date;
    closes_at: Date;
    published_at: Date | null;
    cancelled_at: Date | null;
    force_closed_at: Date | null;
    created_at: Date;
    modelltest: { number: number; title: string };
    _count: { participants: number };
  }): ExamSessionView {
    return {
      id: row.id,
      name: row.name,
      level: row.level,
      modelltestNumber: row.modelltest.number,
      modelltestTitle: row.modelltest.title,
      gradingTier: row.grading_tier,
      status: this.policy.statusOf(row),
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      publishedAt: row.published_at,
      participantCount: row._count.participants,
      createdAt: row.created_at,
    };
  }
}
