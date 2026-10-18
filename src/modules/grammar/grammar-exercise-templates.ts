/**
 * Build realistic easy / medium / hard QCMs from topic examples (no Gemini).
 * Prompts/explanations: FR / EN / DE. Options stay in German (form choice).
 * Pool sizes follow practice levels: easy=10, medium=15, hard=20.
 */

import { practicePoolCounts } from './grammar-practice-levels';

export interface GeneratedExercise {
  kind: 'mcq' | 'cloze';
  difficulty: 'easy' | 'medium' | 'hard';
  sort_order: number;
  prompt_de: string | null;
  prompt_fr: string;
  prompt_en: string;
  options_json: string[] | null;
  answer: string;
  explanation_fr: string;
  explanation_en: string;
  explanation_de: string;
}

export interface GrammarExampleInput {
  de: string;
  fr?: string | null;
  en?: string | null;
}

const GENERIC_TOPIC_DISTRACTORS_DE = [
  'Nominativ',
  'Akkusativ',
  'Dativ',
  'Genitiv',
  'Perfekt',
  'Präteritum',
  'Passiv',
  'Konjunktiv II',
  'Modalverben',
  'Relativsätze',
  'Präpositionen',
  'Adjektivdeklination',
  'Wortstellung',
  'Nebensätze',
] as const;

const ARTICLE_FORMS = [
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
] as const;

function scrambleOptions(
  correct: string,
  distractors: string[],
  seedOffset = 0,
): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of [correct, ...distractors]) {
    const d = raw?.trim();
    if (!d) continue;
    const key = d.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(d);
  }
  // Prefer keeping the exact correct casing first in the pool identity.
  if (!unique.includes(correct) && correct.trim()) {
    unique.unshift(correct.trim());
  }
  const seed = correct.length + unique.join('').length + seedOffset * 17;
  return unique.sort((a, b) => {
    const ha = (a.charCodeAt(0) + seed) % 97;
    const hb = (b.charCodeAt(0) + seed) % 97;
    return ha - hb || a.localeCompare(b);
  });
}

function takeDistractors(
  preferred: string[],
  fallback: readonly string[],
  correct: string,
  count: number,
  rotate = 0,
): string[] {
  const rotated = [
    ...rotateList(preferred, rotate),
    ...rotateList([...fallback], rotate),
  ];
  const out: string[] = [];
  for (const d of rotated) {
    if (!d || d === correct || out.includes(d)) continue;
    out.push(d);
    if (out.length >= count) break;
  }
  return out;
}

function rotateList<T>(items: T[], offset: number): T[] {
  if (items.length === 0) return items;
  const n = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(n), ...items.slice(0, n)];
}

