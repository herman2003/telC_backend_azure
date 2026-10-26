import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { CefrLevel, Prisma } from '@prisma/client';
import { GeminiService } from './gemini.service';
import { AiUsageService } from '../../../shared/services/ai-usage.service';
import { RateLimitService } from '../../../shared/services/rate-limit.service';
import { PrismaService } from '../../../shared/services/prisma.service';
import { recordActivity } from '../../student-activity/student-activity.writer';
import { submitOnce } from '../../student-activity/submit-once';
import {
  SpeakingEvaluationResponseDto,
  CorrectionDto,
  ScoresDto,
} from '../dto/evaluation-response.dto';
import {
  buildTelcSprechenRating,
  criterionPercent,
  m10MaxPoints,
  isTelcLetter,
  scoreFromM10Points,
  type TelcSprechenCriteria,
} from '../speaking-telc-rating';

interface SpeakingAttemptInput {
  attemptId?: string;
  durationSeconds?: number;
  modelltestNumber?: number;
  /**
   * The exam sitting this belongs to, on the 1,500 tier.
   *
   * Set, it keeps the transcript out of the student's practice history and
   * ties it to the attempt a manager reads. Unset, this is ordinary
   * practice, which is everything else that calls here.
   */
  examAttemptId?: string;
}

interface StoredSpeakingAttempt {
  student_id: string;
  evaluation: Prisma.JsonValue;
}

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);
  private readonly EVALUATION_TIMEOUT_MS = 30000;

  constructor(
    private readonly geminiService: GeminiService,
    private readonly usage: AiUsageService,
    private readonly rateLimit: RateLimitService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Evaluates a transcript, and meters it.
   *
   * The metering lives here rather than in the controller so it cannot be
   * bypassed by a second caller. `studentId` is therefore a parameter rather
   * than something the caller optionally remembers to check.
   *
   * The two orderings are the point:
   *
   * The allowance is checked BEFORE the call. Checking afterwards would let a
   * student over their limit still cost us a Gemini request, which is the
   * expense the quota exists to bound.
   *
   * The row is written AFTER the call succeeds, and only then. Charging on the
   * attempt would make the student pay for our outage: a Gemini failure would
   * spend one of a Start student's two daily sessions and hand them nothing,
   * and a bad afternoon on our side would cost them the day. Metered APIs do
   * not bill a 500. The trade is that a genuine failure can be retried for
   * free, so one counted session may cost us two calls — the right way round,
   * because the cost of our failure lands on us.
   *
   * A parse failure counts as a failure. A reply we cannot use is not a
   * session the student had.
   */
  async evaluateTranscript(
    studentId: string | undefined,
    teilNumber: number,
    transcript: string,
    attempt: SpeakingAttemptInput = {},
  ): Promise<SpeakingEvaluationResponseDto> {
    // A repeat of an attempt already evaluated is answered from what was
    // stored: before the quota and the model, so a retry from the offline
    // queue neither spends the student's allowance nor costs a second call.
    if (studentId && attempt.attemptId) {
      const earlier = await this.findAttempt(attempt.attemptId);
      if (earlier && earlier.student_id !== studentId) {
        throw new ConflictException('ATTEMPT_ID_TAKEN');
      }
      if (earlier) return this.fromStored(earlier);
    }

    // An exam is bounded by the exam rather than by the allowance: one
    // evaluation per Teil, which is exactly the three telc asks for. Without
    // it, skipping the quota would leave a candidate free to call the model
    // in a loop for as long as the block is open.
    if (studentId && attempt.examAttemptId) {
      const already = await this.prisma.speakingAttempt.findFirst({
        where: {
          exam_attempt_id: attempt.examAttemptId,
          teil_number: teilNumber,
        },
        select: { attempt_id: true },
      });
      if (already) {
        throw new ConflictException('EXAM_TEIL_ALREADY_EVALUATED');
      }
    }

    // Before the quota and the model: an unknown Modelltest is the caller's
    // mistake, and must not cost the student a session.
    //
    // Resolved for every caller, not only a signed-in one, because its `level`
    // decides which M10 table the letters are converted against. A guest used
    // to skip this and be rated as B1 by default; a default is exactly how a
    // B2 candidate gets marked against the wrong grid, so the Modelltest has
    // to exist for anyone asking.
    const modelltest = await this.prisma.modelltest.findUnique({
      where: { number: attempt.modelltestNumber ?? 1 },
      select: { id: true, level: true },
    });
    if (!modelltest) {
      throw new NotFoundException(
        `Modelltest ${attempt.modelltestNumber ?? 1} not found`,
      );
    }
    const level = modelltest.level;

    // A token naming nobody has nobody to charge, which is the same choice
    // StudentSubscriptionGuard makes for the same reason. Refusing here would
    // be a decision about authentication taken in the wrong place.
    if (studentId) {
      // The only limit left here, and it is about our bill rather than the
      // student's plan: twenty an hour bounds how fast anybody can pile calls
      // into the model.
      //
      // Grading no longer has an allowance of its own. What Lerniqo sells is
      // the conversation, charged when it starts — five a month on Start, then
      // a credit — and charging the correction that follows it as well would
      // refuse a student their feedback on a session they had already paid
      // for. That is the phase 21 bug wearing different names: a telc exam of
      // three Sprechen Teile meeting an allowance of two.
      //
      // The open edge is a transcript that arrives with no conversation behind
      // it, from the browser's own speech recognition. That path is bounded
      // only by the burst limit today; retiring it, or charging it as a
      // session, is in the backlog and needs the app to say which it still
      // uses.
      await this.rateLimit.checkAiEvaluationLimit(studentId);
    }

    const prompt = this.buildPrompt(level, teilNumber, transcript);
    const raw = await this.callWithTimeout(prompt);
    const evaluation = this.parseResponse(raw, level, teilNumber);

    if (studentId) {
      // `recordDelivered`, not `record`: the student already has their result,
      // so a failure to write the meter must not take it away.
      //
      // Caught here as well, deliberately. recordDelivered swallows its own
      // failures, but the guarantee that matters — an evaluation, once
      // produced, is always returned — should not depend on a future edit
      // keeping that method rather than swapping in `record`. The error is
      // already logged inside; this only stops it reaching the student.
      await this.usage
        .recordDelivered(studentId, 'SPEAKING_EVALUATION')
        .catch(() => undefined);

      const earlier = await this.store(
        studentId,
        teilNumber,
        transcript,
        evaluation,
        { ...attempt, modelltestId: modelltest!.id },
      );
      // Lost a race with another copy of the same attempt: answer as it was.
      if (earlier) return this.fromStored(earlier);
    }

    return evaluation;
  }

  /**
   * Keeps the evaluation, with its activity row (phase 11: `evaluate` used to
   * keep nothing). Like the meter above, a failure here is logged and does not
   * take the result away from the student who already has it.
   *
   * Returns the earlier copy when this attempt had already been stored.
   */
  private async store(
    studentId: string,
    teilNumber: number,
    transcript: string,
    evaluation: SpeakingEvaluationResponseDto,
    attempt: SpeakingAttemptInput & { modelltestId: string },
  ): Promise<StoredSpeakingAttempt | null> {
    // The model may answer 76.5; the column holds whole points.
    const score = Math.round(evaluation.scores.overall);
    try {
      const { earlier } = await submitOnce(
        studentId,
        attempt.attemptId,
        (id) => this.findAttempt(id),
        (id) =>
          this.prisma.$transaction(async (tx) => {
            const completedAt = new Date();
            await tx.speakingAttempt.create({
              data: {
                attempt_id: id,
                student_id: studentId,
                teil_number: teilNumber,
                modelltest_id: attempt.modelltestId,
                transcript,
                score,
                evaluation: evaluation as unknown as Prisma.InputJsonValue,
                duration_seconds: attempt.durationSeconds ?? null,
                exam_attempt_id: attempt.examAttemptId ?? null,
                created_at: completedAt,
              },
            });
            // Practice is recorded; an exam is not. An AI speaking session
            // sat inside a sitting must not move the readiness score a
            // center reads, or the dashboard would count the exam as
            // preparation for itself.
            if (!attempt.examAttemptId) {
              await recordActivity(tx, {
                studentId,
                skill: 'SPRECHEN',
                teil: teilNumber,
                score,
                durationSeconds: attempt.durationSeconds,
                modelltestId: attempt.modelltestId,
                attemptId: id,
                completedAt,
              });
            }
          }),
      );
      return earlier;
    } catch (err) {
      this.logger.error(
        `Speaking attempt not stored for ${studentId}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private findAttempt(
    attemptId: string,
  ): Promise<StoredSpeakingAttempt | null> {
    return this.prisma.speakingAttempt.findUnique({
      where: { attempt_id: attemptId },
      select: { student_id: true, evaluation: true },
    });
  }

  private fromStored(
    row: StoredSpeakingAttempt,
  ): SpeakingEvaluationResponseDto {
    return row.evaluation as unknown as SpeakingEvaluationResponseDto;
  }

  private buildPrompt(
    level: CefrLevel,
    teilNumber: number,
    transcript: string,
  ): string {
    const context = this.getTeilContext(level, teilNumber);
    // From the same table the letters are converted against, so the maximum
    // the model is told matches the one the backend applies. The wording below
    // still names B1 and B1's Teile; keying that on the level is task 6.
    const maxPts = m10MaxPoints(level, teilNumber);

    return `You are an expert rater for telc Deutsch ${level} Mündlicher Ausdruck (Bewertungsbogen M10), Teil ${teilNumber}.

**TEIL ${teilNumber} CONTEXT:**
${context}

**STUDENT TRANSCRIPT:**
${transcript}

**EVALUATION TASK:**
Assign letter grades A|B|C|D for the four official M10 criteria (do NOT invent numeric exam scores — letters only):
1. "expression" — Ausdrucksfähigkeit: vocabulary, role-appropriate expression, speech intention
2. "taskFulfilment" — Aufgabenbewältigung: participation, discourse/compensation strategies, fluency
3. "formalAccuracy" — Formale Richtigkeit: syntax and morphology
4. "pronunciation" — Aussprache und Intonation: estimate only from the transcript (no audio). If evidence is weak, prefer B unless the text clearly suggests severe unintelligibility.

Letter guide: A = voll angemessen, B = im Großen und Ganzen angemessen, C = kaum noch akzeptabel, D = nicht ausreichend.
Backend will convert letters to M10 points (Teil ${teilNumber} max ${maxPts}).

Also provide:
- evaluation_text: A warm, natural German paragraph (3-5 sentences) starting with "Hallo!" that a teacher would SPEAK ALOUD. Mention the four letters briefly, highlight one strength, and one specific correction. NO markdown, NO bullet points, NO headers.
- corrections: Up to 10 most important errors. error_type must be "grammar" or "vocabulary" only.
- strengths: One or two sentences in German.
- areas_for_improvement: One or two sentences in German.

**OUTPUT FORMAT (valid JSON only, no markdown code blocks):**
{
  "expression": "B",
  "taskFulfilment": "A",
  "formalAccuracy": "C",
  "pronunciation": "B",
  "evaluation_text": "Hallo! Hier sind die Ergebnisse deiner Sprechübung für Teil ${teilNumber}. Bei Ausdruck und Aufgabe liegst du gut, achte noch auf die Grammatik. Du hast zum Beispiel gesagt: ich gehen — richtig wäre: ich gehe. Weiter so!",
  "strengths": "Du beteiligst dich klar und bleibst beim Thema.",
  "areas_for_improvement": "Achte noch auf die Verbkonjugation.",
  "corrections": [
    {
      "original": "Ich gehen oft ins Kino",
      "corrected": "Ich gehe oft ins Kino",
      "explanation": "Das Verb 'gehen' muss in der ersten Person Singular konjugiert werden: 'ich gehe'.",
      "error_type": "grammar"
    }
  ]
}`;
  }

  /**
   * What the candidate was asked to do, per level and Teil.
   *
   * The Teil numbers do not mean the same thing at both levels. `Einander
   * kennenlernen` is B1's scored Teil 1 and B2's unscored introduction, so
   * B2's Teil 1 is a different task entirely. Keyed on the Teil alone, a B2
   * candidate was rated against B1's opener and told about it in fluent
   * German.
   */
  private getTeilContext(level: CefrLevel, teilNumber: number): string {
    const b1: Record<number, string> = {
      1: 'Teil 1 — Einander kennenlernen: personal introduction and background (self, hobbies, work, daily life).',
      2: 'Teil 2 — Über ein Thema sprechen: opinion and experience on a topic; give examples and elaborate.',
      3: 'Teil 3 — Gemeinsam etwas planen: plan an activity together (appointments, options, agree on next steps). This is NOT a debate.',
    };
    const b2: Record<number, string> = {
      1: 'Teil 1 — Über Erfahrungen sprechen: the candidate chose one experience topic and speaks about it for up to 1½ minutes, then answers the partner’s questions. Expect a sustained, structured account with examples, not a question-and-answer introduction.',
      2: 'Teil 2 — Diskussion: a controversial text was read. Expect the candidate to address the text, then exchange opinions, arguments and experiences with the partner, and work towards possible solutions.',
      3: 'Teil 3 — Gemeinsam etwas planen: plan an activity together and respond to the partner’s proposals (options, agreement, next steps). This is NOT a debate.',
    };
    const contexts = level === 'B2' ? b2 : b1;
    return contexts[teilNumber] ?? contexts[1];
  }

  private async callWithTimeout(prompt: string): Promise<string> {
    let timeoutId: NodeJS.Timeout;

    const evaluationPromise = this.geminiService
      .generateTextResponse(prompt)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Gemini call failed: ${message}`);
        throw new Error('GEMINI_EVALUATION_FAILED');
      });

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('EVALUATION_TIMEOUT')),
        this.EVALUATION_TIMEOUT_MS,
      );
    });

    try {
      const result = await Promise.race([evaluationPromise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      if ((error as Error).message === 'EVALUATION_TIMEOUT') {
        this.logger.warn('Evaluation timed out after 30 seconds');
      }
      throw error;
    }
  }

  parseResponse(
    response: string,
    level: CefrLevel,
    teilNumber: number,
  ): SpeakingEvaluationResponseDto {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('NO_JSON_IN_RESPONSE');

      const p = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

      const criteria: TelcSprechenCriteria = {
        expression: this.readLetter(p, 'expression'),
        taskFulfilment: this.readLetter(p, 'taskFulfilment', 'task_fulfilment'),
        formalAccuracy: this.readLetter(p, 'formalAccuracy', 'formal_accuracy'),
        pronunciation: this.readLetter(p, 'pronunciation'),
      };

      const telcRating = buildTelcSprechenRating(criteria, level, teilNumber);
      const overall = scoreFromM10Points(
        telcRating.points,
        telcRating.maxPoints,
      );

      if (typeof p.evaluation_text !== 'string' || !p.evaluation_text.trim())
        throw new Error('Missing evaluation_text');

      const rawCorrections = Array.isArray(p.corrections) ? p.corrections : [];
      const corrections: CorrectionDto[] = rawCorrections
        .slice(0, 10)
        .filter(
          (c): c is Record<string, unknown> =>
            !!c &&
            typeof c === 'object' &&
            !!(c as Record<string, unknown>).original &&
            !!(c as Record<string, unknown>).corrected &&
            !!(c as Record<string, unknown>).explanation &&
            !!(c as Record<string, unknown>).error_type,
        )
        .map((c) => ({
          original: String(c.original),
          corrected: String(c.corrected),
          explanation: String(c.explanation),
          error_type: c.error_type === 'vocabulary' ? 'vocabulary' : 'grammar',
        }));

      const scores: ScoresDto = {
        grammar: criterionPercent(
          criteria.formalAccuracy,
          level,
          teilNumber,
          'formalAccuracy',
        ),
        vocabulary: criterionPercent(
          criteria.expression,
          level,
          teilNumber,
          'expression',
        ),
        coherence: criterionPercent(
          criteria.taskFulfilment,
          level,
          teilNumber,
          'taskFulfilment',
        ),
        overall,
      };

      return {
        evaluationText: p.evaluation_text,
        scores,
        telcRating: {
          expression: telcRating.expression,
          taskFulfilment: telcRating.taskFulfilment,
          formalAccuracy: telcRating.formalAccuracy,
          pronunciation: telcRating.pronunciation,
          points: telcRating.points,
          maxPoints: telcRating.maxPoints,
          teilNumber: telcRating.teilNumber,
        },
        corrections,
        strengths: typeof p.strengths === 'string' ? p.strengths : '',
        areas_for_improvement:
          typeof p.areas_for_improvement === 'string'
            ? p.areas_for_improvement
            : '',
      };
    } catch (error) {
      this.logger.error(
        `Failed to parse evaluation response: ${(error as Error).message}`,
      );
      this.logger.debug(`Raw response: ${response}`);
      throw new Error('EVALUATION_PARSE_FAILED');
    }
  }

  private readLetter(
    parsed: Record<string, unknown>,
    camel: string,
    snake?: string,
  ): TelcSprechenCriteria[keyof TelcSprechenCriteria] {
    const value = parsed[camel] ?? (snake ? parsed[snake] : undefined);
    if (!isTelcLetter(value)) {
      throw new Error(`Invalid or missing telc letter for ${camel}`);
    }
    return value;
  }
}
