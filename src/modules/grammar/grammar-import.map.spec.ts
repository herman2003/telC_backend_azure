import { mapRep12GrammarRule, slugFromRep12 } from './grammar-import.map';

describe('mapRep12GrammarRule', () => {
  const sample = {
    id: 'gram_A_001',
    category_name: 'Cases',
    subcategory: 'Nominativ',
    rule_german: 'Der Nominativ bezeichnet das Subjekt.',
    rule_english: 'Nominative marks the subject.',
    example_de: 'Der Mann liest.',
    example_en: 'The man reads.',
    cefr_levels: ['A1', 'A2'],
  };

  it('maps fields and mirrors EN into FR for V1', () => {
    const mapped = mapRep12GrammarRule(sample, 3);
    expect(mapped.externalId).toBe('gram_A_001');
    expect(mapped.category).toBe('Cases');
    expect(mapped.ruleFr).toBe(sample.rule_english);
    expect(mapped.cefrLevels).toEqual(['A1', 'A2']);
    expect(mapped.sortOrder).toBe(3);
    expect(mapped.example?.de).toBe('Der Mann liest.');
  });

  it('builds a stable slug', () => {
    expect(slugFromRep12(sample)).toContain('nominativ');
    expect(slugFromRep12(sample)).toContain('gram-a-001');
  });
});
