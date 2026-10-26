import {
  extractCandidatesFromText,
  mergeCandidates,
  tokenizeGermanText,
} from './vocab-tokenize-de';

describe('vocab-tokenize-de', () => {
  it('tokenizes German words', () => {
    expect(tokenizeGermanText('Der Mann geht zur Bank.')).toEqual([
      'Der',
      'Mann',
      'geht',
      'zur',
      'Bank',
    ]);
  });

  it('extracts nouns with article heuristic', () => {
    const c = extractCandidatesFromText(
      'Der Mann liest das Buch. Die Frau arbeitet.',
    );
    const nouns = c.filter((x) => x.pos === 'noun');
    expect(nouns.some((n) => n.lemma === 'Mann' && n.article === 'der')).toBe(
      true,
    );
    expect(nouns.some((n) => n.lemma === 'Buch')).toBe(true);
  });

  it('keeps exam-relevant prepositions', () => {
    const c = extractCandidatesFromText('Ich fahre mit dem Bus nach Berlin.');
    expect(c.some((x) => x.pos === 'prep' && x.lemma === 'mit')).toBe(true);
    expect(c.some((x) => x.pos === 'prep' && x.lemma === 'nach')).toBe(true);
  });

  it('merges duplicate candidates with counts', () => {
    const a = extractCandidatesFromText('Der Antrag ist wichtig.');
    const b = extractCandidatesFromText('Der Antrag liegt bereit.');
    const merged = mergeCandidates([a, b]);
    const antrag = [...merged.values()].find((x) => x.lemma === 'Antrag');
    expect(antrag?.count).toBeGreaterThanOrEqual(2);
  });
});
