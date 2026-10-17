import { mapGoetheDwdsRow, mapRep12VocabRow } from './vocab-import.map';

describe('mapGoetheDwdsRow', () => {
  it('maps a Goethe noun with article', () => {
    const m = mapGoetheDwdsRow(
      {
        pos: 'Substantiv',
        articles: ['die'],
        genera: ['fem.'],
        sch: [{ lemma: 'Arbeit' }],
        url: 'https://www.dwds.de/wb/Arbeit',
      },
      'b1',
    );
    expect(m).toMatchObject({
      lemma: 'Arbeit',
      article: 'die',
      gender: 'fem',
      pos: 'noun',
      cefrLevel: 'B1',
    });
  });

  it('maps a Goethe verb and skips symbols', () => {
    expect(
      mapGoetheDwdsRow(
        { pos: 'Verb', sch: [{ lemma: 'abfahren' }], articles: [] },
        'a1',
      )?.lemma,
    ).toBe('abfahren');
    expect(
      mapGoetheDwdsRow(
        { pos: 'Symbol', sch: [{ lemma: '%' }], articles: [] },
        'a1',
      ),
    ).toBeNull();
  });
});

describe('mapRep12VocabRow', () => {
  it('maps a B1 verb', () => {
    const m = mapRep12VocabRow(
      {
        german: 'bitten',
        english: 'to ask, to invite',
        pos: 'verb',
        frequency_rank: 872,
        example_de: 'ins Zimmer bitten',
        example_en: 'to invite someone in',
      },
      'b1',
    );
    expect(m).toMatchObject({
      lemma: 'bitten',
      pos: 'verb',
      article: '',
      cefrLevel: 'B1',
      meaningEn: 'to ask',
    });
  });

  it('maps noun gender to article', () => {
    const m = mapRep12VocabRow(
      {
        german: 'Antrag',
        english: 'application',
        gender: 'der',
        pos: 'noun',
        frequency_rank: 100,
        example_de: 'einen Antrag stellen',
      },
      'a2',
    );
    expect(m?.article).toBe('der');
    expect(m?.gender).toBe('mask');
  });
});
