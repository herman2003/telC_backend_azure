/**
 * Parse telc « Einfach besser! » Beruf Wortschatzlisten (PDF text).
 * Not a Goethe-style closed exam list — publisher course lists aligned with telc Beruf B1/B2.
 */

export type TelcParsedLemma = {
  lemma: string;
  article: string;
  gender: string | null;
  pos: 'noun' | 'verb' | 'adj' | 'adv' | 'prep';
};

const SKIP_LINE =
  /^(Einfach besser|©|Bsp\.|Artikel Deutsch|Wortschatz zu Lektion|\d+$)/i;

const NOTE_CUT = /\s+(Bsp\.|Def\.|Nom\.|V\.|Adj\.|Pl\.|Komp\.|trennb\.|K\.|:)/i;

const ARTICLE_RE = /^(der\/die|der|die|das)\s+(.+)$/i;

function stripNotes(line: string): string {
  const cut = line.search(NOTE_CUT);
  return (cut >= 0 ? line.slice(0, cut) : line).trim();
}

function cleanNounHead(raw: string): string | null {
  let s = raw.trim();
  // der/die X/-in → X
  s = s.replace(/\/-?in\b/gi, '');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return null;

  // "internationale Unternehmen" / "soziale Bereich" → head noun
  const parts = s.split(' ');
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (/^[\p{L}][\p{L}'’-]*$/u.test(last) && /^[A-ZÄÖÜ]/.test(last)) {
      s = last;
    } else {
      return null; // multi-word phrase without clear head
    }
  }

  // Skip slash-compounds we can't normalize safely
  if (s.includes('/')) return null;
  if (!/^[\p{L}][\p{L}'’-]*$/u.test(s)) return null;
  if (s.length < 2) return null;
  return s;
}

function articleGender(articleTok: string): {
  article: string;
  gender: string | null;
} {
  const a = articleTok.toLowerCase();
  if (a === 'der') return { article: 'der', gender: 'mask' };
  if (a === 'die') return { article: 'die', gender: 'fem' };
  if (a === 'das') return { article: 'das', gender: 'neutr' };
  // der/die → no single article
  return { article: '', gender: null };
}

function guessOpenClassPos(lemma: string): TelcParsedLemma['pos'] | null {
  const l = lemma.toLowerCase();
  if (
    /^(sich|jmdn|jmdm|etw|etwas|jemand|mehr|weniger|fast|kein|alle|jeder|keine)$/u.test(
      l,
    )
  ) {
    return null;
  }
  if (
    /(en|eln|ern|ieren|igen)$/u.test(l) &&
    !/(ung|heit|keit|schaft|tion|tät)$/u.test(l)
  ) {
    return 'verb';
  }
  if (/(lich|ig|isch|sam|bar|iv|ell|är|os|iv)$/u.test(l)) return 'adj';
  // short lowercase tokens without verb ending → adj
  if (/^[a-zäöüß]+$/u.test(l) && l.length >= 3) return 'adj';
  return null;
}

/** Alphabetical telc lists: `Abfall L1`, `abdecken L11`, `Abteilungsleiter/in L8`. */
export function parseTelcAlphaLine(line: string): TelcParsedLemma | null {
  const raw = line.trim();
  if (
    !raw ||
    /^Alphabetische/i.test(raw) ||
    /^\d+$/.test(raw) ||
    /^[A-ZÄÖÜ]$/u.test(raw)
  ) {
    return null;
  }
  const m = raw.match(/^([\p{L}][\p{L}'’/-]*)\s+L\d+\s*$/u);
  if (!m) return null;
  const token = m[1].replace(/\/-?in$/i, '');
  if (token.includes('/') || token.includes('=')) return null;
  if (!/^[\p{L}][\p{L}'’-]*$/u.test(token) || token.length < 2) return null;

  if (/^[A-ZÄÖÜ]/.test(token)) {
    return { lemma: token, article: '', gender: null, pos: 'noun' };
  }
  const pos = guessOpenClassPos(token);
  if (!pos) return null;
  return { lemma: token.toLowerCase(), article: '', gender: null, pos };
}

export function parseTelcVocabLine(line: string): TelcParsedLemma | null {
  const alpha = parseTelcAlphaLine(line);
  if (alpha) return alpha;

  const raw = stripNotes(line.trim());
  if (!raw || SKIP_LINE.test(raw)) return null;
  if (
    /^[A-ZÄÖÜ][\p{L} ]+$/u.test(raw) &&
    !ARTICLE_RE.test(raw) &&
    raw.includes(' ')
  ) {
    // Section headers: "Arbeitgeber und Branchen"
    return null;
  }

  const m = raw.match(ARTICLE_RE);
  if (m) {
    const head = cleanNounHead(m[2]);
    if (!head) return null;
    const { article, gender } = articleGender(m[1]);
    return {
      lemma: head,
      article,
      gender,
      pos: 'noun',
    };
  }

  // Single-token open class (verb / adj)
  if (raw.includes(' ') || raw.includes('…') || raw.includes('=')) return null;
  if (!/^[\p{L}][\p{L}'’-]*$/u.test(raw)) return null;
  if (/^[A-ZÄÖÜ]/.test(raw)) return null; // bare capitalized without article → skip

  const pos = guessOpenClassPos(raw);
  if (!pos) return null;
  return {
    lemma: raw.toLowerCase(),
    article: '',
    gender: null,
    pos,
  };
}

export function parseTelcVocabText(text: string): TelcParsedLemma[] {
  const seen = new Set<string>();
  const out: TelcParsedLemma[] = [];
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseTelcVocabLine(line);
    if (!parsed) continue;
    const key = `${parsed.lemma}|${parsed.article}|${parsed.pos}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed);
  }
  return out;
}
