import { Injectable, NotFoundException } from '@nestjs/common';
import type { ExamBlock } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import { LesenService } from '../lesen/lesen.service';
import { SprachbausteineService } from '../sprachbausteine/sprachbausteine.service';
import { ListeningService } from '../listening/listening.service';
import { WritingCorrectionService } from '../writing/writing-correction.service';

export type ExamSkill = 'LESEN' | 'SPRACHBAUSTEINE' | 'HOEREN' | 'SCHREIBEN';

export interface ExamSectionScore {
  skill: ExamSkill;
  teil: string;
  /** Null when nothing automatic can decide it — Schreiben. */
  score: number | null;
  /** True when a human still has to mark it. */
  pending: boolean;
}

export interface ScoreBlockInput {
  attemptId: string;
  studentId: string;
  modelltestId: string;
  /**
   * Hören is reached by number rather than id, because that is how the
   * listening service names a Modelltest.
   *
   * Required, not defaulted. A default of 1 would mark a Modelltest 2 exam
   * against Modelltest 1's answers and produce a plausible, wrong score that
   * nobody could spot.
   */
  modelltestNumber: number;
  /** What the center bought. AI adds a suggestion beside the empty mark. */
  gradingTier: 'MANUAL' | 'AI';
  block: ExamBlock;
  /**
   * Keyed `SKILL_TEIL`, each holding that Teil's answers exactly as the
   * training submit takes them. Flat rather than nested so an autosave is one
   * assignment on the client and one column here.
   */
  answers: Record<string, Record<string, unknown>>;
}

/**
 * Which Teile each timed block contains, in the order telc sits them.
 *
 * Data in one place rather than spread through the scorer: Lesen and
 * Sprachbausteine sharing one 90-minute block is the fact the whole exam
 * model turns on, and it should be readable in one line.
 */
const BLOCK_SECTIONS: Record<ExamBlock, { skill: ExamSkill; teil: string }[]> =
  {
    LESEN_SPRACHBAUSTEINE: [
      { skill: 'LESEN', teil: '1' },
      { skill: 'LESEN', teil: '2' },
      { skill: 'LESEN', teil: '3' },
      { skill: 'SPRACHBAUSTEINE', teil: '1' },
      { skill: 'SPRACHBAUSTEINE', teil: '2' },
    ],
    HOEREN: [
      { skill: 'HOEREN', teil: '1' },
      { skill: 'HOEREN', teil: '2' },
      { skill: 'HOEREN', teil: '3' },
    ],
    SCHREIBEN: [{ skill: 'SCHREIBEN', teil: '1' }],
  };

/**
 * Marks a submitted block.
 *
 * Two things pull against each other here. An exam must be marked by exactly
 * the code training is marked by — one answer key, never two that can drift —
 * and it must never touch a student's training history, because an exam is
 * not practice and must not move the readiness score a center reads.
 *
 * So the answer keys come from the training services, and the writes are done
 * here: the attempt row carries `exam_attempt_id`, and no `StudentActivity`
 * is recorded.
 */
