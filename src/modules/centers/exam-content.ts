/**
 * Exam content is the training content with the answers taken out.
 *
 * `GET /exercise` ships the answer key unconditionally, and deliberately so:
 * a student practising offline needs it to see WHICH gaps were wrong, and
 * `docs/domains/answer-key-with-exercise.md` records that decision as having no
 * mode flag. An exam is the case that decision did not cover — handing a
 * candidate the answers with the questions is not an exam at all.
 *
 * Rather than a second content pipeline, the exam reuses the same builders and
 * strips the key on the way out. One source of truth for what a Teil looks
 * like; one function that says what a candidate may not see.
 *
 * Why a deny-list of key names rather than an allow-list of safe ones: a new
 * field added to a Teil should appear in the exam automatically, and the
 * fields that must never appear are a short, closed set that lives beside the
 * scoring code. An allow-list would silently drop new content instead, which
 * fails quietly in the direction of a broken exam rather than a loud one.
 */

/**
 * Every field through which a correct answer reaches a client.
 *
 * Adding a new one to a DTO without adding it here is the mistake this file
 * exists to make hard, which is why `exam-content.spec.ts` asserts that no
 * key matching /correct/i survives the strip.
 */
export const ANSWER_KEY_FIELDS: readonly string[] = [
  'correctTitleId',
  'correctOptionId',
  'correctAnswer',
  'correctWordId',
  'isCorrect',
  'answerKey',
  'transcript',
];

/**
 * The same payload with every answer-bearing field removed, at any depth.
 *
 * Arrays and plain objects are rebuilt; anything else — a Date, a number, a
 * string — is returned as it is.
 */
export function withoutAnswerKey<T>(payload: T): T {
  return strip(payload) as T;
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(strip);
  }

  // Only plain objects are walked. A Date walked as an object would come back
  // as {} and a client would render an exam with no dates in it.
  if (value === null || typeof value !== 'object') return value;
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;

  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    if (ANSWER_KEY_FIELDS.includes(key)) continue;
    out[key] = strip(inner);
  }
  return out;
}
