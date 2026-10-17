import { parseFrWiktionaryGermanSenses } from './vocab-wiktionary-fr';

const ABFAHREN_FR = `== {{langue|de}} ==
=== {{S|étymologie}} ===
: {{de-verbe à particule|séparable|ab|fahren}}

=== {{S|verbe|de}} ===
{{de-tab-conjug}}
'''abfahren''' {{pron|ˈapˌfaːʁən|de}}
# {{intransitif|de}} {{&auxiliaire|de|a1=sein}} [[partir|Partir]] (d’un endroit), [[prendre]] son [[départ]].
#* {{exemple | lang=de | Der Zug '''fährt''' am Hauptbahnhof '''ab'''. | sens=Le train part de la gare principale.}}
# {{i|de}} [[quitter#fr|Quitter]] (une autoroute).
#* {{exemple|lang=de|An der nächsten Ausfahrt '''abfahren'''.|sens=Quitter l’autoroute à la prochaine sortie.}}
# {{familier|de}} Être fan de, kiffer.
#* {{exemple | lang=de | Sie '''fährt''' voll auf Kultfilme '''ab'''. | sens=Elle kiffe les films culte.}}
`;

describe('parseFrWiktionaryGermanSenses', () => {
  it('extracts French meanings and examples for abfahren', () => {
    const senses = parseFrWiktionaryGermanSenses(ABFAHREN_FR, 'verb');
    expect(senses.length).toBeGreaterThanOrEqual(2);
    expect(senses[0].meaningFr.toLowerCase()).toMatch(/partir|départ/);
    expect(senses[0].exampleDe).toMatch(/Zug|ab/i);
    expect(senses[0].exampleFr?.toLowerCase()).toMatch(/train|part/);
    expect(senses.some((s) => /quitter|autoroute/i.test(s.meaningFr))).toBe(
      true,
    );
  });
});