@Injectable()
export class ExamScoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lesen: LesenService,
    private readonly sprachbausteine: SprachbausteineService,
    private readonly listening: ListeningService,
    private readonly correction: WritingCorrectionService,
  ) {}

  async scoreBlock(input: ScoreBlockInput): Promise<ExamSectionScore[]> {
    const sections = BLOCK_SECTIONS[input.block];

    // Repeatable on purpose. Marking is not in the same transaction as
    // closing the block, so a submit whose marking failed has to be safe to
    // retry — and a retry that appended a second set of rows would double
    // every Teil of the block. Clearing this attempt's rows for these skills
    // first makes running it twice the same as running it once.
    await this.clearPrevious(input, sections);
    const scored: ExamSectionScore[] = [];

    for (const section of sections) {
      // A Teil the candidate never reached scores zero rather than being
      // absent: a block submitted with Teil 3 untouched is someone who ran
      // out of time, not a block that is partly unmarked.
      const answers = input.answers[`${section.skill}_${section.teil}`] ?? {};
      scored.push(await this.scoreSection(input, section, answers));
    }

    return scored;
  }

  /**
   * Removes anything a previous marking of this block left behind.
   *
   * Scoped to this attempt and to the skills in this block, so marking
   * Hören never disturbs the Lesen rows already stored.
   */
  private async clearPrevious(
    input: ScoreBlockInput,
    sections: { skill: ExamSkill; teil: string }[],
  ): Promise<void> {
    const skills = new Set(sections.map((section) => section.skill));
    const where = { exam_attempt_id: input.attemptId };

    if (skills.has('LESEN')) {
      await this.prisma.lesenAttempt.deleteMany({ where });
    }
    if (skills.has('SPRACHBAUSTEINE')) {
      await this.prisma.sprachbausteineAttempt.deleteMany({ where });
    }
    if (skills.has('HOEREN')) {
      await this.prisma.listeningAttempt.deleteMany({ where });
    }
    if (skills.has('SCHREIBEN')) {
      await this.prisma.writingAttempt.deleteMany({ where });
    }
  }

  private async scoreSection(
    input: ScoreBlockInput,
    section: { skill: ExamSkill; teil: string },
    answers: Record<string, unknown>,
  ): Promise<ExamSectionScore> {
    if (section.skill === 'SCHREIBEN') {
      return this.storeWriting(input, section, answers);
    }

    const answerKey = await this.answerKeyFor(input, section);
    const score = markAgainst(answerKey, answers);

    if (section.skill === 'HOEREN') {
      await this.prisma.listeningAttempt.create({
        data: {
          student_id: input.studentId,
          // The Teil number alone, as training writes it. `teil1` here made
          // the history reader parse Number('teil1') and get NaN.
          exercise_id: section.teil,
          status: 'completed',
          score,
          answers: answers as never,
          content_revision: '',
          modelltest_id: input.modelltestId,
          completed_at: new Date(),
          exam_attempt_id: input.attemptId,
        },
      });
    } else if (section.skill === 'LESEN') {
      await this.prisma.lesenAttempt.create({
        data: {
          student_id: input.studentId,
          teil_id: section.teil,
          modelltest_id: input.modelltestId,
          score,
          answers: answers as never,
          exam_attempt_id: input.attemptId,
        },
      });
    } else {
      await this.prisma.sprachbausteineAttempt.create({
        data: {
          student_id: input.studentId,
          teil_id: section.teil,
          modelltest_id: input.modelltestId,
          status: 'completed',
          score,
          answers: answers as never,
          content_revision: '',
          // Never, for an exam: the candidate was served the questions with
          // the answers stripped out. See exam-content.ts.
          answers_prefetched: false,
          completed_at: new Date(),
          exam_attempt_id: input.attemptId,
        },
      });
    }

    return { skill: section.skill, teil: section.teil, score, pending: false };
  }

  /**
   * Stores the Schreiben text and scores nothing.
   *
   * A human marks it — the trainer at 1,000 XAF, the AI proposing and the
   * trainer confirming at 1,500. Writing a zero here would put a failing mark
   * on a piece of work nobody has read.
   */
  /**
   * Which Schreiben task this submission answers.
   *
   * `taskId` arrives from the candidate's client, so it is resolved **within
   * this Modelltest** rather than looked up globally: without that scope a
   * submission could name any task in the catalogue and be marked against a
   * prompt the sitting never showed.
   *
   * With no `taskId` — B1, which has one task, and any client written before
   * the choice existed — the Modelltest's first task is used.
   */
  private async resolveWritingTask(
    input: ScoreBlockInput,
    answers: Record<string, unknown>,
  ): Promise<{ id: string }> {
    const taskId = typeof answers.taskId === 'string' ? answers.taskId : null;

    const task = await this.prisma.writingExercise.findFirst({
      where: {
        modelltest_id: input.modelltestId,
        ...(taskId ? { id: taskId } : {}),
      },
      orderBy: { part: 'asc' },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException(
        taskId
          ? 'WRITING_TASK_NOT_IN_MODELLTEST'
          : 'WRITING_TASK_NOT_FOUND',
      );
    }
    return task;
  }

  private async storeWriting(
    input: ScoreBlockInput,
    section: { skill: ExamSkill; teil: string },
    answers: Record<string, unknown>,
  ): Promise<ExamSectionScore> {
    const content = typeof answers.text === 'string' ? answers.text : '';
    const task = await this.resolveWritingTask(input, answers);
    const row = await this.prisma.writingAttempt.create({
      data: {
        student_id: input.studentId,
        // The task actually answered, by its own id.
        //
        // This was `exam-${modelltestId}`, which named the sitting rather
        // than the prompt. Two things went wrong with that. A trainer opening
        // the marking screen saw a letter with no way to tell which of a B2
        // choice it answered, while criterion I is exactly whether that
        // prompt's required points were addressed. And the same placeholder
        // was handed to runCorrection as its exerciseId, where getExercise
        // cannot resolve it — so every AI-tier suggestion was generated with
        // no task in the prompt and no Leitpunkte cap on criterion I.
        exercise_id: task.id,
        modelltest_id: input.modelltestId,
        content,
        status: 'pending',
        exam_attempt_id: input.attemptId,
      },
    });

    if (input.gradingTier === 'AI') {
      // A suggestion for the trainer, never a mark and never the
      // candidate's. `notify: false` is what keeps it off their socket —
      // the correction service pushes score and feedback to the student
      // otherwise, which in an exam would be the mark arriving before a
      // human had read the work.
      //
      // Not awaited: a model can take twenty seconds, and a candidate
      // pressing submit should not wait for an opinion nobody has asked
      // for yet. runCorrection does not throw, and the catch is for the
      // case it ever starts to.
      void this.correction
        .runCorrection({
          attemptId: row.attempt_id,
          studentId: input.studentId,
          exerciseId: task.id,
          content,
          createdAt: new Date().toISOString(),
          notify: false,
        })
        .catch(() => undefined);
    }

    return {
      skill: section.skill,
      teil: section.teil,
      score: null,
      pending: true,
    };
  }

  /** The key training marks against, asked of the service that owns it. */
  private async answerKeyFor(
    input: ScoreBlockInput,
    section: { skill: ExamSkill; teil: string },
  ): Promise<Record<string, string>> {
    if (section.skill === 'LESEN') {
      const rules = await this.lesen.getSubmissionRules(
        input.modelltestId,
        section.teil,
      );
      return rules.answerKey;
    }

    if (section.skill === 'HOEREN') {
      return this.listening.getAnswerKey(
        input.modelltestNumber,
        Number(section.teil),
      );
    }

    const key = await this.sprachbausteine.getAnswerKey(
      input.modelltestId,
      section.teil as '1' | '2',
    );
    return key.answers;
  }
}

/** The same arithmetic both training submits use: right answers over all of
 *  them, as a percentage. */
function markAgainst(
  answerKey: Record<string, string>,
  answers: Record<string, unknown>,
): number {
  const questions = Object.entries(answerKey);
  if (questions.length === 0) return 0;

  const correct = questions.filter(
    ([id, answer]) => answers[id] === answer,
  ).length;
  return Math.round((correct / questions.length) * 100);
}
