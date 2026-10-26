import { parseTelcVocabLine, parseTelcVocabText } from './vocab-telc-pdf.parse';

describe('parseTelcVocabLine', () => {
  it('parses der/die nouns and strips /-in', () => {
    expect(parseTelcVocabLine('der/die Arbeitgeber/-in')).toEqual({
      lemma: 'Arbeitgeber',
      article: '',
      gender: null,
      pos: 'noun',
    });
  });

  it('parses article + noun and adj+noun head', () => {
    expect(parseTelcVocabLine('die Beratung')).toMatchObject({
      lemma: 'Beratung',
      article: 'die',
      pos: 'noun',
    });
    expect(parseTelcVocabLine('das internationale Unternehmen')).toMatchObject({
      lemma: 'Unternehmen',
      article: 'das',
      pos: 'noun',
    });
  });

  it('parses verbs/adjectives and strips notes', () => {
    expect(
      parseTelcVocabLine(
        'beschäftigen Bsp.: Die Deutsche Bahn beschäftigt viele Mitarbeiter.',
      ),
    ).toMatchObject({ lemma: 'beschäftigen', pos: 'verb' });
    expect(parseTelcVocabLine('handwerklich Nom.: das Handwerk')).toMatchObject(
      {
        lemma: 'handwerklich',
        pos: 'adj',
      },
    );
  });

  it('skips headers and phrases', () => {
    expect(
      parseTelcVocabLine('Wortschatz zu Lektion 1: Ein neuer Beruf'),
    ).toBeNull();
    expect(parseTelcVocabLine('jmdn. vorstellen')).toBeNull();
    expect(parseTelcVocabLine('Arbeitgeber und Branchen')).toBeNull();
  });

  it('parses alphabetical B1 lines', () => {
    expect(parseTelcVocabLine('Abfall L1')).toMatchObject({
      lemma: 'Abfall',
      pos: 'noun',
    });
    expect(parseTelcVocabLine('abdecken L11')).toMatchObject({
      lemma: 'abdecken',
      pos: 'verb',
    });
    expect(parseTelcVocabLine('Abteilungsleiter/in L8')).toMatchObject({
      lemma: 'Abteilungsleiter',
      pos: 'noun',
    });
  });
});

describe('parseTelcVocabText', () => {
  it('dedupes lemmas', () => {
    const text = ['die Beratung', 'die Beratung', 'produzieren'].join('\n');
    expect(parseTelcVocabText(text)).toHaveLength(2);
  });
});
