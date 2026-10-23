import {
  markGenericSection,
  trainingFeedbackForSection,
} from './generic-section-scoring';
import type { GenericSectionContent } from '../../shared/services/generic-exam-content.service';

const normalization = {
  trim: true,
  ignoreCase: true,
  unicodeNormalization: 'NFC' as const,
  numericAnswersStrict: false,
  fuzzyMatchingAllowed: false as const,
  unrecognizedAnswerPolicy: 'MANUAL_REVIEW' as const,
};

function section(over: Partial<GenericSectionContent>): GenericSectionContent {
  return {
    id: 'section-1',
    sectionId: 'LESEN_1',
    aufgabentyp: 'EINZELAUSWAHL',
    teil: 1,
    label: '',
    instruction: '',
    maxPoints: 5,
    scoringMode: 'AUTO',
    contentRevision: 'test-rev-1',
    material: {},
    items: [],
    ...over,
  };
}

describe('markGenericSection: the percentage', () => {
  it('scores 0 for a section with no items, rather than dividing by zero', () => {
    expect(markGenericSection(section({ items: [] }), {}).percent).toBe(0);
  });

  it('EINZELAUSWAHL: matches the selected option key', () => {
    const s = section({
      aufgabentyp: 'EINZELAUSWAHL',
      items: [
        { itemNumber: 1, prompt: null, solution: { key: 'a' }, options: [] },
        { itemNumber: 2, prompt: null, solution: { key: 'b' }, options: [] },
      ],
    });
    expect(markGenericSection(s, { '1': 'a', '2': 'x' }).percent).toBe(50);
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
    expect(markGenericSection(s, { '1': true }).percent).toBe(100);
    expect(markGenericSection(s, { '1': false }).percent).toBe(0);
  });

  it("ZUORDNUNG: a null choiceKey means the item is correctly answered with the section's own no-match key", () => {
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
    expect(markGenericSection(s, { '1': 'x', '2': 'c' }).percent).toBe(100);
    expect(markGenericSection(s, { '1': 'c', '2': 'c' }).percent).toBe(50);
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
    expect(markGenericSection(s, { '1': '  bahnhof  ' }).percent).toBe(100);
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
    expect(markGenericSection(s, { '1': 'Flughafen' }).percent).toBe(0);
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
    expect(markGenericSection(s, { '1': 'Müller' }).percent).toBe(100);
  });

  it('compares a number answer as its text, e.g. a form field sent as 25', () => {
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
    expect(markGenericSection(s, { '1': 25 }).percent).toBe(100);
    // Anything else that is not text is simply wrong, never "unrecognised".
    expect(markGenericSection(s, { '1': true })).toMatchObject({
      percent: 0,
      unrecognised: [],
    });
  });

  it('throws for an aufgabentyp with no auto-scoring rule, rather than silently scoring it', () => {
    const s = section({
      aufgabentyp: 'TEXT_SCHREIBEN',
      items: [{ itemNumber: 1, prompt: null, solution: {}, options: [] }],
    });
    expect(() => markGenericSection(s, {})).toThrow(/No auto-scoring rule/);
  });
});

