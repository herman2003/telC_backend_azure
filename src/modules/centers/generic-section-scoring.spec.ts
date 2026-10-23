import { scoreGenericItems } from './generic-section-scoring';
import type { GenericSectionContent } from '../../shared/services/generic-exam-content.service';

const normalization = {
  trim: true,
  ignoreCase: true,
  unicodeNormalization: 'NFC' as const,
  numericAnswersStrict: false,
  fuzzyMatchingAllowed: false as const,
  unrecognizedAnswerPolicy: 'MANUAL_REVIEW' as const,
};

function section(
  over: Partial<GenericSectionContent>,
): GenericSectionContent {
  return {
    sectionId: 'LESEN_1',
    aufgabentyp: 'EINZELAUSWAHL',
    teil: 1,
    label: '',
    instruction: '',
    maxPoints: 5,
    scoringMode: 'AUTO',
    material: {},
    items: [],
    ...over,
  };
}

describe('scoreGenericItems', () => {
  it('scores 0 for a section with no items, rather than dividing by zero', () => {
    expect(scoreGenericItems(section({ items: [] }), {})).toBe(0);
  });

  it('EINZELAUSWAHL: matches the selected option key', () => {
    const s = section({
      aufgabentyp: 'EINZELAUSWAHL',
      items: [
        { itemNumber: 1, prompt: null, solution: { key: 'a' }, options: [] },
        { itemNumber: 2, prompt: null, solution: { key: 'b' }, options: [] },
      ],
    });
    expect(scoreGenericItems(s, { '1': 'a', '2': 'x' })).toBe(50);
  });

  it('RICHTIG_FALSCH: matches the boolean value', () => {
    const s = section({
      aufgabentyp: 'RICHTIG_FALSCH',
      items: [
        {
          itemNumber: 1,
          prompt: null,
          solution: { value: true },
          options: [],
        },
      ],
    });
    expect(scoreGenericItems(s, { '1': true })).toBe(100);
    expect(scoreGenericItems(s, { '1': false })).toBe(0);
  });

  it('ZUORDNUNG: a null choiceKey means the item is correctly answered with the section\'s own no-match key', () => {
    const s = section({
      aufgabentyp: 'ZUORDNUNG',
      material: { noMatchKey: 'x' },
      items: [
        {
          itemNumber: 1,
          prompt: null,
          solution: { choiceKey: null },
          options: [],
        },
        {
          itemNumber: 2,
          prompt: null,
          solution: { choiceKey: 'c' },
          options: [],
        },
      ],
    });
    expect(scoreGenericItems(s, { '1': 'x', '2': 'c' })).toBe(100);
    expect(scoreGenericItems(s, { '1': 'c', '2': 'c' })).toBe(50);
  });

  it('KURZANTWORT: an accepted answer matches after trim and case-fold', () => {
    const s = section({
      aufgabentyp: 'KURZANTWORT',
      items: [
        {
          itemNumber: 1,
          prompt: null,
          solution: { acceptedAnswers: ['Bahnhof'], normalization },
          options: [],
        },
      ],
    });
    expect(scoreGenericItems(s, { '1': '  bahnhof  ' })).toBe(100);
  });

  it('KURZANTWORT: an unrecognized answer scores as incorrect, not a crash', () => {
    const s = section({
      aufgabentyp: 'KURZANTWORT',
      items: [
        {
          itemNumber: 1,
          prompt: null,
          solution: { acceptedAnswers: ['Bahnhof'], normalization },
          options: [],
        },
      ],
    });
    expect(scoreGenericItems(s, { '1': 'Flughafen' })).toBe(0);
  });

  it('FORMULAR_AUSFUELLEN: same matching as KURZANTWORT, keyed by field number', () => {
    const s = section({
      aufgabentyp: 'FORMULAR_AUSFUELLEN',
      items: [
        {
          itemNumber: 1,
          prompt: 'Name',
          solution: { acceptedAnswers: ['Müller'], normalization },
          options: [],
        },
      ],
    });
    expect(scoreGenericItems(s, { '1': 'Müller' })).toBe(100);
  });

  it('a non-string answer never matches a free-text accepted-answers list', () => {
    const s = section({
      aufgabentyp: 'KURZANTWORT',
      items: [
        {
          itemNumber: 1,
          prompt: null,
          solution: { acceptedAnswers: ['25'], normalization },
          options: [],
        },
      ],
    });
    expect(scoreGenericItems(s, { '1': 25 })).toBe(0);
  });

  it('throws for an aufgabentyp with no auto-scoring rule, rather than silently scoring it', () => {
    const s = section({
      aufgabentyp: 'TEXT_SCHREIBEN',
      items: [
        { itemNumber: 1, prompt: null, solution: {}, options: [] },
      ],
    });
    expect(() => scoreGenericItems(s, {})).toThrow(/No auto-scoring rule/);
  });
});
