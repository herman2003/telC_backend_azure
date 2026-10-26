import {
  isMorphologyNoise,
  needsMultiSenseEnrich,
  orderSensesByContext,
  parseMultiSenseJson,
} from './vocab-multi-sense';

describe('parseMultiSenseJson', () => {
  it('parses wrapped senses array', () => {
    const raw = JSON.stringify({
      senses: [
        {
          meaningFr: 'partir (train)',
          meaningEn: 'to depart',
          exampleDe: 'Der Zug fährt um 10 Uhr ab.',
          exampleFr: 'Le train part à 10 h.',
          exampleEn: 'The train leaves at 10.',
        },
        {
          meaningFr: 'conduire quelqu’un',
          meaningEn: 'to drop someone off',
          exampleDe: 'Ich fahre dich zum Bahnhof ab.',
          exampleFr: 'Je te dépose à la gare.',
        },
      ],
    });
    const senses = parseMultiSenseJson(raw);
    expect(senses).toHaveLength(2);
    expect(senses?.[0].meaningFr).toBe('partir (train)');
    expect(senses?.[1].exampleFr).toContain('gare');
  });

  it('rejects empty / invalid', () => {
    expect(parseMultiSenseJson('')).toBeNull();
    expect(parseMultiSenseJson('{"senses":[]}')).toBeNull();
  });

  it('filters morphology noise senses', () => {
    const raw = JSON.stringify({
      senses: [
        {
          meaningFr: 'partir',
          meaningEn: 'to leave',
          exampleDe: 'Wir fahren ab.',
        },
        {
          meaningFr: 'gerund of abfahren',
          meaningEn: 'gerund of abfahren',
          exampleDe: 'abfahrend',
        },
      ],
    });
    const senses = parseMultiSenseJson(raw);
    expect(senses).toHaveLength(1);
    expect(senses?.[0].meaningFr).toBe('partir');
  });
});

describe('isMorphologyNoise', () => {
  it('detects conjugation labels', () => {
    expect(isMorphologyNoise('gerund of abfahren')).toBe(true);
    expect(isMorphologyNoise('partir (train)')).toBe(false);
  });
});

describe('orderSensesByContext', () => {
  const senses = [
    {
      meaningFr: 'conduire quelqu’un',
      meaningEn: 'drop off',
      exampleDe: 'Ich fahre dich ab.',
      exampleFr: null,
      exampleEn: null,
      noteFr: null,
    },
    {
      meaningFr: 'partir (train)',
      meaningEn: 'depart',
      exampleDe: 'Der Zug fährt um 10 Uhr ab.',
      exampleFr: null,
      exampleEn: null,
      noteFr: null,
    },
  ];

  it('puts MT-context sense first', () => {
    const ordered = orderSensesByContext(
      senses,
      '… Der Zug fährt um 10 Uhr ab. …',
    );
    expect(ordered[0].meaningFr).toBe('partir (train)');
    expect(ordered[1].meaningFr).toBe('conduire quelqu’un');
  });
});

describe('needsMultiSenseEnrich', () => {
  it('true for stub or single sense', () => {
    expect(needsMultiSenseEnrich([])).toBe(true);
    expect(needsMultiSenseEnrich([{ meaning_fr: 'x' }])).toBe(true);
    expect(
      needsMultiSenseEnrich([
        { meaning_fr: 'a' },
        { meaning_fr: '(à enrichir)' },
      ]),
    ).toBe(true);
  });

  it('false when already multi and filled', () => {
    expect(
      needsMultiSenseEnrich([{ meaning_fr: 'a' }, { meaning_fr: 'b' }]),
    ).toBe(false);
  });
});