describe('markGenericSection: wrong vs not recognised', () => {
  const form = section({
    aufgabentyp: 'FORMULAR_AUSFUELLEN',
    items: [
      {
        itemNumber: 1,
        prompt: 'Personen',
        solution: { acceptedAnswers: ['4'], normalization },
        options: [],
      },
      {
        itemNumber: 2,
        prompt: 'Reisetermin',
        solution: { acceptedAnswers: ['Sonntag'], normalization },
        options: [],
      },
      {
        itemNumber: 3,
        prompt: 'Zahlungsweise',
        solution: { acceptedAnswers: ['bar'], normalization },
        options: [],
      },
    ],
  });

  it('counts a matching answer correct and reports nothing to review', () => {
    expect(
      markGenericSection(form, { '1': '4', '2': 'sonntag', '3': 'Bar' }),
    ).toEqual({ correct: 3, total: 3, percent: 100, unrecognised: [] });
  });

  it('sends a non-empty answer that matches nothing to the examiner, not to zero', () => {
    // telc accepts "Sontag" for "Sonntag"; no list of variants is complete.
    const mark = markGenericSection(form, {
      '1': '4',
      '2': 'Sontag',
      '3': 'bar',
    });

    expect(mark.correct).toBe(2);
    expect(mark.unrecognised).toEqual([{ itemNumber: 2, answer: 'Sontag' }]);
  });

  it('marks a form field with choices as a closed answer: a wrong pick is wrong', () => {
    // A1 Schreiben Teil 1, field 4: Bar or Kreditkarte. Nothing to review —
    // the candidate picked one of the printed choices.
    const payment = section({
      aufgabentyp: 'FORMULAR_AUSFUELLEN',
      items: [
        {
          itemNumber: 4,
          prompt: 'Zahlungsweise',
          solution: { acceptedAnswers: ['Bar'], normalization },
          options: [
            { key: 'Bar', content: 'Bar', isCorrect: true },
            { key: 'Kreditkarte', content: 'Kreditkarte', isCorrect: false },
          ],
        },
      ],
    });

    expect(markGenericSection(payment, { '4': 'Kreditkarte' })).toEqual({
      correct: 0,
      total: 1,
      percent: 0,
      unrecognised: [],
    });
    expect(markGenericSection(payment, { '4': 'Bar' }).correct).toBe(1);
    // Not one of the choices at all: still a closed field, so wrong.
    expect(markGenericSection(payment, { '4': 'Scheck' }).unrecognised).toEqual(
      [],
    );
  });

  it('treats an empty or missing answer as wrong, not as something to review', () => {
    const mark = markGenericSection(form, { '1': '', '2': '   ' });

    expect(mark.correct).toBe(0);
    expect(mark.unrecognised).toEqual([]);
  });

  it('never reports a closed-type answer as unrecognised', () => {
    const choice = section({
      aufgabentyp: 'EINZELAUSWAHL',
      items: [
        { itemNumber: 1, prompt: null, solution: { key: 'a' }, options: [] },
      ],
    });

    expect(markGenericSection(choice, { '1': 'z' }).unrecognised).toEqual([]);
  });
});

describe('trainingFeedbackForSection', () => {
  it('matches markGenericSection percent (UNRECOGNISED counts as 0 in the total)', () => {
    const s = section({
      aufgabentyp: 'KURZANTWORT',
      items: [
        {
          itemNumber: 1,
          prompt: null,
          solution: { acceptedAnswers: ['Bahnhof'], normalization },
          options: [],
        },
        {
          itemNumber: 2,
          prompt: null,
          solution: { acceptedAnswers: ['Markt'], normalization },
          options: [],
        },
      ],
    });
    const answers = { '1': 'Bahnhof', '2': 'Flughafen' };
    const mark = markGenericSection(s, answers);
    const feedback = trainingFeedbackForSection(s, answers);

    expect(feedback.percent).toBe(mark.percent);
    expect(feedback.percent).toBe(50);
    expect(feedback.outcomes).toEqual([
      { itemNumber: 1, outcome: 'CORRECT' },
      { itemNumber: 2, outcome: 'UNRECOGNISED' },
    ]);
  });

  it('puts UNRECOGNISED free-text in review with acceptedAnswers, not closed WRONG', () => {
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
    const closed = section({
      aufgabentyp: 'EINZELAUSWAHL',
      items: [
        { itemNumber: 1, prompt: null, solution: { key: 'a' }, options: [] },
      ],
    });

    const free = trainingFeedbackForSection(s, { '1': 'Flughafen' });
    expect(free.outcomes[0].outcome).toBe('UNRECOGNISED');
    expect(free.review).toEqual([
      {
        itemNumber: 1,
        acceptedAnswers: ['Bahnhof'],
        solution: { acceptedAnswers: ['Bahnhof'], normalization },
      },
    ]);

    const wrong = trainingFeedbackForSection(closed, { '1': 'z' });
    expect(wrong.outcomes[0].outcome).toBe('WRONG');
    expect(wrong.review).toEqual([]);
  });
});
