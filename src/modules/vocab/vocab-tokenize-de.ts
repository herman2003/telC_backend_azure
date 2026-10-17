/**
 * Lightweight German tokenization + POS heuristic for MT text analysis.
 * Not a full lemmatizer — good enough to seed VocabEntry candidates offline.
 */

export type VocabPosGuess = 'noun' | 'verb' | 'adj' | 'adv' | 'prep' | 'other';

export type TokenCandidate = {
  lemma: string;
  article: string;
  pos: VocabPosGuess;
  surface: string;
};

const STOPWORDS = new Set(
  [
    'der',
    'die',
    'das',
    'den',
    'dem',
    'des',
    'ein',
    'eine',
    'einen',
    'einem',
    'eines',
    'und',
    'oder',
    'aber',
    'als',
    'auch',
    'noch',
    'nur',
    'schon',
    'sehr',
    'hier',
    'dort',
    'ich',
    'du',
    'er',
    'sie',
    'es',
    'wir',
    'ihr',
    'mich',
    'dich',
    'sich',
    'uns',
    'euch',
    'mein',
    'dein',
    'sein',
    'ihr',
    'unser',
    'euer',
    'ist',
    'sind',
    'war',
    'waren',
    'hat',
    'haben',
    'wird',
    'werden',
    'kann',
    'können',
    'muss',
    'müssen',
    'soll',
    'sollten',
    'will',
    'wollen',
    'zu',
    'zum',
    'zur',
    'im',
    'am',
    'vom',
    'ins',
    'ans',
    'nicht',
    'kein',
    'keine',
    'ja',
    'nein',
    'so',
    'wie',
    'was',
    'wer',
    'wo',
    'wann',
    'ob',
    'dass',
    'daß',
    'wenn',
    'weil',
    'denn',
    'mit',
    'ohne',
    'für',
    'von',
    'bei',
    'nach',
    'aus',
    'auf',
    'an',
    'in',
    'über',
    'unter',
    'vor',
    'hinter',
    'zwischen',
    'durch',
    'gegen',
    'um',
    'bis',
    'seit',
    'während',
    'trotz',
    'wegen',
  ].map((w) => w.toLowerCase()),
);

/** Prepositions we keep as vocab (exam-relevant). */
const PREP_KEEP = new Set(
  [
    'mit',
    'ohne',
    'für',
    'von',
    'bei',
    'nach',
    'aus',
    'auf',
    'an',
    'in',
    'über',
    'unter',
    'vor',
    'hinter',
    'zwischen',
    'durch',
    'gegen',
    'um',
    'bis',
    'seit',
    'während',
    'trotz',
    'wegen',
  ].map((w) => w.toLowerCase()),
);

const ADV_HINTS = new Set(
  [
    'gerne',
    'oft',
    'manchmal',
    'immer',
    'nie',
    'heute',
    'morgen',
    'gestern',
    'bald',
    'gleich',
    'schon',
    'noch',
    'vielleicht',
    'leider',
    'hoffentlich',
    'eigentlich',
    'wirklich',
    'ziemlich',
    'besonders',
    'sofort',
  ].map((w) => w.toLowerCase()),
);

export function tokenizeGermanText(text: string): string[] {
  return text
    .normalize('NFC')
    .replace(/[„“”«»]/g, '"')
    .split(/[^A-Za-zÄÖÜäöüß-]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function guessPos(token: string, prev: string | null): VocabPosGuess {
  const lower = token.toLowerCase();
  if (PREP_KEEP.has(lower)) return 'prep';
  if (ADV_HINTS.has(lower)) return 'adv';
  if (/^[A-ZÄÖÜ]/.test(token) && token.length >= 3) return 'noun';
  if (
    prev &&
    /^(der|die|das|den|dem|des|ein|eine|einen|einem|eines)$/i.test(prev)
  ) {
    return 'noun';
  }
  if (/(en|eln|ern|ieren)$/i.test(lower) && lower.length >= 5) return 'verb';
  if (/(lich|ig|isch|sam|bar|los)$/i.test(lower)) return 'adj';
  if (/(te|ten|t|st)$/i.test(lower) && lower.length >= 5) return 'verb';
  return 'other';
}

function lemmaGuess(surface: string, pos: VocabPosGuess): string {
  if (pos === 'noun') return surface;
  return surface.toLowerCase();
}

/**
 * Extract candidate lemmas from raw German text.
 * Articles attached to following capitalized nouns when possible.
 */
export function extractCandidatesFromText(text: string): TokenCandidate[] {
  const tokens = tokenizeGermanText(text);
  const out: TokenCandidate[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const surface = tokens[i];
    const lower = surface.toLowerCase();
    const prev = i > 0 ? tokens[i - 1] : null;

    if (STOPWORDS.has(lower) && !PREP_KEEP.has(lower)) continue;
    if (/^\d/.test(surface)) continue;

    let article = '';
    const pos = guessPos(surface, prev);
    if (
      pos === 'noun' &&
      prev &&
      /^(der|die|das|den|dem|des|ein|eine|einen|einem|eines)$/i.test(prev)
    ) {
      const a = prev.toLowerCase();
      if (a.startsWith('ein')) {
        article = a === 'eine' || a === 'einer' ? 'eine' : 'ein';
      } else if (a === 'der' || a === 'den' || a === 'dem' || a === 'des') {
        article = 'der';
      } else if (a === 'die') {
        article = 'die';
      } else if (a === 'das') {
        article = 'das';
      }
    }

    if (pos === 'other') continue;
    if (pos === 'prep' && !PREP_KEEP.has(lower)) continue;

    const lemma = lemmaGuess(surface, pos);
    if (lemma.length < 2) continue;

    out.push({ lemma, article: pos === 'noun' ? article : '', pos, surface });
  }

  return out;
}

export function mergeCandidates(
  batches: TokenCandidate[][],
): Map<string, TokenCandidate & { count: number }> {
  const map = new Map<string, TokenCandidate & { count: number }>();
  for (const batch of batches) {
    for (const c of batch) {
      const key = `${c.pos}|${c.article}|${c.lemma}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { ...c, count: 1 });
      }
    }
  }
  return map;
}
