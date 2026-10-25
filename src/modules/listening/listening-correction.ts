/**
 * Authored Training Corrigé packages for Hören (B1/B2).
 * Contract: docs/contracts/training-correction-package.md
 */

export type ListeningCorrectionPackage = {
  evidence: string;
  whyCorrect: string;
  whyOppositeFails: string;
  learningPoint: string;
  audioHighlight?: { startMs: number | null; endMs: number | null };
};

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Returns a map keyed like answerKey (`q41`), omitting items without a
 * complete package. Incomplete JSON in the DB is skipped rather than
 * half-shown.
 */
export function correctionMapFromQuestions(
  questions: ReadonlyArray<{
    question_number: number;
    correction: unknown;
  }>,
): Record<string, ListeningCorrectionPackage> | undefined {
  const out: Record<string, ListeningCorrectionPackage> = {};
  for (const question of questions) {
    const packed = asCorrectionPackage(question.correction);
    if (!packed) continue;
    out[`q${question.question_number}`] = packed;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function asCorrectionPackage(
  raw: unknown,
): ListeningCorrectionPackage | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const evidence = nonEmptyString(row.evidence);
  const whyCorrect = nonEmptyString(row.whyCorrect);
  const whyOppositeFails = nonEmptyString(row.whyOppositeFails);
  const learningPoint = nonEmptyString(row.learningPoint);
  if (!evidence || !whyCorrect || !whyOppositeFails || !learningPoint) {
    return null;
  }

  const highlightRaw = row.audioHighlight;
  let audioHighlight: ListeningCorrectionPackage['audioHighlight'];
  if (
    highlightRaw !== null &&
    highlightRaw !== undefined &&
    typeof highlightRaw === 'object'
  ) {
    const h = highlightRaw as Record<string, unknown>;
    audioHighlight = {
      startMs: typeof h.startMs === 'number' ? h.startMs : null,
      endMs: typeof h.endMs === 'number' ? h.endMs : null,
    };
  }

  return {
    evidence,
    whyCorrect,
    whyOppositeFails,
    learningPoint,
    ...(audioHighlight ? { audioHighlight } : {}),
  };
}