/** Drop meta “we practise X” filler; keep real grammar sentences. */
export function isPedagogicalExample(de: string, titleDe: string): boolean {
  const t = de.trim();
  if (t.length < 8) return false;
  const quotedTitle = new RegExp(
    `[„"«]\\s*${escapeRegExp(titleDe)}\\s*[“"»]`,
    'i',
  );
  if (quotedTitle.test(t)) return false;
  if (
    /üben wir|Beispiel zu|Ohne Kontext|Im Kurs wiederholen|Hier üben|bilden\?/i.test(
      t,
    )
  ) {
    return false;
  }
  return true;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Legacy summary format, retained to recognize already-stored explanations. */
export function shortExplanation(rule: string, max = 320): string {
  const plain = rule
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\|[^\n]*\|/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return rule.trim().slice(0, max);
  return plain.length <= max ? plain : `${plain.slice(0, max - 1)}…`;
}

/** Plausible wrong German sentences from a correct one. */
export function germanFormDistractors(correct: string): string[] {
  const trimmed = correct.trim();
  if (!trimmed)
    return ['Das ist falsch.', 'So sagt man nicht.', 'Falsche Form.'];

  const words = trimmed.split(/\s+/);
  const distractors: string[] = [];

  const push = (s: string) => {
    if (s && s !== trimmed && !distractors.includes(s)) distractors.push(s);
  };

  // Case / article slips (most realistic for German grammar)
  push(
    trimmed
      .replace(/\bDer\b/g, 'Den')
      .replace(/\bDie\b/g, 'Der')
      .replace(/\bDas\b/g, 'Dem')
      .replace(/\bder\b/g, 'den')
      .replace(/\bdie\b/g, 'der')
      .replace(/\bdas\b/g, 'dem')
      .replace(/\bden\b/g, 'dem')
      .replace(/\bdem\b/g, 'den')
      .replace(/\bein\b/g, 'einen')
      .replace(/\beine\b/g, 'einer')
      .replace(/\beinen\b/g, 'einem'),
  );

  // Word-order error (V2 slip)
  if (words.length >= 3) {
    const swapped = [...words];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    push(swapped.join(' '));
  }
  if (words.length >= 4) {
    const mid = [...words];
    [mid[1], mid[2]] = [mid[2], mid[1]];
    push(mid.join(' '));
  }

  // Drop a content word
  if (words.length >= 4) {
    push(words.filter((_, idx) => idx !== 2).join(' '));
  }

  // Wrong verb ending feel
  if (words.length >= 2) {
    const verbish = [...words];
    const vi = Math.min(1, verbish.length - 1);
    verbish[vi] = verbish[vi]
      .replace(/t$/, 'en')
      .replace(/en$/, 't')
      .replace(/st$/, 'en');
    push(verbish.join(' '));
  }

  const fallbacks = [
    `${trimmed.replace(/\.$/, '')} nicht.`,
    words.length >= 2
      ? `${words[1]} ${words[0]} ${words.slice(2).join(' ')}`.trim()
      : 'So formuliert man das nicht.',
  ];
  for (const f of fallbacks) {
    if (distractors.length >= 3) break;
    push(f);
  }

  return distractors.slice(0, 3);
}

function firstArticle(
  sentence: string,
): { article: string; rest: string } | null {
  const m = sentence
    .trim()
    .match(/^(Der|Die|Das|Den|Dem|Des|Ein|Eine|Einen|Einem|Eines)\s+(.+)$/i);
  if (!m) return null;
  return { article: m[1], rest: m[2] };
}

function articleDistractors(correct: string, rotate = 0): string[] {
  const lower = correct.toLowerCase();
  const capitalize = correct[0] === correct[0]?.toUpperCase();
  const rivals = ARTICLE_FORMS.filter((a) => a !== lower);
  const cased = rivals.map((a) =>
    capitalize ? a.charAt(0).toUpperCase() + a.slice(1) : a,
  );
  return takeDistractors(cased, [], correct, 3, rotate);
}

function contentWords(sentence: string): string[] {
  return sentence
    .split(/\s+/)
    .map((w) => w.replace(/[.,!?;:„"»«]/g, ''))
    .filter((w) => w.length >= 3);
}

function clozeWord(
  sentence: string,
  word: string,
): { target: string; cloze: string } {
  const cloze = sentence.replace(
    new RegExp(`\\b${escapeRegExp(word)}\\b`),
    '_____',
  );
  return { target: word, cloze };
}

function wordFormDistractors(target: string, rotate = 0): string[] {
  const lower = target.toLowerCase();
  const isArticle = (ARTICLE_FORMS as readonly string[]).includes(lower);
  if (isArticle) {
    return articleDistractors(target, rotate);
  }
  const mutations = [
    target.replace(/en$/, 'em'),
    target.replace(/er$/, 'en'),
    target.replace(/e$/, 'en'),
    target.replace(/t$/, 'en'),
    target.replace(/n$/, ''),
    target.endsWith('e') ? target : `${target}e`,
  ].filter((x) => x && x !== target && x.length >= 2);
  return takeDistractors(mutations, ARTICLE_FORMS, target, 3, rotate);
}

function pickExamples(
  examples: GrammarExampleInput[],
  titleDe: string,
): string[] {
  const pedagogical = examples
    .map((e) => e.de?.trim())
    .filter((de): de is string => !!de && isPedagogicalExample(de, titleDe));
  if (pedagogical.length > 0) return pedagogical;
  return examples
    .map((e) => e.de?.trim())
    .filter((de): de is string => !!de && de.length >= 8);
}

function tipBundle(ruleFr: string, ruleEn: string, ruleDe: string) {
  return {
    explanation_fr: ruleFr.trim(),
    explanation_en: ruleEn.trim(),
    explanation_de: ruleDe.trim(),
  };
}

function buildEasy(
  sentences: string[],
  tips: ReturnType<typeof tipBundle>,
  count: number,
): GeneratedExercise[] {
  const out: GeneratedExercise[] = [];
  let i = 0;
  while (out.length < count && sentences.length > 0) {
    const sentence = sentences[i % sentences.length];
    const mode = i % 3;
    const sort_order = out.length;

    if (mode === 0) {
      // Choose the correct full sentence
      out.push({
        kind: 'mcq',
        difficulty: 'easy',
        sort_order,
        prompt_de: `Welche Formulierung ist richtig?\n« … »`,
        prompt_fr: `Quelle formulation est correcte pour ce modèle ?`,
        prompt_en: `Which wording is correct for this pattern?`,
        options_json: scrambleOptions(
          sentence,
          germanFormDistractors(sentence),
          i,
        ),
        answer: sentence,
        ...tips,
      });
    } else if (mode === 1) {
      const art = firstArticle(sentence);
      if (art) {
        out.push({
          kind: 'mcq',
          difficulty: 'easy',
          sort_order,
          prompt_de: `Welcher Artikel passt?\n_____ ${art.rest}`,
          prompt_fr: `Quel article convient ?\n_____ ${art.rest}`,
          prompt_en: `Which article fits?\n_____ ${art.rest}`,
          options_json: scrambleOptions(
            art.article,
            articleDistractors(art.article, i),
            i,
          ),
          answer: art.article,
          ...tips,
        });
      } else {
        const words = contentWords(sentence);
        const target = words[0] ?? sentence.split(/\s+/)[0] ?? sentence;
        const { cloze } = clozeWord(sentence, target);
        out.push({
          kind: 'mcq',
          difficulty: 'easy',
          sort_order,
          prompt_de: `Ergänze das fehlende Wort:\n${cloze}`,
          prompt_fr: `Complète le mot manquant :\n${cloze}`,
          prompt_en: `Fill in the missing word:\n${cloze}`,
          options_json: scrambleOptions(
            target,
            wordFormDistractors(target, i),
            i,
          ),
          answer: target,
          ...tips,
        });
      }
    } else {
      // Spot the correct NP / first chunk
      const words = sentence.split(/\s+/);
      const chunk = words.slice(0, Math.min(2, words.length)).join(' ');
      const wrongChunks = germanFormDistractors(sentence)
        .map((s) =>
          s
            .split(/\s+/)
            .slice(0, Math.min(2, s.split(/\s+/).length))
            .join(' '),
        )
        .filter((c) => c && c !== chunk);
      out.push({
        kind: 'mcq',
        difficulty: 'easy',
        sort_order,
        prompt_de: `In diesem Satz — was steht am Anfang korrekt?\n« ${sentence} »`,
        prompt_fr: `Dans cette phrase — quel début est correct ?\n« ${sentence} »`,
        prompt_en: `In this sentence — which opening is correct?\n« ${sentence} »`,
        options_json: scrambleOptions(
          chunk,
          takeDistractors(
            wrongChunks,
            ['Den Mann', 'Dem Kind', 'Die Buch'],
            chunk,
            3,
            i,
          ),
          i,
        ),
        answer: chunk,
        ...tips,
      });
    }
    i += 1;
    if (i > count * 4) break;
  }
  return out.slice(0, count);
}

function buildMedium(
  sentences: string[],
  tips: ReturnType<typeof tipBundle>,
  count: number,
): GeneratedExercise[] {
  const out: GeneratedExercise[] = [];
  let i = 0;
  while (out.length < count && sentences.length > 0) {
    const sentence = sentences[i % sentences.length];
    const mode = i % 4;
    const sort_order = out.length;
    const words = contentWords(sentence);

    if (mode === 0 || mode === 1) {
      // Cloze a decisive content word (not always first)
      const idx = words.length > 0 ? (i + mode) % words.length : 0;
      const target = words[idx] ?? sentence.split(/\s+/)[0] ?? 'der';
      const { cloze } = clozeWord(sentence, target);
      out.push({
        kind: 'mcq',
        difficulty: 'medium',
        sort_order,
        prompt_de: `Ergänze sinnvoll (achte auf die Form):\n${cloze}`,
        prompt_fr: `Complète de façon pertinente (attention à la forme) :\n${cloze}`,
        prompt_en: `Complete meaningfully (watch the form):\n${cloze}`,
        options_json: scrambleOptions(
          target,
          wordFormDistractors(target, i),
          i,
        ),
        answer: target,
        ...tips,
      });
    } else if (mode === 2) {
      const art = firstArticle(sentence);
      if (art) {
        out.push({
          kind: 'mcq',
          difficulty: 'medium',
          sort_order,
          prompt_de: `Wähle die passende Form des Artikels im Kontext:\n_____ ${art.rest}`,
          prompt_fr: `Choisis la forme d’article adaptée au contexte :\n_____ ${art.rest}`,
          prompt_en: `Choose the article form that fits the context:\n_____ ${art.rest}`,
          options_json: scrambleOptions(
            art.article,
            articleDistractors(art.article, i + 1),
            i,
          ),
          answer: art.article,
          ...tips,
        });
      } else if (words.length >= 2) {
        const target = words[1];
        const { cloze } = clozeWord(sentence, target);
        out.push({
          kind: 'mcq',
          difficulty: 'medium',
          sort_order,
          prompt_de: `Welche Form gehört hier?\n${cloze}`,
          prompt_fr: `Quelle forme appartient ici ?\n${cloze}`,
          prompt_en: `Which form belongs here?\n${cloze}`,
          options_json: scrambleOptions(
            target,
            wordFormDistractors(target, i + 2),
            i,
          ),
          answer: target,
          ...tips,
        });
      }
    } else {
      // Minimal pairs: correct vs near-miss full sentences
      out.push({
        kind: 'mcq',
        difficulty: 'medium',
        sort_order,
        prompt_de: `Nur eine Variante ist grammatikalisch stimmig. Welche?`,
        prompt_fr: `Une seule variante est grammaticalement cohérente. Laquelle ?`,
        prompt_en: `Only one variant is grammatically sound. Which one?`,
        options_json: scrambleOptions(
          sentence,
          germanFormDistractors(sentence),
          i + 3,
        ),
        answer: sentence,
        ...tips,
      });
    }
    i += 1;
    if (i > count * 5) break;
  }
  return out.slice(0, count);
}

function buildHard(
  sentences: string[],
  titleDe: string,
  titleFr: string,
  titleEn: string,
  tips: ReturnType<typeof tipBundle>,
  otherTitlesDe: string[],
  count: number,
): GeneratedExercise[] {
  const out: GeneratedExercise[] = [];
  let i = 0;
  while (out.length < count && sentences.length > 0) {
    const sentence = sentences[i % sentences.length];
    const mode = i % 5;
    const sort_order = out.length;
    const wrong = germanFormDistractors(sentence)[0] ?? `${sentence} nicht.`;

    if (mode === 0) {
      // Spot the error: which sentence is wrong?
      out.push({
        kind: 'mcq',
        difficulty: 'hard',
        sort_order,
        prompt_de: `Welche Variante enthält einen typischen Fehler?`,
        prompt_fr: `Quelle variante contient une erreur typique ?`,
        prompt_en: `Which variant contains a typical error?`,
        options_json: scrambleOptions(
          wrong,
          [sentence, ...germanFormDistractors(sentence).slice(1)],
          i,
        ),
        answer: wrong,
        ...tips,
      });
    } else if (mode === 1) {
      // Correction choice
      out.push({
        kind: 'mcq',
        difficulty: 'hard',
        sort_order,
        prompt_de: `Korrigiere den fehlerhaften Satz:\n« ${wrong} »`,
        prompt_fr: `Corrige la phrase incorrecte :\n« ${wrong} »`,
        prompt_en: `Correct the faulty sentence:\n« ${wrong} »`,
        options_json: scrambleOptions(
          sentence,
          germanFormDistractors(sentence),
          i + 1,
        ),
        answer: sentence,
        ...tips,
      });
    } else if (mode === 2) {
      // Why / what fits this example (topic, but contextualized)
      out.push({
        kind: 'mcq',
        difficulty: 'hard',
        sort_order,
        prompt_de: `Welches Grammatikprinzip erklärt am besten:\n« ${sentence} »?`,
        prompt_fr: `Quel principe grammatical explique le mieux :\n« ${sentence} » ?`,
        prompt_en: `Which grammar principle best explains:\n« ${sentence} »?`,
        options_json: scrambleOptions(
          titleDe,
          takeDistractors(
            otherTitlesDe,
            GENERIC_TOPIC_DISTRACTORS_DE,
            titleDe,
            3,
            i,
          ),
          i,
        ),
        answer: titleDe,
        explanation_fr: `${tips.explanation_fr}\n\nThème : ${titleFr}.`,
        explanation_en: `${tips.explanation_en}\n\nTopic: ${titleEn}.`,
        explanation_de: `${tips.explanation_de}\n\nThema: ${titleDe}.`,
      });
    } else if (mode === 3) {
      // Cloze hardest word (last content word — often object / ending)
      const words = contentWords(sentence);
      const target =
        words[words.length - 1] ??
        sentence
          .split(/\s+/)
          .pop()
          ?.replace(/[.,!?]/g, '') ??
        titleDe;
      const { cloze } = clozeWord(sentence, target);
      out.push({
        kind: 'mcq',
        difficulty: 'hard',
        sort_order,
        prompt_de: `Präzise Ergänzung (Form + Kontext):\n${cloze}`,
        prompt_fr: `Complétion précise (forme + contexte) :\n${cloze}`,
        prompt_en: `Precise completion (form + context):\n${cloze}`,
        options_json: scrambleOptions(
          target,
          wordFormDistractors(target, i + 4),
          i,
        ),
        answer: target,
        ...tips,
      });
    } else {
      // Apply: given two near options, pick the one that matches the rule
      const art = firstArticle(sentence);
      if (art) {
        const rival = articleDistractors(art.article, i)[0] ?? 'den';
        out.push({
          kind: 'mcq',
          difficulty: 'hard',
          sort_order,
          prompt_de: `Für « ${titleDe} » — welche Fortsetzung ist stimmig?\n_____ ${art.rest}`,
          prompt_fr: `Pour « ${titleFr} » — quelle suite est cohérente ?\n_____ ${art.rest}`,
          prompt_en: `For « ${titleEn} » — which continuation fits?\n_____ ${art.rest}`,
          options_json: scrambleOptions(
            art.article,
            [rival, ...articleDistractors(art.article, i + 2)],
            i,
          ),
          answer: art.article,
          ...tips,
        });
      } else {
        out.push({
          kind: 'mcq',
          difficulty: 'hard',
          sort_order,
          prompt_de: `Welche Version wendet « ${titleDe} » korrekt an?`,
          prompt_fr: `Quelle version applique correctement « ${titleFr} » ?`,
          prompt_en: `Which version correctly applies « ${titleEn} »?`,
          options_json: scrambleOptions(
            sentence,
            germanFormDistractors(sentence),
            i + 5,
          ),
          answer: sentence,
          ...tips,
        });
      }
    }
    i += 1;
    if (i > count * 6) break;
  }
  return out.slice(0, count);
}

export function generateExercisesFromExamples(input: {
  titleFr: string;
  titleEn: string | null;
  titleDe: string;
  ruleFr: string;
  ruleEn: string | null;
  ruleDe: string;
  examples: GrammarExampleInput[];
  otherTitlesDe?: string[];
}): GeneratedExercise[] {
  const {
    titleFr,
    titleEn,
    titleDe,
    ruleFr,
    ruleEn,
    ruleDe,
    examples,
    otherTitlesDe = [],
  } = input;
  const ruleEnResolved = ruleEn?.trim() || ruleFr;
  const titleEnResolved = titleEn?.trim() || titleFr;
  const tips = tipBundle(ruleFr, ruleEnResolved, ruleDe);
  const sentences = pickExamples(examples, titleDe);
  const counts = practicePoolCounts();

  if (sentences.length === 0) {
    return generateMinimalExercises({
      titleFr,
      titleEn,
      titleDe,
      ruleFr,
      ruleEn,
      ruleDe,
      otherTitlesDe,
    });
  }

  return [
    ...buildEasy(sentences, tips, counts.easy),
    ...buildMedium(sentences, tips, counts.medium),
    ...buildHard(
      sentences,
      titleDe,
      titleFr,
      titleEnResolved,
      tips,
      otherTitlesDe,
      counts.hard,
    ),
  ];
}

/** @deprecated Prefer generateExercisesFromExamples — kept for single-example call sites. */
export function generateExercisesFromExample(input: {
  titleFr: string;
  titleEn: string | null;
  titleDe: string;
  ruleFr: string;
  ruleEn: string | null;
  ruleDe: string;
  exampleDe: string;
  exampleEn: string | null;
  exampleFr?: string | null;
  otherTitlesDe?: string[];
}): GeneratedExercise[] {
  return generateExercisesFromExamples({
    titleFr: input.titleFr,
    titleEn: input.titleEn,
    titleDe: input.titleDe,
    ruleFr: input.ruleFr,
    ruleEn: input.ruleEn,
    ruleDe: input.ruleDe,
    examples: [
      {
        de: input.exampleDe,
        en: input.exampleEn,
        fr: input.exampleFr,
      },
    ],
    otherTitlesDe: input.otherTitlesDe,
  });
}

/** Minimal fallback when a topic has no example sentence. */
export function generateMinimalExercises(input: {
  titleFr: string;
  titleEn: string | null;
  titleDe: string;
  ruleFr: string;
  ruleEn: string | null;
  ruleDe: string;
  otherTitlesDe?: string[];
}): GeneratedExercise[] {
  const {
    titleFr,
    titleEn,
    titleDe,
    ruleFr,
    ruleEn,
    ruleDe,
    otherTitlesDe = [],
  } = input;
  const titleEnResolved = titleEn?.trim() || titleFr;
  const tips = tipBundle(ruleFr, ruleEn?.trim() || ruleFr, ruleDe);
  const counts = practicePoolCounts();
  const out: GeneratedExercise[] = [];

  const difficulties = ['easy', 'medium', 'hard'] as const;
  for (const difficulty of difficulties) {
    const count = counts[difficulty];
    for (let i = 0; i < count; i += 1) {
      out.push({
        kind: 'mcq',
        difficulty,
        sort_order: i,
        prompt_de: `Welches Thema trainieren wir? (${difficulty}, ${i + 1}/${count})`,
        prompt_fr: `Quel thème travaillons-nous ? (${difficulty}, ${i + 1}/${count})`,
        prompt_en: `Which topic are we training? (${difficulty}, ${i + 1}/${count})`,
        options_json: scrambleOptions(
          titleDe,
          takeDistractors(
            otherTitlesDe,
            GENERIC_TOPIC_DISTRACTORS_DE,
            titleDe,
            3,
            i,
          ),
          i,
        ),
        answer: titleDe,
        explanation_fr: `${tips.explanation_fr}\n\nThème : ${titleFr}.`,
        explanation_en: `${tips.explanation_en}\n\nTopic: ${titleEnResolved}.`,
        explanation_de: `${tips.explanation_de}\n\nThema: ${titleDe}.`,
      });
    }
  }
  return out;
}
