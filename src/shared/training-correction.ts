/**
 * Pass through stored Training Corrigé JSON when it is a non-null object.
 * Shape varies by skill — see docs/contracts/training-correction-package.md
 */
export function optionalCorrection(
  raw: unknown,
): Record<string, unknown> | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return raw as Record<string, unknown>;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * A1/A2 generic items: require evidence / whyCorrect / learningPoint, then
 * pass through the rest (whyOppositeFails, whyDistractorsFail, …).
 * Map keys are item numbers as strings (`"1"`), matching generic `answers`.
 */
export function correctionMapFromGenericItems(
  items: ReadonlyArray<{ itemNumber: number; correction?: unknown }>,
): Record<string, Record<string, unknown>> | undefined {
  const out: Record<string, Record<string, unknown>> = {};
  for (const item of items) {
    const raw = optionalCorrection(item.correction);
    if (!raw) continue;
    if (
      !nonEmptyString(raw.evidence) ||
      !nonEmptyString(raw.whyCorrect) ||
      !nonEmptyString(raw.learningPoint)
    ) {
      continue;
    }
    out[String(item.itemNumber)] = raw;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
