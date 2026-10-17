export type Rep12VocabRow = {
  german: string;
  english?: string;
  all_translations?: string;
  gender?: string;
  pos?: string;
  frequency_rank?: number | null;
  example_de?: string | null;
  example_en?: string | null;
};

export type MappedVocabImport = {
  lemma: string;
  article: string;
  gender: string | null;
  pos: 'noun' | 'verb' | 'adj' | 'adv' | 'prep' | 'other';
  cefrLevel: string;
  frequencyRank: number | null;
  meaningEn: string;
  exampleDe: string;
  exampleEn: string | null;
};

const POS_MAP: Record<string, MappedVocabImport['pos']> = {
  noun: 'noun',
  verb: 'verb',
  adjective: 'adj',
  adj: 'adj',
  adverb: 'adv',
  adv: 'adv',
  preposition: 'prep',
  prep: 'prep',
};

/** DWDS Goethe-Zertifikat list row (A1 / A2 / B1 JSON). */
export type GoetheDwdsRow = {
  pos?: string;
  articles?: string[];
  genera?: string[];
  url?: string;
  sch?: Array<{ lemma?: string; hidx?: string | null }>;
};

export type MappedGoetheImport = {
  lemma: string;
  article: string;
  gender: string | null;
  pos: 'noun' | 'verb' | 'adj' | 'adv' | 'prep';
  cefrLevel: string;
  dwdsUrl: string | null;
};

const GOETHE_POS_MAP: Record<string, MappedGoetheImport['pos']> = {
  Substantiv: 'noun',
  Verb: 'verb',
  Adjektiv: 'adj',
  'partizipiales Adjektiv': 'adj',
  Adverb: 'adv',
  Präposition: 'prep',
};

export function mapGoetheDwdsRow(
  row: GoetheDwdsRow,
  cefrLevel: string,
): MappedGoetheImport | null {
  const lemma = (row.sch?.[0]?.lemma ?? '').trim();
  if (!lemma || lemma.length < 2) return null;
  // Skip punctuation / symbols / multi-token noise
  if (!/^[\p{L}][\p{L}'’-]*$/u.test(lemma)) return null;

  const pos = GOETHE_POS_MAP[(row.pos ?? '').trim()];
  if (!pos) return null;

  const articleRaw = (row.articles?.[0] ?? '').trim().toLowerCase();
  let article = '';
  let gender: string | null = null;
  if (pos === 'noun') {
    if (articleRaw === 'der') {
      article = 'der';
      gender = 'mask';
    } else if (articleRaw === 'die') {
      article = 'die';
      gender = 'fem';
    } else if (articleRaw === 'das') {
      article = 'das';
      gender = 'neutr';
    } else {
      const g = (row.genera?.[0] ?? '').toLowerCase();
      if (g.startsWith('mask')) {
        article = 'der';
        gender = 'mask';
      } else if (g.startsWith('fem')) {
        article = 'die';
        gender = 'fem';
      } else if (g.startsWith('neutr')) {
        article = 'das';
        gender = 'neutr';
      }
    }
  }

  return {
    lemma: pos === 'noun' ? lemma : lemma.toLowerCase(),
    article: pos === 'noun' ? article : '',
    gender: pos === 'noun' ? gender : null,
    pos,
    cefrLevel: cefrLevel.toUpperCase(),
    dwdsUrl: row.url?.trim() || null,
  };
}

export function mapRep12VocabRow(
  row: Rep12VocabRow,
  cefrLevel: string,
): MappedVocabImport | null {
  const lemma = (row.german ?? '').trim();
  if (!lemma || lemma.length < 2) return null;

  const rawPos = (row.pos ?? 'other').toLowerCase().trim();
  const pos = POS_MAP[rawPos] ?? 'other';
  if (pos === 'other') return null;

  const genderRaw = (row.gender ?? '').trim().toLowerCase();
  let article = '';
  let gender: string | null = null;
  if (genderRaw === 'der' || genderRaw === 'mask' || genderRaw === 'm') {
    article = 'der';
    gender = 'mask';
  } else if (genderRaw === 'die' || genderRaw === 'fem' || genderRaw === 'f') {
    article = 'die';
    gender = 'fem';
  } else if (
    genderRaw === 'das' ||
    genderRaw === 'neutr' ||
    genderRaw === 'n'
  ) {
    article = 'das';
    gender = 'neutr';
  }

  const meaningEn = (row.english || row.all_translations || '')
    .split(',')[0]
    ?.trim();
  if (!meaningEn) return null;

  return {
    lemma: pos === 'noun' ? lemma : lemma.toLowerCase(),
    article: pos === 'noun' ? article : '',
    gender: pos === 'noun' ? gender : null,
    pos,
    cefrLevel: cefrLevel.toUpperCase(),
    frequencyRank:
      typeof row.frequency_rank === 'number' ? row.frequency_rank : null,
    meaningEn,
    exampleDe: (row.example_de ?? lemma).trim() || lemma,
    exampleEn: row.example_en?.trim() || null,
  };
}
