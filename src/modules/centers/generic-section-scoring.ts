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

type ItemOutcome = 'CORRECT' | 'WRONG' | 'UNRECOGNISED';

/**
 * telc's accepted-answer contract (`docs/ideas/modelltest-content-contract.md`)
 * marks an unrecognized free-text answer `MANUAL_REVIEW`, not wrong: telc
 * accepts misspellings ("Donerstach" for "Donnerstag") that no accepted-answer
 * list can enumerate. So a non-empty free-text answer that matches nothing is
 * UNRECOGNISED and goes to the examiner; an empty one is simply WRONG. Closed
 * types (a choice among keys) are never unrecognised.
 */
function outcomeOf(
  aufgabentyp: string,
  solution: Record<string, unknown>,
  material: Record<string, unknown>,
  answer: unknown,
): ItemOutcome {
  const right = (ok: boolean): ItemOutcome => (ok ? 'CORRECT' : 'WRONG');
  switch (aufgabentyp) {
    case 'EINZELAUSWAHL':
      return right(answer === solution.key);
    case 'RICHTIG_FALSCH':
      return right(answer === solution.value);
    case 'ZUORDNUNG': {
      // A null choiceKey is a deliberate "nothing matches" item -- the
      // candidate must pick the section's own no-match option, not leave
      // the item blank.
      const expected = solution.choiceKey ?? material.noMatchKey;
      return right(answer === expected);
    }
    case 'KURZANTWORT':
    case 'FORMULAR_AUSFUELLEN': {
      // A form field such as "number of people" may arrive as the number 4.
      const text = typeof answer === 'number' ? String(answer) : answer;
      if (typeof text !== 'string' || text.trim() === '') return 'WRONG';
      return matchesAccepted(
        text,
        solution.acceptedAnswers as string[],
        solution.normalization as NormalizationRule,
      )
        ? 'CORRECT'
        : 'UNRECOGNISED';
    }
    default:
      throw new Error(`No auto-scoring rule for aufgabentyp ${aufgabentyp}`);
  }
}

/** One generic-model section marked against its own key. */
export interface GenericSectionMark {
  correct: number;
  total: number;
  /** 0-100, the convention `markAgainst` uses for the B1/B2 tables. */
  percent: number;
  /** Items whose free-text answer matched no accepted answer -- the Teil
   *  cannot be decided without a person. */
  unrecognised: { itemNumber: number; answer: string }[];
}

/**
 * Marks a generic-model section. Answers are keyed by the item's own
 * `itemNumber`, as a string -- the `answers[id]` convention training
 * submissions already use for Lesen and Sprachbausteine.
 */
export function markGenericSection(
  section: GenericSectionContent,
  answers: Record<string, unknown>,
): GenericSectionMark {
  const material = (section.material ?? {}) as Record<string, unknown>;
  let correct = 0;
  const unrecognised: GenericSectionMark['unrecognised'] = [];
  for (const item of section.items) {
    const answer = answers[String(item.itemNumber)];
    const outcome = outcomeOf(
      section.aufgabentyp,
      (item.solution ?? {}) as Record<string, unknown>,
      material,
      answer,
    );
    if (outcome === 'CORRECT') correct++;
    if (outcome === 'UNRECOGNISED') {
      unrecognised.push({
        itemNumber: item.itemNumber,
        answer: String(answer),
      });
    }
  }
  const total = section.items.length;
  return {
    correct,
    total,
    percent: total === 0 ? 0 : Math.round((correct / total) * 100),
    unrecognised,
  };
}

/** A mark in telc's points for a Teil worth `maxPoints`: whole or half
 *  points, never finer, as the Bewertungsbogen gives them. */
export function pointsOf(mark: GenericSectionMark, maxPoints: number): number {
  if (mark.total === 0) return 0;
  return Math.round((mark.correct / mark.total) * maxPoints * 2) / 2;
}
