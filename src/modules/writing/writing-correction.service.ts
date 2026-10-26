import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { type CefrLevel, Prisma } from '@prisma/client';
import { diffWords } from 'diff';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  WritingGateway,
  CorrectionReadyPayload,
  DiffOp,
  TelcRatingPayload,
} from './writing.gateway';
import { WritingService } from './writing.service';
import { MODEL_SERVICE_TOKEN } from './services/model-service.interface';
import type { ModelService } from './services/model-service.interface';
import type { WritingExerciseDto } from './dto';
import { recordActivity } from '../student-activity/student-activity.writer';
import {
  buildTelcSchreibenRating,
  isTelcLetter,
  scoreFromTelcPoints,
  type TelcSchreibenCriteria,
  type TelcSchreibenRating,
} from './writing-telc-rating';
import {
  buildA12LetterRating,
  isA12Band,
  type A12Band,
  type A12LetterRating,
  type A12LetterRubric,
} from './writing-a12-letter-rating';
import { GENERIC_MODEL_LEVELS } from '../../shared/services/generic-exam-content.service';

export interface CorrectionJobData {
  attemptId: string;
  studentId: string;
  exerciseId: string;
  content: string;
  createdAt: string;
  /**
   * Whether to push the result to the student's socket. True everywhere but
   * an exam.
   *
   * In an exam the correction is a suggestion for the trainer, not a result
   * for the candidate: sending it would hand somebody their Schreiben mark
   * before a human had read it and before the center released anything.
   */
  notify?: boolean;

  /**
   * Which exam's criteria to rate against.
   *
   * Supplied by the caller, which knows it authoritatively: an exam from the
   * sitting's level, training from the exercise's Modelltest. Not resolved
   * here and not defaulted — a default is how a B2 letter gets rated against
   * B1's standard, which the points conversion then faithfully converts.
   */
  level: CefrLevel;
}

const STUB_SCORE = 75;
const STUB_FEEDBACK = 'Stub feedback. Echte Korrektur folgt.';
const STUB_CORRECTED_TEXT = '';
const STUB_DIFF: DiffOp[] = [];
const MODEL_TIMEOUT_MS = 28000;

const ALLOWED_ERROR_TYPES = ['grammar', 'vocabulary', 'spelling', 'style'];

export interface ParsedWritingCorrection {
  /** Ignored when telc criteria present; kept for legacy stub paths. */
  score?: number;
  feedback: string;
  correctedText: string;
  pointsAddressed?: number;
  criteria: TelcSchreibenCriteria;
  /** A1/A2 only — band per required Leitpunkt. */
  a12ContentBands?: A12Band[];
  a12CommunicativeDesign?: A12Band;
  corrections: Array<{
    original: string;
    corrected: string;
    explanation: string;
    error_type: string;
  }>;
}

@Injectable()
export class WritingCorrectionService {
  private readonly logger = new Logger(WritingCorrectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: WritingGateway,
    @Inject(forwardRef(() => WritingService))
    private readonly writingService: WritingService,
    @Inject(MODEL_SERVICE_TOKEN) private readonly modelService: ModelService,
  ) {}

