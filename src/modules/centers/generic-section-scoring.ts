import type { GenericSectionContent } from '../../shared/services/generic-exam-content.service';

interface NormalizationRule {
  trim: boolean;
  ignoreCase: boolean;
  unicodeNormalization: 'NFC';
  numericAnswersStrict: boolean;
  fuzzyMatchingAllowed: false;
  unrecognizedAnswerPolicy: 'MANUAL_REVIEW';
}

function normalize(value: string, rule: NormalizationRule): string {
  let v = rule.trim ? value.trim() : value;
  if (rule.unicodeNormalization === 'NFC') v = v.normalize('NFC');
  if (rule.ignoreCase) v = v.toLowerCase();
  return v;
}

function matchesAccepted(
  answer: unknown,
  accepted: string[],
  rule: NormalizationRule,
): boolean {
  if (typeof answer !== 'string') return false;
  const candidate = normalize(answer, rule);
  return accepted.some((a) => normalize(a, rule) === candidate);
}

/**
 * telc's accepted-answer contract (`docs/ideas/modelltest-content-contract.md`)
 * marks an unrecognized free-text answer `MANUAL_REVIEW`, not automatically
 * wrong -- a genuinely correct but differently-phrased answer (a date
 * written out, a spelling variant) is exactly what that policy exists for.
 * No review queue exists yet, and nothing has asked for one, so until it
 * does, an unmatched answer scores as incorrect rather than blocking the
 * whole section from auto-scoring. A documented simplification, not a
 * silent one -- see docs/plans/active/multi-level-phase-3-generic-model.md.
 */
function isItemCorrect(
  aufgabentyp: string,
  solution: Record<string, unknown>,
  material: Record<string, unknown>,
  answer: unknown,
): boolean {
  switch (aufgabentyp) {
    case 'EINZELAUSWAHL':
      return answer === solution.key;
    case 'RICHTIG_FALSCH':
      return answer === solution.value;
    case 'ZUORDNUNG': {
      // A null choiceKey is a deliberate "nothing matches" item -- the
      // candidate must pick the section's own no-match option, not leave
      // the item blank.
      const expected = solution.choiceKey ?? material.noMatchKey;
      return answer === expected;
    }
    case 'KURZANTWORT':
    case 'FORMULAR_AUSFUELLEN':
      return matchesAccepted(
        answer,
        solution.acceptedAnswers as string[],
        solution.normalization as NormalizationRule,
      );
    default:
      throw new Error(`No auto-scoring rule for aufgabentyp ${aufgabentyp}`);
  }
}

/**
 * Percentage of a generic-model section's items answered correctly -- the
 * same 0-100 convention `markAgainst` uses for the B1/B2 tables, so a
 * generic-model result reads identically everywhere a score is displayed.
 *
 * Answers are keyed by the item's own `itemNumber`, as a string -- the same
 * `answers[id]` convention training submissions already use for Lesen and
 * Sprachbausteine.
 */
export function scoreGenericItems(
  section: GenericSectionContent,
  answers: Record<string, unknown>,
): number {
  if (section.items.length === 0) return 0;

  const material = (section.material ?? {}) as Record<string, unknown>;
  const correct = section.items.filter((item) =>
    isItemCorrect(
      section.aufgabentyp,
      (item.solution ?? {}) as Record<string, unknown>,
      material,
      answers[String(item.itemNumber)],
    ),
  ).length;

  return Math.round((correct / section.items.length) * 100);
}
