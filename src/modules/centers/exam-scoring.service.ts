import { Injectable } from '@nestjs/common';
import type { ExamBlock } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import { LesenService } from '../lesen/lesen.service';
import { SprachbausteineService } from '../sprachbausteine/sprachbausteine.service';
import { ListeningService } from '../listening/listening.service';

export type ExamSkill =
  | 'LESEN'
  | 'SPRACHBAUSTEINE'
  | 'HOEREN'
  | 'SCHREIBEN';

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
  ) {}

  async scoreBlock(input: ScoreBlockInput): Promise<ExamSectionScore[]> {
    const sections = BLOCK_SECTIONS[input.block];
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
          exercise_id: `teil${section.teil}`,
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
  private async storeWriting(
    input: ScoreBlockInput,
    section: { skill: ExamSkill; teil: string },
    answers: Record<string, unknown>,
  ): Promise<ExamSectionScore> {
    await this.prisma.writingAttempt.create({
      data: {
        student_id: input.studentId,
        exercise_id: `exam-${input.modelltestId}`,
        modelltest_id: input.modelltestId,
        content: typeof answers.text === 'string' ? answers.text : '',
        status: 'pending',
        exam_attempt_id: input.attemptId,
      },
    });

    return { skill: section.skill, teil: section.teil, score: null, pending: true };
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

  const correct = questions.filter(([id, answer]) => answers[id] === answer)
    .length;
  return Math.round((correct / questions.length) * 100);
}
