/**
 * Build long-form grammar lesson JSON (FR + EN + DE) for all exported topics.
 * Content is authored in-repo (no external Gemini API).
 *
 *   npx ts-node -r dotenv/config scripts/build-grammar-lessons.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

type ExportedTopic = {
  slug: string;
  sortOrder: number;
  category: string;
  titleDe: string;
  titleFr: string;
  titleEn: string | null;
  ruleDe: string;
  ruleFr: string;
  ruleEn: string | null;
  notesFr: string | null;
  notesEn: string | null;
  notesDe: string | null;
  cefrLevels: string[];
  examples: Array<{ de: string; fr: string | null; en: string | null }>;
};

type LessonFile = {
  slug: string;
  titleFr: string;
  titleEn: string;
  titleDe: string;
  ruleFr: string;
  ruleEn: string;
  ruleDe: string;
  notesFr: string;
  notesEn: string;
  notesDe: string;
  examples: Array<{ de: string; fr: string; en: string }>;
};

const CATEGORY_INTRO: Record<
  string,
  { fr: string; en: string; de: string }
> = {
  Cases: {
    fr: 'Les cas allemands (Nominativ, Akkusativ, Dativ, Genitiv) marquent le rôle grammatical des groupes nominaux. Bien les maîtriser est indispensable pour les articles, adjectifs et pronoms.',
    en: 'German cases (Nominativ, Akkusativ, Dativ, Genitiv) mark the grammatical role of noun phrases. Mastering them is essential for articles, adjectives and pronouns.',
    de: 'Die deutschen Fälle (Nominativ, Akkusativ, Dativ, Genitiv) kennzeichnen die grammatische Rolle von Nominalgruppen. Sie sind unverzichtbar für Artikel, Adjektive und Pronomen.',
  },
  'Articles & Declension': {
    fr: 'Les articles allemands se déclinent selon le genre, le nombre et le cas. Cette leçon développe les formes et le choix du déterminant.',
    en: 'German articles decline by gender, number and case. This lesson expands forms and determiner choice.',
    de: 'Deutsche Artikel werden nach Genus, Numerus und Kasus dekliniert. Diese Lektion vertieft Formen und Artikelwahl.',
  },
  'Determiners & Quantifiers': {
    fr: 'Déterminants et quantifieurs (dieser, jener, jeder, alle…) se déclinent et précisent la référence du nom.',
    en: 'Determiners and quantifiers (dieser, jener, jeder, alle…) decline and specify noun reference.',
    de: 'Determinative und Quantoren (dieser, jener, jeder, alle…) werden dekliniert und spezifizieren die Nominalreferenz.',
  },
  Pronouns: {
    fr: 'Les pronoms remplacent ou renvoient à un nom. En allemand, ils se déclinent et leur forme dépend du cas.',
    en: 'Pronouns replace or refer to a noun. In German they decline and their form depends on case.',
    de: 'Pronomen ersetzen oder verweisen auf ein Nomen. Im Deutschen werden sie dekliniert; die Form hängt vom Kasus ab.',
  },
  Numbers: {
    fr: 'Nombres, dates et heures suivent des règles de formation et d’emploi spécifiques en allemand.',
    en: 'Numbers, dates and clock times follow specific formation and usage rules in German.',
    de: 'Zahlen, Daten und Uhrzeiten folgen im Deutschen eigenen Bildungs- und Gebrauchsregeln.',
  },
  'Verb Conjugation': {
    fr: 'La conjugaison allemande combine radical, terminaisons personnelles et parfois changement de voyelle.',
    en: 'German conjugation combines stem, personal endings and sometimes vowel change.',
    de: 'Die deutsche Konjugation verbindet Stamm, Personalendungen und manchmal Vokalwechsel.',
  },
  Tenses: {
    fr: 'Les temps verbaux situent l’action dans le temps. En allemand parlé, le Perfekt domine souvent le passé.',
    en: 'Tenses locate actions in time. In spoken German, Perfekt often dominates past reference.',
    de: 'Tempora verorten Handlungen in der Zeit. In der gesprochenen Sprache dominiert oft das Perfekt.',
  },
  'Moods & Conditionals': {
    fr: 'Modes et conditionnels (Konjunktiv I/II, irréel) expriment hypothèse, politesse ou discours rapporté.',
    en: 'Moods and conditionals (Konjunktiv I/II, unreal) express hypothesis, politeness or reported speech.',
    de: 'Modi und Konditionale (Konjunktiv I/II, Irrealis) drücken Hypothese, Höflichkeit oder indirekte Rede aus.',
  },
  Voice: {
    fr: 'La voix (actif / passif) change la perspective : qui fait l’action ou qui la subit.',
    en: 'Voice (active / passive) changes perspective: who does the action or who undergoes it.',
    de: 'Das Genus Verbi (Aktiv / Passiv) ändert die Perspektive: wer handelt oder wer betroffen ist.',
  },
  'Subject-Verb Agreement': {
    fr: 'Le verbe s’accorde avec le sujet en personne et en nombre — y compris avec sujets collectifs ou complexes.',
    en: 'The verb agrees with the subject in person and number — including collective or complex subjects.',
    de: 'Das Verb kongruiert mit dem Subjekt in Person und Numerus — auch bei kollektiven oder komplexen Subjekten.',
  },
  'haben vs. sein': {
    fr: 'Le choix de l’auxiliaire haben ou sein au Perfekt dépend du sens du verbe (état, mouvement, changement).',
    en: 'Choosing haben or sein in Perfekt depends on verb meaning (state, motion, change of state).',
    de: 'Die Wahl von haben oder sein im Perfekt hängt von der Verbbedeutung ab (Zustand, Bewegung, Wechsel).',
  },
  'Adjective Declension': {
    fr: 'Les adjectifs épithètes prennent des terminaisons selon l’article qui précède et le cas du nom.',
    en: 'Attributive adjectives take endings based on the preceding article and the noun’s case.',
    de: 'Attributive Adjektive erhalten Endungen je nach vorangehendem Artikel und Kasus des Nomens.',
  },
  Adverbs: {
    fr: 'Les adverbes précisent temps, lieu, manière ou degré. Beaucoup sont invariables, contrairement aux adjectifs.',
    en: 'Adverbs specify time, place, manner or degree. Many are invariable, unlike adjectives.',
    de: 'Adverbien spezifizieren Zeit, Ort, Art/Weise oder Grad. Viele sind unveränderlich, anders als Adjektive.',
  },
  Prepositions: {
    fr: 'Chaque préposition gouverne un cas (Akkusativ, Dativ, Genitiv) ou alterne (Wechselpräpositionen).',
    en: 'Each preposition governs a case (Akkusativ, Dativ, Genitiv) or alternates (two-way prepositions).',
    de: 'Jede Präposition regiert einen Kasus (Akkusativ, Dativ, Genitiv) oder wechselt (Wechselpräpositionen).',
  },
  'Verbs with Prepositions': {
    fr: 'Certains verbes exigent une préposition fixe (denken an, warten auf…). Apprenez le couple verbe + préposition + cas.',
    en: 'Some verbs require a fixed preposition (denken an, warten auf…). Learn verb + preposition + case together.',
    de: 'Manche Verben verlangen eine feste Präposition (denken an, warten auf…). Lernen Sie Verb + Präposition + Kasus zusammen.',
  },
  'Dativ Verbs & Object Order': {
    fr: 'Des verbes régissent le datif ; l’ordre des objets (datif / accusatif) suit des règles de position.',
    en: 'Some verbs take the dative; object order (dative / accusative) follows position rules.',
    de: 'Manche Verben regieren den Dativ; die Objektstellung (Dativ / Akkusativ) folgt Positionsregeln.',
  },
  Conjunctions: {
    fr: 'Les conjonctions relient propositions : coordinatives (verbe en position 2) ou subordinatives (verbe en fin).',
    en: 'Conjunctions link clauses: coordinating (verb in position 2) or subordinating (verb final).',
    de: 'Konjunktionen verbinden Sätze: nebenordnend (Verb in Position 2) oder unterordnend (Verb am Ende).',
  },
  'Sentence Structure': {
    fr: 'La structure de la phrase allemande repose sur la position du verbe fini (V2, V1, verbe en fin).',
    en: 'German sentence structure hinges on finite-verb position (V2, V1, verb-final).',
    de: 'Die deutsche Satzstruktur hängt an der Position des finiten Verbs (V2, V1, Verbendstellung).',
  },
  'Questions (W-Fragen)': {
    fr: 'Les questions W- et oui/non ont des schémas d’ordre des mots précis (verbe en position 1 ou 2).',
    en: 'Wh- and yes/no questions follow precise word-order patterns (verb in position 1 or 2).',
    de: 'W-Fragen und Ja/Nein-Fragen folgen klaren Wortstellungsregeln (Verb in Position 1 oder 2).',
  },
  Negation: {
    fr: 'La négation utilise nicht (portée variable) et kein (devant un nom sans article défini).',
    en: 'Negation uses nicht (variable scope) and kein (before a noun without a definite article).',
    de: 'Negation nutzt nicht (variable Skopus) und kein (vor Nomen ohne bestimmten Artikel).',
  },
  'Relative Clauses': {
    fr: 'Les relatives allemandes utilisent un pronom relatif décliné ; le verbe fini va en fin de subordonnée.',
    en: 'German relative clauses use a declined relative pronoun; the finite verb goes to the clause end.',
    de: 'Relativsätze verwenden ein dekliniertes Relativpronomen; das finite Verb steht am Satzende.',
  },
  'Infinitive Constructions': {
    fr: 'Les constructions à l’infinitif (zu, um zu, ohne zu…) complètent le verbe principal avec des règles de position.',
    en: 'Infinitive constructions (zu, um zu, ohne zu…) complement the main verb with position rules.',
    de: 'Infinitivkonstruktionen (zu, um zu, ohne zu…) ergänzen das Verb mit festen Positionsregeln.',
  },
  'Compound Words (Komposita)': {
    fr: 'Les composés allemands (Komposita) se lisent de droite à gauche pour le genre et le sens principal.',
    en: 'German compounds (Komposita) are read right-to-left for gender and core meaning.',
    de: 'Komposita liest man von rechts nach links für Genus und Kernbedeutung.',
  },
  'Spelling & Capitalization': {
    fr: 'Orthographe et majuscules : tous les noms prennent une majuscule ; attention aux Umlauts et ß.',
    en: 'Spelling and capitalization: all nouns are capitalized; watch umlauts and ß.',
    de: 'Rechtschreibung und Großschreibung: alle Nomen groß; Achtung bei Umlauten und ß.',
  },
  'lassen + Infinitive': {
    fr: 'lassen + infinitif exprime faire faire, laisser ou une valeur causative / permissive.',
    en: 'lassen + infinitive expresses having something done, allowing, or a causative / permissive meaning.',
    de: 'lassen + Infinitiv bedeutet veranlassen, zulassen oder eine kausative / permissive Lesart.',
  },
  'Reported Speech (Indirekte Rede)': {
    fr: 'Le discours rapporté utilise souvent le Konjunktiv I (ou II en secours) pour marquer la distance.',
    en: 'Reported speech often uses Konjunktiv I (or II as fallback) to mark distance from the claim.',
    de: 'Indirekte Rede nutzt oft Konjunktiv I (oder II als Ersatz) zur Distanzmarkierung.',
  },
  'es Constructions': {
    fr: 'es peut être sujet formel, anticipateur ou élément idiomatique (es gibt, es freut mich…).',
    en: 'es can be a formal subject, anticipatory placeholder, or idiomatic element (es gibt, es freut mich…).',
    de: 'es kann formales Subjekt, Platzhalter oder idiomatisch sein (es gibt, es freut mich…).',
  },
  Nominalization: {
    fr: 'La nominalisation transforme verbes/adjectifs en noms ; le genre et l’article suivent des schémas typiques.',
    en: 'Nominalization turns verbs/adjectives into nouns; gender and article follow typical patterns.',
    de: 'Nominalisierung macht aus Verben/Adjektiven Nomen; Genus und Artikel folgen typischen Mustern.',
  },
  'Gender Rules & Plurals': {
    fr: 'Genre et pluriel : indices de sens et de suffixe aident, mais beaucoup de formes s’apprennent avec l’article.',
    en: 'Gender and plurals: meaning and suffix cues help, but many forms are learned with the article.',
    de: 'Genus und Plural: Bedeutungs- und Endungshinweise helfen, viele Formen lernt man mit dem Artikel.',
  },
  'Modal Particles': {
    fr: 'Les particules modales (doch, mal, eben…) nuancent l’attitude du locuteur sans changer le sens propositionnel.',
    en: 'Modal particles (doch, mal, eben…) nuance speaker attitude without changing propositional meaning.',
    de: 'Modalpartikeln (doch, mal, eben…) nuancieren die Sprecherhaltung ohne die Aussage zu ändern.',
  },
  'Comma & Punctuation Rules': {
    fr: 'La virgule allemande marque surtout les frontières de propositions ; d’autres signes suivent des règles strictes.',
    en: 'The German comma mainly marks clause boundaries; other punctuation follows strict rules.',
    de: 'Das deutsche Komma markiert vor allem Satzgrenzen; andere Satzzeichen folgen festen Regeln.',
  },
};

const DEFAULT_INTRO = {
  fr: 'Cette leçon de grammaire allemande développe une règle essentielle pour le niveau exam (telc / Goethe).',
  en: 'This German grammar lesson expands an essential exam-level rule (telc / Goethe).',
  de: 'Diese Grammatiklektüre vertieft eine prüfungsrelevante Regel (telc / Goethe).',
};

function humanTitle(raw: string, lang: 'fr' | 'en'): string {
  const t = raw.trim();
  if (!t) return lang === 'fr' ? 'Thème de grammaire' : 'Grammar topic';
  // Existing FR/EN titles are often still German; keep readable.
  return t;
}

function expandRule(
  topic: ExportedTopic,
  lang: 'fr' | 'en' | 'de',
): string {
  const intro =
    CATEGORY_INTRO[topic.category]?.[lang] ?? DEFAULT_INTRO[lang];
  const title = topic.titleDe;
  const coreDe = topic.ruleDe.trim();
  const note =
    lang === 'fr'
      ? topic.notesFr
      : lang === 'en'
        ? topic.notesEn ?? topic.notesFr
        : topic.notesDe ?? topic.notesFr;

  if (lang === 'de') {
    return [
      `## ${title}`,
      '',
      intro,
      '',
      '### Kernregel',
      coreDe,
      '',
      '### Vertiefung',
      `Beim Thema „${title}“ (Kategorie: ${topic.category}) sollten Sie die Form regelmäßig im Kontext üben — nicht nur auswendig lernen. Achten Sie auf Kasus, Kongruenz und typische Signalwörter.`,
      '',
      '### Erkennen',
      `Fragen Sie sich: Welche Funktion hat die Form im Satz? Welche Endung oder welches Begleitwort (Artikel, Präposition, Hilfsverb) weist darauf hin? Notieren Sie 2–3 eigene Beispielsätze.`,
      '',
      '### Häufige Fehler',
      `Lernende übertragen oft Muster aus der Muttersprache oder verwechseln ähnliche Formen. Kontrollieren Sie gezielt: Artikel/Endung, Verbposition und die Kasusfrage (Wer? Wen? Wem? Wessen?).`,
      '',
      '### Lernstrategie (5–10 Min.)',
      `1) Regel laut lesen. 2) Beispiele analysieren (markieren Sie die relevante Form). 3) Zwei Sätze selbst bilden. 4) Mit der Notiz unten vergleichen.`,
      note ? `\n### Hinweis\n${note}` : '',
      '',
      '### Kurzfazit',
      `„${title}“ wird sicher, wenn Sie Form + Funktion + Beispielsatz als Dreiklang speichern.`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (lang === 'fr') {
    const looksEnglish =
      !topic.ruleFr?.trim() ||
      /marks the|is used|Nominative|Accusative|Dative|Genitive|\bthe\b|\bof the\b|\bwith\b/i.test(
        topic.ruleFr,
      );
    const coreFr = looksEnglish
      ? `Règle (d’après l’allemand) : ${coreDe}\n\nEn pratique, appliquez cette règle dans des phrases complètes et vérifiez le cas / la forme à chaque déterminant et terminaison.`
      : topic.ruleFr.trim();
    return [
      `## ${humanTitle(topic.titleFr || title, 'fr')}`,
      '',
      intro,
      '',
      '### Règle centrale',
      coreFr,
      '',
      '### Approfondissement',
      `Pour « ${title} » (catégorie : ${topic.category}), entraînez la forme en contexte. Reliez toujours la morphologie (article, terminaison, auxiliaire) à la fonction dans la phrase.`,
      '',
      '### Comment reconnaître',
      `Posez la bonne question de cas ou de structure, repérez les mots-signaux, et vérifiez l’accord. Écrivez 2–3 phrases personnelles après la lecture.`,
      '',
      '### Erreurs fréquentes',
      `Calques de la langue maternelle, confusion entre formes proches, oubli de la position du verbe. Relisez en ciblant : déterminant, cas, et ordre des mots.`,
      '',
      '### Stratégie (5–10 min)',
      `1) Lire la règle. 2) Analyser les exemples (surligner la forme clé). 3) Produire deux phrases. 4) Comparer avec la note.`,
      note ? `\n### Note\n${note}` : '',
      '',
      '### En bref',
      `Mémorisez le trio forme + fonction + exemple pour « ${title} ».`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  // en
  const coreEn =
    topic.ruleEn?.trim() ||
    topic.ruleFr?.trim() ||
    `On “${title}”: ${coreDe}`;
  return [
    `## ${humanTitle(topic.titleEn || title, 'en')}`,
    '',
    intro,
    '',
    '### Core rule',
    coreEn,
    '',
    '### Going deeper',
    `For “${title}” (category: ${topic.category}), practise the form in full sentences. Always link morphology (article, ending, auxiliary) to grammatical function.`,
    '',
    '### How to spot it',
    `Ask the right case/structure question, look for signal words, and check agreement. After reading, write 2–3 personal example sentences.`,
    '',
    '### Common mistakes',
    `L1 transfer, mixing similar forms, and wrong verb position. Re-check determiners, case, and word order on purpose.`,
    '',
    '### Study plan (5–10 min)',
    `1) Read the rule. 2) Analyse the examples (highlight the key form). 3) Produce two sentences. 4) Compare with the note.`,
    note ? `\n### Note\n${note}` : '',
    '',
    '### Takeaway',
    `Store form + function + example together for “${title}”.`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildExtraExamples(topic: ExportedTopic): Array<{
  de: string;
  fr: string;
  en: string;
}> {
  const title = topic.titleDe;
  const bank: Array<{ de: string; fr: string; en: string }> = [
    {
      de: `Hier üben wir „${title}“ im Satz.`,
      fr: `Ici nous pratiquons « ${title} » dans une phrase.`,
      en: `Here we practise “${title}” in a sentence.`,
    },
    {
      de: `Können Sie ein Beispiel zu „${title}“ bilden?`,
      fr: `Pouvez-vous former un exemple sur « ${title} » ?`,
      en: `Can you form an example about “${title}”?`,
    },
    {
      de: `Ohne Kontext bleibt „${title}“ schwer.`,
      fr: `Sans contexte, « ${title} » reste difficile.`,
      en: `Without context, “${title}” stays hard.`,
    },
    {
      de: `Im Kurs wiederholen wir „${title}“ heute.`,
      fr: `En cours, nous révisons « ${title} » aujourd’hui.`,
      en: `In class we review “${title}” today.`,
    },
  ];
  return bank;
}

function translateLikelyEnglishGloss(
  de: string,
  fr: string | null,
  en: string | null,
): { fr: string; en: string } {
  const enOut = (en || fr || '').trim() || `(DE) ${de}`;
  let frOut = (fr || '').trim();
  // Many legacy "fr" strings are actually English — keep a French gloss label when identical to EN.
  if (!frOut || frOut === enOut || /^The |^[A-Z][a-z]+ (is|are|marks|reads)/.test(frOut)) {
    frOut = enOut === frOut || !frOut
      ? `Traduction : ${enOut}`
      : frOut;
    if (frOut.startsWith('Traduction :') && en) {
      // Prefer a short FR placeholder that is clearly French framing
      frOut = `Équivalent : ${en}`;
    }
  }
  return { fr: frOut, en: enOut };
}

function buildExamples(topic: ExportedTopic): Array<{
  de: string;
  fr: string;
  en: string;
}> {
  const out: Array<{ de: string; fr: string; en: string }> = [];
  const seen = new Set<string>();

  for (const ex of topic.examples) {
    const de = ex.de.trim();
    if (!de || seen.has(de)) continue;
    seen.add(de);
    const g = translateLikelyEnglishGloss(de, ex.fr, ex.en);
    out.push({ de, fr: g.fr, en: g.en });
  }

  for (const extra of buildExtraExamples(topic)) {
    if (out.length >= 5) break;
    if (seen.has(extra.de)) continue;
    seen.add(extra.de);
    out.push(extra);
  }

  while (out.length < 3) {
    const filler = {
      de: `Beispiel ${out.length + 1} zu ${topic.titleDe}.`,
      fr: `Exemple ${out.length + 1} pour ${topic.titleDe}.`,
      en: `Example ${out.length + 1} for ${topic.titleDe}.`,
    };
    if (seen.has(filler.de)) break;
    seen.add(filler.de);
    out.push(filler);
  }

  return out.slice(0, 5);
}

function buildNotes(topic: ExportedTopic): {
  notesFr: string;
  notesEn: string;
  notesDe: string;
} {
  const levels = topic.cefrLevels?.length
    ? topic.cefrLevels.join(', ')
    : 'A1–B1';
  return {
    notesFr:
      topic.notesFr?.trim() ||
      `Niveaux indicatifs : ${levels}. Relisez les exemples à voix haute et reformulez avec votre propre vocabulaire.`,
    notesEn:
      topic.notesEn?.trim() ||
      topic.notesFr?.trim() ||
      `Indicative levels: ${levels}. Read the examples aloud and rephrase with your own vocabulary.`,
    notesDe:
      topic.notesDe?.trim() ||
      `Richtniveau: ${levels}. Lesen Sie die Beispiele laut und bilden Sie eigene Varianten.`,
  };
}

function buildLesson(topic: ExportedTopic): LessonFile {
  const notes = buildNotes(topic);
  return {
    slug: topic.slug,
    titleFr: humanTitle(topic.titleFr || topic.titleDe, 'fr'),
    titleEn: humanTitle(topic.titleEn || topic.titleDe, 'en'),
    titleDe: topic.titleDe,
    ruleFr: expandRule(topic, 'fr'),
    ruleEn: expandRule(topic, 'en'),
    ruleDe: expandRule(topic, 'de'),
    notesFr: notes.notesFr,
    notesEn: notes.notesEn,
    notesDe: notes.notesDe,
    examples: buildExamples(topic),
  };
}

function main() {
  // Template filler lessons are NOT acceptable for learners.
  // Real topic-specific JSON under by-slug/ is authored separately.
  // Refuse to overwrite unless explicitly forced.
  if (process.env.GRAMMAR_FORCE_TEMPLATE_BUILD !== '1') {
    console.error(
      'Refused: build-grammar-lessons.ts only produces generic templates.\n' +
        'Author real lessons in content/grammar-lessons/by-slug/ instead.\n' +
        'Set GRAMMAR_FORCE_TEMPLATE_BUILD=1 only if you truly need a scaffold.',
    );
    process.exit(1);
  }

  const indexPath = resolve(
    process.cwd(),
    'content/grammar-lessons/_export/topics-index.json',
  );
  const topics = JSON.parse(readFileSync(indexPath, 'utf8')) as ExportedTopic[];
  const outRoot = resolve(process.cwd(), 'content/grammar-lessons/by-slug');
  mkdirSync(outRoot, { recursive: true });

  let written = 0;
  for (const topic of topics) {
    const lesson = buildLesson(topic);
    const path = join(outRoot, `${topic.slug}.json`);
    writeFileSync(path, JSON.stringify(lesson, null, 2), 'utf8');
    written += 1;
  }

  console.log(`Wrote ${written} lesson files → ${outRoot}`);
}

main();
