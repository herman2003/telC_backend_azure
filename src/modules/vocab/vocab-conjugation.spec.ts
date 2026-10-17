import {
  buildConjugation,
  CONJ_PERSONS,
  hasVerbInDict,
  resolveAuxiliary,
} from './vocab-conjugation';

describe('vocab-conjugation', () => {
  it('detects verbs in the dictionary', () => {
    expect(hasVerbInDict('gehen')).toBe(true);
    expect(hasVerbInDict('abfahren')).toBe(true);
    expect(hasVerbInDict('xyznotaverb')).toBe(false);
  });

  it('uses sein for gehen and abfahren', () => {
    expect(resolveAuxiliary('gehen')).toBe('sein');
    expect(resolveAuxiliary('abfahren')).toBe('sein');
    expect(resolveAuxiliary('hören')).toBe('haben');
    expect(resolveAuxiliary('abfahren', 'haben')).toBe('haben');
  });

  it('builds all persons for präsens of abfahren', () => {
    const result = buildConjugation('abfahren');
    expect(result).not.toBeNull();
    expect(result!.auxiliary).toBe('sein');
    expect(result!.separable).toBe(true);
    expect(result!.partizipIi).toBe('abgefahren');

    const praesens = Object.fromEntries(
      result!.rows
        .filter((r) => r.tense === 'praesens')
        .map((r) => [r.person, r.form_de]),
    );
    for (const p of CONJ_PERSONS) {
      expect(praesens[p]).toBeDefined();
    }
    expect(praesens.ich).toBe('fahre ab');
    expect(praesens.du).toBe('fährst ab');
    expect(praesens.er_sie_es).toBe('fährt ab');
    expect(praesens.wir).toBe('fahren ab');
    expect(praesens.ihr).toBe('fahrt ab');
    expect(praesens.sie_Sie).toBe('fahren ab');
  });

  it('builds perfekt with sein for gehen', () => {
    const result = buildConjugation('gehen');
    expect(result).not.toBeNull();
    const perfektIch = result!.rows.find(
      (r) => r.tense === 'perfekt' && r.person === 'ich',
    );
    expect(perfektIch?.form_de).toBe('bin gegangen');
  });

  it('includes imperativ du/ihr/Sie', () => {
    const result = buildConjugation('hören');
    const imp = result!.rows.filter((r) => r.tense === 'imperativ');
    const persons = imp.map((r) => r.person).sort();
    expect(persons).toEqual(['Sie', 'du', 'ihr'].sort());
  });
});
