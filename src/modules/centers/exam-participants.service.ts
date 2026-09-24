import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CenterAccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { PrismaService } from '../../shared/services/prisma.service';
import { ExamSessionPolicyService } from './exam-session-policy.service';

type SignedCenterIdentity = Pick<CenterAccessTokenPayload, 'centerId'>;

export interface EligibleStudentView {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  /** Whether this student is already admitted to the sitting. */
  selected: boolean;
  /**
   * Whether they have already worked on this Modelltest in training.
   *
   * The warning that stops a sitting being meaningless: a student who
   * practised Modelltest 2 last month has seen the texts and the answers, and
   * their score in an exam using it says nothing.
   */
  trainedOnModelltest: boolean;
}

export interface PublishResult {
  publishedAt: Date;
  participantCount: number;
  slotsSpent: number;
  slotsRemaining: number;
}

/**
 * Who may sit an exam, and the moment a sitting becomes real.
 *
 * A participant row is the access rule. Holding a Lerniqo account, or even a
 * seat at the center running the exam, opens nothing: only a row here does.
 */
@Injectable()
export class ExamParticipantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: ExamSessionPolicyService,
  ) {}

  /**
   * The center's students, each marked with whether they are already in and
   * whether they have trained on this sitting's Modelltest.
   *
   * Paged and searchable, because a school with four hundred students is an
   * ordinary school and the wizard's third step is a picker, not a dump.
   */
  async listEligible(
    identity: SignedCenterIdentity,
    sessionId: string,
    query: { page: number; pageSize: number; search?: string },
  ): Promise<{ students: EligibleStudentView[]; total: number }> {
    const session = await this.load(identity, sessionId);

    const search = query.search?.trim();
    const where = {
      center_id: identity.centerId,
      ...(search
        ? {
            OR: [
              { first_name: { contains: search, mode: 'insensitive' as const } },
              { last_name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [students, total, admitted, trained] = await Promise.all([
      this.prisma.student.findMany({
        where,
        orderBy: [{ first_name: 'asc' }, { email: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
        },
      }),
      this.prisma.student.count({ where }),
      this.prisma.examSessionParticipant.findMany({
        where: { session_id: sessionId },
        select: { student_id: true },
      }),
      // One grouped query rather than one per student: the list is the
      // wizard's third step and a school may have two hundred of them.
      this.prisma.studentActivity.groupBy({
        by: ['student_id'],
        where: {
          modelltest_id: session.modelltest_id,
          student: { center_id: identity.centerId },
        },
      }),
    ]);

    const isAdmitted = new Set(admitted.map((row) => row.student_id));
    const hasTrained = new Set(trained.map((row) => row.student_id));

    return {
      students: students.map((student) => ({
        id: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
        email: student.email,
        selected: isAdmitted.has(student.id),
        trainedOnModelltest: hasTrained.has(student.id),
      })),
      total,
    };
  }

  /**
   * Replaces the admitted list.
   *
   * On a draft this is free: publishing is what charges. On a sitting already
   * published, each student added spends a slot there and then — the exam is
   * already sold, and a late candidate is a late sale. Removing never
   * refunds, because an exam fee is spent when it is booked.
   */
  async setParticipants(
    identity: SignedCenterIdentity,
    sessionId: string,
    studentIds: string[],
  ): Promise<{ participantCount: number; slotsSpent: number }> {
    const session = await this.load(identity, sessionId);
    if (session.cancelled_at) throw new BadRequestException('EXAM_CANCELLED');
    if (!this.policy.mayEdit(session)) {
      throw new BadRequestException('EXAM_ALREADY_OPEN');
    }

    const wanted = [...new Set(studentIds)];
    await this.requireOwnStudents(identity, wanted);

    const existing = await this.prisma.examSessionParticipant.findMany({
      where: { session_id: sessionId },
      select: { student_id: true },
    });
    const before = new Set(existing.map((row) => row.student_id));
    const added = wanted.filter((id) => !before.has(id));
    const removed = [...before].filter((id) => !wanted.includes(id));

    // A published sitting has already been paid for, so only the newcomers
    // cost anything. A draft costs nothing yet.
    const slotsToSpend = session.published_at ? added.length : 0;

    await this.prisma.$transaction(async (tx) => {
      if (slotsToSpend > 0) await this.spendSlots(tx, identity, slotsToSpend);

      if (removed.length > 0) {
        await tx.examSessionParticipant.deleteMany({
          where: { session_id: sessionId, student_id: { in: removed } },
        });
      }
      if (added.length > 0) {
        await tx.examSessionParticipant.createMany({
          data: added.map((studentId) => ({
            session_id: sessionId,
            student_id: studentId,
          })),
          // The difference was computed before the transaction, so two saves
          // arriving together can both decide to add the same student. One
          // insert then hit the unique index and surfaced as a 500; this
          // makes the loser a no-op, which is what it always meant.
          skipDuplicates: true,
        });
      }
    });

    return { participantCount: wanted.length, slotsSpent: slotsToSpend };
  }

  /**
   * Publishes the sitting: one slot per admitted candidate, in the same
   * transaction that sets `published_at`.
   *
   * Idempotent by that column. A double-clicked publish must not spend a
   * second time, and the claim is enforced by the update's own WHERE rather
   * than by reading first — two requests in flight would both read null.
   */
  async publish(
    identity: SignedCenterIdentity,
    sessionId: string,
  ): Promise<PublishResult> {
    const session = await this.load(identity, sessionId);
    if (session.cancelled_at) throw new BadRequestException('EXAM_CANCELLED');
    if (session.published_at) {
      throw new ConflictException('EXAM_ALREADY_PUBLISHED');
    }
    if (session.opens_at.getTime() <= Date.now()) {
      // Publishing into the past would open the sitting the instant it
      // appeared, with nobody told.
      throw new BadRequestException('OPENS_AT_IN_PAST');
    }

    return this.prisma.$transaction(async (tx) => {
      // Counted inside the transaction that spends for it. Counting first and
      // spending after would admit, unpaid for, anyone added in between.
      const participantCount = await tx.examSessionParticipant.count({
        where: { session_id: sessionId },
      });
      if (participantCount === 0) {
        throw new BadRequestException('NO_PARTICIPANTS');
      }

      const remaining = await this.spendSlots(tx, identity, participantCount);

      // The WHERE is the concurrency control: the second of two simultaneous
      // publishes matches no row, and is told so rather than spending again.
      const claimed = await tx.examSession.updateMany({
        where: { id: sessionId, published_at: null },
        data: { published_at: new Date() },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('EXAM_ALREADY_PUBLISHED');
      }

      const published = await tx.examSession.findUniqueOrThrow({
        where: { id: sessionId },
        select: { published_at: true },
      });

      return {
        publishedAt: published.published_at!,
        participantCount,
        slotsSpent: participantCount,
        slotsRemaining: remaining,
      };
    });
  }

  /**
   * Takes `count` slots from the center, or refuses.
   *
   * Conditional in the statement — `exam_slots_remaining >= count` — rather
   * than read-then-write, so two sittings published at the same moment cannot
   * both spend the last slot. The database also carries a check constraint;
   * that is the backstop for this being wrong, not the rule.
   */
  private async spendSlots(
    tx: Prisma.TransactionClient,
    identity: SignedCenterIdentity,
    count: number,
  ): Promise<number> {
    const spent = await tx.center.updateMany({
      where: {
        id: identity.centerId,
        exam_slots_remaining: { gte: count },
      },
      data: { exam_slots_remaining: { decrement: count } },
    });
    if (spent.count !== 1) {
      throw new BadRequestException('NOT_ENOUGH_EXAM_SLOTS');
    }

    const center = await tx.center.findUniqueOrThrow({
      where: { id: identity.centerId },
      select: { exam_slots_remaining: true },
    });
    return center.exam_slots_remaining;
  }

  /** Every id must be a student of the signed center: a list is not a way to
   *  admit somebody else's student to your exam. */
  private async requireOwnStudents(
    identity: SignedCenterIdentity,
    studentIds: string[],
  ): Promise<void> {
    if (studentIds.length === 0) return;

    const mine = await this.prisma.student.count({
      where: { id: { in: studentIds }, center_id: identity.centerId },
    });
    if (mine !== studentIds.length) {
      throw new BadRequestException('STUDENT_NOT_IN_CENTER');
    }
  }

  private async load(identity: SignedCenterIdentity, sessionId: string) {
    const session = await this.prisma.examSession.findFirst({
      where: { id: sessionId, center_id: identity.centerId },
      select: {
        id: true,
        modelltest_id: true,
        opens_at: true,
        closes_at: true,
        published_at: true,
        cancelled_at: true,
        force_closed_at: true,
      },
    });
    if (!session) throw new NotFoundException('EXAM_SESSION_NOT_FOUND');
    return session;
  }
}