  /**
   * Run correction via the configured model; on timeout/API/parse error fall back to stub.
   * Updates writing_attempts and emits correction_ready. Does not throw.
   */
  async runCorrection(data: CorrectionJobData): Promise<void> {
    const { attemptId, studentId, exerciseId, content, createdAt, level } =
      data;
    const completedAt = new Date().toISOString();
    const created = new Date(createdAt).getTime();
    const durationSeconds = Math.round((Date.now() - created) / 1000);

    const brief = await this.writingService
      .resolveCorrectionBrief(exerciseId)
      .catch(() => null);
    const exercise = brief?.exercise ?? null;
    const isA12Level = GENERIC_MODEL_LEVELS.includes(level);
    const useA12 = isA12Level && brief?.a12 != null;
    // Never rate an A1/A2 letter with the B1 /45 grid when the rubric is missing.
    const refuseA12WithoutRubric = isA12Level && !brief?.a12;

    let parsed: ParsedWritingCorrection | null = null;
    if (refuseA12WithoutRubric) {
      this.logger.warn(
        `A12 letter attempt ${attemptId} has no section rubric — stubbing (no B1 fallback)`,
      );
    } else {
      try {
        const a12Brief = brief?.a12;
        const prompt =
          useA12 && a12Brief
            ? this.buildA12WritingPrompt(
                content,
                exercise,
                level,
                a12Brief.rubric,
              )
            : this.buildWritingPrompt(content, exercise, level);
        const responseText = await this.callModelWithTimeout(prompt);
        parsed = useA12
          ? this.parseA12WritingResponse(responseText)
          : this.parseWritingResponse(responseText);
      } catch (err) {
        this.logger.warn(
          `Model correction failed for attempt ${attemptId}, using stub: ${(err as Error).message}`,
        );
      }
    }

    const requiredLeitpunkte = exercise?.bulletPoints?.length ?? 0;
    let telcRating: TelcSchreibenRating | null = null;
    let a12Rating: A12LetterRating | null = null;
    let score = STUB_SCORE;
    if (parsed && useA12 && brief?.a12) {
      a12Rating = buildA12LetterRating(
        parsed.a12ContentBands ?? [],
        parsed.a12CommunicativeDesign ?? 'NONE',
        brief.a12.rubric,
        brief.a12.maxPoints,
      );
      score = a12Rating.scorePercent;
    } else if (parsed && !isA12Level) {
      telcRating = buildTelcSchreibenRating(
        parsed.criteria,
        parsed.pointsAddressed,
        requiredLeitpunkte,
      );
      score = scoreFromTelcPoints(telcRating.points);
    }

    const feedback = parsed?.feedback ?? STUB_FEEDBACK;
    const correctedText = parsed?.correctedText ?? STUB_CORRECTED_TEXT;
    const pointsAddressed = parsed?.pointsAddressed;
    const diff: DiffOp[] = correctedText
      ? diffWords(content, correctedText).map((part) => ({
          op: part.added ? 'insert' : part.removed ? 'delete' : 'equal',
          text: part.value,
        }))
      : STUB_DIFF;
    const correctionsForDb = parsed?.corrections ?? [];
    const correctionsForPayload: CorrectionReadyPayload['corrections'] =
      correctionsForDb.map((c) => ({
        original: c.original,
        corrected: c.corrected,
        explanation: c.explanation,
        errorType: c.error_type,
      }));
    const telcPayload: TelcRatingPayload | undefined = telcRating
      ? {
          taskFulfilment: telcRating.taskFulfilment,
          communicativeDesign: telcRating.communicativeDesign,
          formalAccuracy: telcRating.formalAccuracy,
          points: telcRating.points,
        }
      : undefined;
    const a12Payload = a12Rating
      ? {
          scheme: 'A1_A2' as const,
          contentPointBands: a12Rating.contentPointBands,
          communicativeDesign: a12Rating.communicativeDesign,
          points: a12Rating.points,
          maxPoints: a12Rating.maxPoints,
        }
      : undefined;

    try {
      await this.prisma.$transaction(async (tx) => {
        const attempt = await tx.writingAttempt.update({
          where: { attempt_id: attemptId },
          data: {
            status: 'completed',
            score,
            feedback,
            corrected_text: correctedText,
            diff,
            points_addressed: pointsAddressed ?? null,
            telc_rating: (telcPayload ?? a12Payload ?? Prisma.DbNull) as never,
            duration_seconds: durationSeconds,
            completed_at: new Date(completedAt),
            ...(correctionsForDb.length > 0
              ? { corrections: correctionsForDb }
              : {}),
          },
          select: { student_id: true, modelltest_id: true, erasure_id: true },
        });
        // Only a real score is progress. The stub's 75 means the model
        // failed, and the student's history must not count it as a result.
        if (!parsed) return;
        // A correction run twice (a queue retry) records the attempt once.
        const recorded = await tx.studentActivity.findUnique({
          where: {
            skill_attempt_id: { skill: 'SCHREIBEN', attempt_id: attemptId },
          },
          select: { id: true },
        });
        if (recorded) return;
        await recordActivity(tx, {
          studentId: attempt.student_id,
          skill: 'SCHREIBEN',
          // B1 has one Schreiben task (teil 1). A1/A2 letter is Teil 2.
          teil: exercise?.part ?? 1,
          score,
          // Not `durationSeconds`: that is submit-to-correction time, not
          // time spent writing, and the app does not send the latter yet.
          durationSeconds: null,
          modelltestId: attempt.modelltest_id,
          attemptId,
          completedAt: new Date(completedAt),
          // Hidden by a reset while it was being corrected: so is its summary.
          erasureId: attempt.erasure_id,
        });
      });

      const payload: CorrectionReadyPayload = {
        attemptId,
        exerciseId,
        status: 'completed',
        score,
        feedback,
        originalText: content,
        correctedText,
        diff,
        pointsAddressed,
        telcRating: telcPayload,
        a12Rating: a12Payload,
        durationSeconds,
        corrections: correctionsForPayload,
      };

      if (data.notify !== false) {
        this.gateway.notifyCorrectionReady(studentId, payload);
      }
    } catch (err) {
      this.logger.error(
        `Correction failed for attempt ${attemptId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private buildWritingPrompt(
    content: string,
    exercise: WritingExerciseDto | null,
    level: CefrLevel,
  ): string {
    const exerciseBlock = exercise
      ? this.formatExerciseForPrompt(exercise)
      : '';
    const pointsCount = exercise?.bulletPoints?.length ?? 0;
    const pointsAddressedSchema =
      pointsCount > 0
        ? `\n- "points_addressed" (integer 0-${pointsCount}): how many of the ${pointsCount} required Leitpunkte (bullet points) the student addressed`
        : '';
    const pointsAddressedExample =
      pointsCount > 0 ? `\n  "points_addressed": 3,` : '';

    /**
     * telc bands criterion II by the level the writing reaches, so the bands
     * have to be stated or the model invents its own. At B2 a text that is
     * solidly B1 is a C — without that, a B1-level B2 submission comes back
     * A or B and the conversion turns it into a confidently generous mark.
     */
    const bandNote =
      level === 'B2'
        ? [
            '',
            'Banding for II Kommunikative Gestaltung at B2:',
            'A = fully meets B2, B = meets B2, C = reaches B1 only,',
            'D = A2 or below. Writing that would be good at B1 is a C here.',
          ].join('\n')
        : '';

    return `You are an expert rater for telc Deutsch ${level} Schriftlicher Ausdruck (Zertifikat Deutsch).${bandNote}
Evaluate the student email/letter against the exercise brief using official criteria. Provide a single JSON object (no markdown, no extra text) with:
- "taskFulfilment" (A|B|C|D): I Aufgabenbewältigung — did they cover the Leitpunkte appropriately? A=all required points, B=most, C=some, D=one/none or off-task
- "communicativeDesign" (A|B|C|D): II Kommunikative Gestaltung — Betreff, Anrede, Einleitung, Schluss, coherence, register
- "formalAccuracy" (A|B|C|D): III Formale Richtigkeit — grammar, spelling, morphology
- "feedback" (string): short feedback in German for a ${level} learner; mention missed Leitpunkte if any
- "corrected_text" (string): full student text rewritten with corrections; keep tone/structure
- "corrections" (array, max 10): each "original", "corrected", "explanation" (German), "error_type" (grammar|vocabulary|spelling|style)${pointsAddressedSchema}

Do NOT invent a numeric exam score — letters only. Do NOT output markdown.

Letter guide (telc-style): A = voll angemessen, B = im Großen und Ganzen angemessen, C = kaum noch akzeptabel, D = nicht ausreichend.
${exerciseBlock}
**STUDENT TEXT:**
${content}

**OUTPUT (JSON only):**
{
  "taskFulfilment": "B",
  "communicativeDesign": "A",
  "formalAccuracy": "C",${pointsAddressedExample}
  "feedback": "Sie haben die meisten Punkte behandelt. Achten Sie auf Anrede und Schluss.",
  "corrected_text": "Sehr geehrte Frau Müller,\\nich schreibe Ihnen bezüglich...",
  "corrections": [
    {
      "original": "Ich habe geschrieben",
      "corrected": "Ich schreibe",
      "explanation": "Für eine formelle E-Mail eignet sich das Präsens besser.",
      "error_type": "grammar"
    }
  ]
}`;
  }

  private formatExerciseForPrompt(exercise: WritingExerciseDto): string {
    const parts: string[] = ['**EXERCISE BRIEF:**'];
    if (exercise.intro) parts.push(exercise.intro);
    if (exercise.stimulus) {
      const s = exercise.stimulus;
      parts.push(`\n${s.heading}`);
      if (s.body) parts.push(s.body);
      if (s.features?.length) {
        parts.push('Merkmale:');
        for (const f of s.features) parts.push(`- ${f}`);
      }
      if (s.callToAction) parts.push(s.callToAction);
      if (s.contact) {
        parts.push(`${s.contact.name}`);
        for (const line of s.contact.lines) parts.push(line);
      }
    }
    parts.push(`\n${exercise.taskInstructions}`);
    if (exercise.bulletPoints?.length) {
      parts.push('Required Leitpunkte the student MUST address:');
      exercise.bulletPoints.forEach((bp, i) => parts.push(`${i + 1}. ${bp}`));
    }
    if (exercise.closingReminder) parts.push(`\n${exercise.closingReminder}`);
    return parts.join('\n') + '\n';
  }

  private async callModelWithTimeout(prompt: string): Promise<string> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('WRITING_CORRECTION_TIMEOUT'));
      }, MODEL_TIMEOUT_MS);
    });
    try {
      const result = await Promise.race([
        this.modelService.generateTextResponse(prompt),
        timeoutPromise,
      ]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  parseWritingResponse(response: string): ParsedWritingCorrection {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('NO_JSON_FOUND_IN_RESPONSE');
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const taskFulfilment = parsed.taskFulfilment ?? parsed.task_fulfilment;
    const communicativeDesign =
      parsed.communicativeDesign ?? parsed.communicative_design;
    const formalAccuracy = parsed.formalAccuracy ?? parsed.formal_accuracy;

    if (
      !isTelcLetter(taskFulfilment) ||
      !isTelcLetter(communicativeDesign) ||
      !isTelcLetter(formalAccuracy)
    ) {
      throw new Error('Invalid or missing telc letter grades');
    }

    const feedback = typeof parsed.feedback === 'string' ? parsed.feedback : '';

    const correctedText: string =
      typeof parsed.corrected_text === 'string' ? parsed.corrected_text : '';
    if (!correctedText) {
      this.logger.warn(
        'AI response missing corrected_text — keeping telc grades/feedback/corrections, no rewrite available',
      );
    }

    let pointsAddressed: number | undefined;
    if (
      typeof parsed.points_addressed === 'number' &&
      Number.isInteger(parsed.points_addressed) &&
      parsed.points_addressed >= 0
    ) {
      pointsAddressed = parsed.points_addressed;
    }

    if (!Array.isArray(parsed.corrections)) {
      throw new Error('Corrections must be an array');
    }

    const rawCorrections = parsed.corrections as unknown[];
    const corrections = rawCorrections
      .slice(0, 10)
      .map((item, index: number) => {
        if (!item || typeof item !== 'object') {
          throw new Error(`Invalid correction at index ${index}`);
        }
        const c = item as Record<string, unknown>;
        if (
          typeof c.original !== 'string' ||
          typeof c.corrected !== 'string' ||
          typeof c.explanation !== 'string' ||
          typeof c.error_type !== 'string'
        ) {
          throw new Error(`Invalid correction at index ${index}`);
        }
        if (!ALLOWED_ERROR_TYPES.includes(c.error_type)) {
          throw new Error(
            `Invalid error_type at index ${index}: ${c.error_type}`,
          );
        }
        return {
          original: c.original,
          corrected: c.corrected,
          explanation: c.explanation,
          error_type: c.error_type,
        };
      });

    return {
      feedback,
      correctedText,
      pointsAddressed,
      criteria: {
        taskFulfilment,
        communicativeDesign,
        formalAccuracy,
      },
      corrections,
    };
  }

  private buildA12WritingPrompt(
    content: string,
    exercise: WritingExerciseDto | null,
    level: CefrLevel,
    rubric: A12LetterRubric,
  ): string {
    const exerciseBlock = exercise
      ? this.formatExerciseForPrompt(exercise)
      : '';
    const n = rubric.contentPoints.selectRequired;
    const [full, partial, none] = rubric.contentPoints.pointsPerPoint;
    const [kgFull, kgPartial, kgNone] = rubric.communicativeDesign.points;

    return `You are an expert rater for telc Deutsch ${level} Schreiben Teil 2 (short letter / message).
Rate against the official ${level} half-point rubric — NOT the B1 A/B/C/D Schriftlicher Ausdruck grid.

For each of the ${n} required Leitpunkte the student was asked to cover, assign FULL / PARTIAL / NONE:
- FULL = ${full} points (point clearly covered)
- PARTIAL = ${partial} points (mentioned weakly / incomplete)
- NONE = ${none} points (missing or off-task)

Communicative design (Anrede, Anfang, Gruß / closing, overall shape):
- FULL = ${kgFull}, PARTIAL = ${kgPartial}, NONE = ${kgNone}

Provide a single JSON object (no markdown) with:
- "content_point_bands" (array of exactly ${n} strings FULL|PARTIAL|NONE), one per required Leitpunkt in order
- "communicative_design" (FULL|PARTIAL|NONE)
- "feedback" (string): short German feedback for a ${level} learner
- "corrected_text" (string): full student text rewritten with corrections
- "corrections" (array, max 10): each "original", "corrected", "explanation" (German), "error_type" (grammar|vocabulary|spelling|style)

Do NOT invent a numeric exam score. Do NOT output markdown.
${exerciseBlock}
**STUDENT TEXT:**
${content}

**OUTPUT (JSON only):**
{
  "content_point_bands": [${Array(n).fill('"FULL"').join(', ')}],
  "communicative_design": "FULL",
  "feedback": "Sie haben die Punkte behandelt. Achten Sie auf Anrede und Gruß.",
  "corrected_text": "Sehr geehrte Damen und Herren,\\nich komme...",
  "corrections": []
}`;
  }

  parseA12WritingResponse(response: string): ParsedWritingCorrection {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('NO_JSON_FOUND_IN_RESPONSE');
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const bandsRaw = parsed.content_point_bands ?? parsed.contentPointBands;
    if (!Array.isArray(bandsRaw) || bandsRaw.length === 0) {
      throw new Error('Invalid or missing content_point_bands');
    }
    const a12ContentBands: A12Band[] = bandsRaw.map((b, i) => {
      if (!isA12Band(b)) {
        throw new Error(`Invalid content_point_bands[${i}]`);
      }
      return b;
    });

    const kgRaw = parsed.communicative_design ?? parsed.communicativeDesign;
    if (!isA12Band(kgRaw)) {
      throw new Error('Invalid or missing communicative_design');
    }

    const feedback = typeof parsed.feedback === 'string' ? parsed.feedback : '';
    const correctedText =
      typeof parsed.corrected_text === 'string' ? parsed.corrected_text : '';
    if (!correctedText) {
      this.logger.warn(
        'A12 AI response missing corrected_text — keeping bands/feedback/corrections',
      );
    }

    if (!Array.isArray(parsed.corrections)) {
      throw new Error('Corrections must be an array');
    }

    const corrections = (parsed.corrections as unknown[])
      .slice(0, 10)
      .map((item, index: number) => {
        if (!item || typeof item !== 'object') {
          throw new Error(`Invalid correction at index ${index}`);
        }
        const c = item as Record<string, unknown>;
        if (
          typeof c.original !== 'string' ||
          typeof c.corrected !== 'string' ||
          typeof c.explanation !== 'string' ||
          typeof c.error_type !== 'string'
        ) {
          throw new Error(`Invalid correction fields at index ${index}`);
        }
        if (!ALLOWED_ERROR_TYPES.includes(c.error_type)) {
          throw new Error(
            `Invalid error_type at index ${index}: ${c.error_type}`,
          );
        }
        return {
          original: c.original,
          corrected: c.corrected,
          explanation: c.explanation,
          error_type: c.error_type,
        };
      });

    return {
      feedback,
      correctedText,
      a12ContentBands,
      a12CommunicativeDesign: kgRaw,
      // Placeholder — A12 path ignores B1 criteria when building the score.
      criteria: {
        taskFulfilment: 'D',
        communicativeDesign: 'D',
        formalAccuracy: 'D',
      },
      corrections,
    };
  }
}
