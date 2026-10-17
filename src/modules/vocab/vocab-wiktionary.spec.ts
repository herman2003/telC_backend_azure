import { parseEnWiktionaryGermanSenses } from './vocab-wiktionary';

const ABFAHREN_EN = `==German==

===Verb===
{{de-verb}}

# {{lb|de|intransitive}} to [[depart]], to [[leave]] {{+aux|de|sein}}
#: {{ux|de|Ihr Zug '''fährt''' um fünf Uhr '''ab.'''|Her train departs at 5 o'clock.}}
#: {{ux|de|Wir werden morgen '''abfahren.'''|We will '''leave''' tomorrow}}
# {{lb|de|transitive}} to [[carry off]], to [[remove]] {{+aux|de|haben}}
#: {{ux|de|Der Müll wird zweimal pro Woche '''abgefahren'''.|The garbage is '''picked up''' twice a week.}}
# {{lb|de|intransitive|idiomatic|colloquial}} to [[go for]]; to be [[crazy]] about
#: {{ux|de|Sie '''fährt''' voll auf Kultfilme '''ab.'''|She's really crazy about cult movies.}}

====Conjugation====
{{de-conj}}
`;

describe('parseEnWiktionaryGermanSenses', () => {
  it('extracts multiple lexical senses for abfahren', () => {
    const senses = parseEnWiktionaryGermanSenses(ABFAHREN_EN, 'verb');
    expect(senses.length).toBeGreaterThanOrEqual(3);
    expect(senses[0].meaningEn.toLowerCase()).toMatch(/depart|leave/);
    expect(senses[0].exampleDe).toMatch(/Zug|ab/i);
    expect(senses[0].exampleEn).toMatch(/depart|leave/i);
    expect(senses.some((s) => /crazy|go for/i.test(s.meaningEn))).toBe(true);
  });
});
