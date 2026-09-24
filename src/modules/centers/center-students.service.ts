import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivationCodeStatus, Prisma, type CefrLevel } from '@prisma/client';
import type { CenterAccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  ProgressService,
  type StudentProgress,
} from '../progress/progress.service';

type SignedCenterIdentity = Pick<CenterAccessTokenPayload, 'centerId'>;

export interface ListStudentsQuery {
  page: number;
  pageSize: number;
}

export interface UpdateStudentInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  /** The student's current level (D38): declared by them, editable here. */
  level?: CefrLevel;
}

export interface CenterStudentView {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  level: CefrLevel | null;
  /** Skill scores, readiness and alerts (D38), from their activity. */
  progress: StudentProgress;
}

@Injectable()
export class CenterStudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
  ) {}

  async list(
    identity: SignedCenterIdentity,
    query: ListStudentsQuery,
  ): Promise<{
    students: CenterStudentView[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const where = { center_id: identity.centerId };

    const [rows, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.student.count({ where }),
    ]);

    // One query for the whole page, not one per student.
    const progress = await this.progress.forStudents(rows.map((r) => r.id));

    return {
      students: rows.map((row) => this.toView(row, progress.get(row.id)!)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(
    identity: SignedCenterIdentity,
    studentId: string,
  ): Promise<CenterStudentView> {
    const student = await this.loadOwned(identity, studentId);
    return this.withProgress(student);
  }

  /**
   * Edits a student's name, phone or level.
   *
   * Moving between plans is gone with the tiers (2026-09-23): there is one
   * plan, and what a student may do beyond it will be the add-ons of the new
   * pricing, bought per student rather than set on the roster.
   */
  async update(
    identity: SignedCenterIdentity,
    studentId: string,
    changes: UpdateStudentInput,
  ): Promise<CenterStudentView> {
    const data = {
      ...(changes.firstName !== undefined && {
        first_name: changes.firstName,
      }),
      ...(changes.lastName !== undefined && { last_name: changes.lastName }),
      ...(changes.phone !== undefined && { phone: changes.phone }),
      ...(changes.level !== undefined && { level: changes.level }),
    };

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('NO_STUDENT_FIELDS_SUPPLIED');
    }

    // Ownership first, so another center's student is a 404. Scoped by center
    // in the write itself, so the check and the update cannot disagree.
    const updated = await this.prisma.student.updateManyAndReturn({
      where: { id: studentId, center_id: identity.centerId },
      data,
    });

    if (updated.length !== 1) {
      throw new NotFoundException('STUDENT_NOT_FOUND');
    }

    return this.withProgress(updated[0]);
  }

  private async withProgress(
    row: Parameters<CenterStudentsService['toView']>[0],
  ): Promise<CenterStudentView> {
    const progress = await this.progress.forStudents([row.id]);
    return this.toView(row, progress.get(row.id)!);
  }

  /**
   * Releases the seat by unlinking, never by deleting.
   *
   * The account, the password the student chose, and every attempt they ever
   * submitted survive. Deleting would destroy a person's work because an
   * administrator edited a roster, and would discard exactly the former
   * student that `ARCHITECTURE-B2B2C.md` describes as worth keeping in touch
   * with. It also matches `Student.center_id` already being ON DELETE SET NULL.
   */
  async remove(
    // The manager too, not just the center: releasing a code is recorded
    // against whoever did it.
    identity: Pick<CenterAccessTokenPayload, 'centerId' | 'centerUserId'>,
    studentId: string,
  ): Promise<{ removed: true }> {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.student.updateMany({
        where: { id: studentId, center_id: identity.centerId },
        data: { center_id: null },
      });

      if (result.count !== 1) {
        throw new NotFoundException('STUDENT_NOT_FOUND');
      }

      // The code this student redeemed here is released with them. Left
      // connected, it would keep counting as a used seat, and — since a
      // student may hold one connected code — stop them redeeming a code at
      // any other school. Same transaction, so a roster edit can never leave
      // the two disagreeing.
      const held = await tx.activationCode.findMany({
        where: {
          student_id: studentId,
          center_id: identity.centerId,
          status: ActivationCodeStatus.CONNECTED,
        },
        select: { id: true },
      });

      for (const code of held) {
        const released = await tx.activationCode.updateMany({
          where: { id: code.id, status: ActivationCodeStatus.CONNECTED },
          data: { status: ActivationCodeStatus.DEACTIVATED },
        });

        if (released.count === 1) {
          await tx.activationCodeEvent.create({
            data: {
              code_id: code.id,
              center_id: identity.centerId,
              center_user_id: identity.centerUserId,
              from_status: ActivationCodeStatus.CONNECTED,
              to_status: ActivationCodeStatus.DEACTIVATED,
              student_id: studentId,
            },
          });
        }
      }
    });

    return { removed: true };
  }

  private async loadOwned(identity: SignedCenterIdentity, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, center_id: identity.centerId },
    });

    if (!student) {
      throw new NotFoundException('STUDENT_NOT_FOUND');
    }

    return student;
  }

  /**
   * Built field by field rather than by spreading the row. The student table
   * carries a password hash, an activation key hash and reset tokens, and a
   * spread would put every one of them in an API response the moment someone
   * added a column.
   */
  private toView(
    row: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
      created_at: Date;
      last_seen_at: Date;
      level: CefrLevel | null;
    },
    progress: StudentProgress,
  ): CenterStudentView {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      level: row.level,
      progress,
    };
  }
}
