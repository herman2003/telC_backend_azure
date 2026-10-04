import { Injectable, NotFoundException } from '@nestjs/common';
import type { Skill } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import { ExamResultService } from './exam-result.service';

export interface ExportedSection {
  skill: Skill;
  teil: number;
  points: number | null;
  maxPoints: number;
  percent: number | null;
}

export interface ExportedRow {
  studentId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  outcome: string;
  /** Null when nobody has marked that half yet — a blank cell and a zero mean
   *  different things to whoever opens the spreadsheet. */
  writtenPoints: number | null;
  writtenMaxPoints: number;
  writtenPercent: number | null;
  oralPoints: number | null;
  oralMaxPoints: number;
  oralPercent: number | null;
  awaiting: Skill[];
  releasedAt: Date | null;
  sections: ExportedSection[];
  /** Full Schreiben letter for download/CSV; null if not submitted. */
  schreibenText: string | null;
}

export interface ExportedSitting {
  sitting: {
    sessionId: string;
    name: string;
    level: string;
    modelltest: number;
    modelltestTitle: string;
    centerName: string;
    opensAt: Date;
    closesAt: Date;
    exportedAt: Date;
  };
  rows: ExportedRow[];
  summary: {
    candidates: number;
    awaitingMarks: number;
    released: number;
    passed: number;
    failed: number;
  };
}

/**
 * A whole sitting, as rows.
 *
 * Not a file. Both clients already render, so a PDF built here would be a
 * library, a font and a memory limit for nothing — and it was agreed with the
 * Flutter team that the server ships numbers and the client formats them.
 *
 * Which puts an obligation on this: every number is finished. A client that
 * worked out a percentage would, sooner or later, disagree with the screen.
 */
@Injectable()
export class ExamExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly results: ExamResultService,
  ) {}

  async forSession(
    centerId: string,
    sessionId: string,
  ): Promise<ExportedSitting> {
    const session = await this.prisma.examSession.findFirst({
      // Scoped in the query: another school's sitting is a 404.
      where: { id: sessionId, center_id: centerId },
      select: {
        id: true,
        name: true,
        level: true,
        opens_at: true,
        closes_at: true,
        modelltest: { select: { number: true, title: true } },
        center: { select: { name: true } },
      },
    });
    if (!session) throw new NotFoundException('EXAM_SESSION_NOT_FOUND');

    const table = await this.results.forSession(centerId, sessionId);

    // One call for every candidate's Teile rather than one each. A file is
    // where an N+1 hurts most: nobody waits for a table, everybody waits for
    // a download.
    const attemptIds = table.candidates
      .map((row) => row.attemptId)
      .filter((id): id is string => id !== null);
    const details = await this.results.forAttempts(attemptIds);
    const sectionsByAttempt = new Map(
      details.map((detail) => [detail.attemptId, detail.sections]),
    );
    const schreibenByAttempt = new Map(
      details.map((detail) => [
        detail.attemptId,
        detail.schreibenSubmission?.text ?? null,
      ]),
    );

    return {
      sitting: {
        sessionId: session.id,
        name: session.name,
        level: session.level,
        modelltest: session.modelltest.number,
        modelltestTitle: session.modelltest.title,
        centerName: session.center.name,
        opensAt: session.opens_at,
        closesAt: session.closes_at,
        // So a spreadsheet found in two years says when it was taken, not
        // only what it was taken from.
        exportedAt: new Date(),
      },
      rows: table.candidates.map((row) => {
        // A half nobody has marked reports null, not zero. The two mean
        // different things to whoever reads the file, and only one is true.
        const oralUnmarked = row.awaiting.includes('SPRECHEN' as Skill);
        const writtenUnmarked = row.awaiting.includes('SCHREIBEN' as Skill);

        return {
          studentId: row.studentId,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          outcome: row.outcome,
          writtenPoints: writtenUnmarked ? null : (row.written?.points ?? null),
          writtenMaxPoints: row.written?.maxPoints ?? 0,
          writtenPercent: writtenUnmarked
            ? null
            : (row.written?.percent ?? null),
          oralPoints: oralUnmarked ? null : (row.oral?.points ?? null),
          oralMaxPoints: row.oral?.maxPoints ?? 0,
          oralPercent: oralUnmarked ? null : (row.oral?.percent ?? null),
          awaiting: row.awaiting,
          releasedAt: row.releasedAt,
          sections: row.attemptId
            ? (sectionsByAttempt.get(row.attemptId) ?? []).map((section) => ({
                skill: section.skill,
                teil: section.teil,
                points: section.points,
                maxPoints: section.maxPoints,
                percent: section.percent,
              }))
            : [],
          schreibenText: row.attemptId
            ? (schreibenByAttempt.get(row.attemptId) ?? null)
            : null,
        } satisfies ExportedRow;
      }),
      summary: table.summary,
    };
  }
}
