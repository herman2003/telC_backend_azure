/**
 * Zod schemas for the generic-model content contract
 * (docs/ideas/modelltest-content-contract.md), one per `aufgabentyp`.
 *
 * Validated once, at import, by `import-generic-modelltest.mjs` — never on
 * read. A bad fixture fails loudly here, before any SQL is written, per
 * docs/architecture/multi-level.md Part 3's own rule: "never write a WHERE
 * that reaches inside material." The same discipline applies to validation —
 * check it once, trust it forever after.
 *
 * Covers the 11 `aufgabentyp` values A1 and A2 need. The B-family
 * Sprechen/Sprachbausteine shapes are added only when a level that needs
 * the generic model for them actually exists.
 */
import { z } from 'zod';

const normalization = z.object({
  trim: z.boolean(),
  ignoreCase: z.boolean(),
  unicodeNormalization: z.literal('NFC'),
  numericAnswersStrict: z.boolean(),
  fuzzyMatchingAllowed: z.literal(false),
  unrecognizedAnswerPolicy: z.literal('MANUAL_REVIEW'),
});

const asset = z.object({
  type: z.enum(['TEXT', 'IMAGE']).optional(),
  body: z.string().nullable().optional(),
  title: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
});

export const EINZELAUSWAHL = z.object({
  stimulus: asset.optional(),
  items: z
    .array(
      z.object({
        number: z.number().int().positive(),
        prompt: z.string().min(1),
        options: z
          .array(
            z.object({
              key: z.string().min(1),
              text: z.string().min(1),
              imageUrl: z.string().nullable().optional(),
            }),
          )
          .min(2),
        solution: z.object({ key: z.string().min(1) }),
      }),
    )
    .min(1),
});

/**
 * `texts` is for a Teil whose items read different texts: A1 Lesen 1 has two
 * letters (items 1–2 and 3–5), Lesen 3 one sign per item. Each text names
 * the items it belongs to.
 */
export const RICHTIG_FALSCH = z
  .object({
    stimulus: asset.optional(),
    texts: z
      .array(
        z.object({
          forItems: z.array(z.number().int().positive()).min(1),
          title: z.string().optional(),
          body: z.string().min(1),
        }),
      )
      .optional(),
    items: z
      .array(
        z.object({
          number: z.number().int().positive(),
          statement: z.string().min(1),
          solution: z.object({ value: z.boolean() }),
        }),
      )
      .min(1),
  })
  .refine(
    (content) => {
      const numbers = new Set(content.items.map((item) => item.number));
      return (content.texts ?? []).every((text) =>
        text.forItems.every((n) => numbers.has(n)),
      );
    },
    { message: 'every text must point at items that exist' },
  );

export const ZUORDNUNG = z.object({
  leftLabel: z.string().min(1),
  rightLabel: z.string().min(1),
  allowNoMatch: z.boolean(),
  noMatchKey: z.string().optional(),
  choices: z
    .array(
      z.object({
        key: z.string().min(1),
        title: z.string().optional(),
        body: z.string().optional(),
        imageUrl: z.string().nullable().optional(),
      }),
    )
    .min(1),
  items: z
    .array(
      z.object({
        number: z.number().int().positive(),
        prompt: z.string().min(1),
        solution: z.object({
          choiceKey: z.string().min(1).nullable(),
        }),
      }),
    )
    .min(1),
});

export const KURZANTWORT = z.object({
  items: z
    .array(
      z.object({
        number: z.number().int().positive(),
        prompt: z.string().min(1),
        placeholder: z.string().optional(),
        normalization,
        solution: z.object({
          acceptedAnswers: z.array(z.string().min(1)).min(1),
        }),
      }),
    )
    .min(1),
});

export const FORMULAR_AUSFUELLEN = z.object({
  scenario: z.string().optional(),
  sourceDocuments: z.array(asset).default([]),
  fields: z
    .array(
      z
        .object({
          number: z.number().int().positive(),
          label: z.string().min(1),
          inputType: z.enum(['TEXT', 'DATE', 'CHOICE']),
          /** What the candidate picks from; required for, and only for, CHOICE. */
          choices: z.array(z.string().min(1)).min(2).optional(),
          normalization,
          solution: z.object({
            acceptedAnswers: z.array(z.string().min(1)).min(1),
          }),
        })
        .refine(
          (field) =>
            field.inputType === 'CHOICE'
              ? field.choices !== undefined &&
                field.solution.acceptedAnswers.every((answer) =>
                  field.choices.includes(answer),
                )
              : field.choices === undefined,
          {
            message:
              'a CHOICE field needs choices that contain its answer; other fields have none',
          },
        ),
    )
    .min(1),
});

export const TEXT_SCHREIBEN = z.object({
  choiceGroup: z.string().nullable().optional(),
  taskCode: z.string().optional(),
  intro: z.string().optional(),
  stimulus: asset.optional(),
  instructions: z.string().min(1),
  bulletPoints: z.array(z.string().min(1)).min(1),
  selectionRule: z.object({
    type: z.enum(['ALL', 'CHOOSE_N_OR_OWN']),
    requiredBulletPoints: z.number().int().positive().optional(),
    allowOwnPoint: z.boolean().optional(),
  }),
  wordLimit: z.object({
    minimum: z.number().int().positive().nullable(),
    recommended: z.number().int().positive().nullable(),
    maximum: z.number().int().positive().nullable(),
  }),
  closingReminder: z.string().optional(),
  /// The official rubric, never a bare maxPoints. See
  /// docs/plans/active/a2-modelltest-1-extraction-prompt.md.
  rubric: z.object({
    contentPoints: z.object({
      selectRequired: z.number().int().positive(),
      pointsPerPoint: z.array(z.number()).min(1),
    }),
    communicativeDesign: z.object({ points: z.array(z.number()).min(1) }),
  }),
});

const scale = z.array(z.number()).min(1);

/** A2 marks introduction and follow-up questions; A1 introduction, spelling
 *  and numbers (Bewertungsbogen M10, V/B/Z). */
export const SICH_VORSTELLEN = z.object({
  prompts: z.array(z.string().min(1)).min(1),
  examinerPrompts: z.array(z.string()).default([]),
  participants: z.number().int().positive(),
  rubric: z.union([
    z.object({ vorstellen: scale, zusatzfragen: scale }).strict(),
    z.object({ vorstellen: scale, buchstabieren: scale, zahlen: scale }).strict(),
  ]),
});

const card = z.object({
  key: z.string().min(1),
  /** The word on the card, or — for a picture card — the object it shows. */
  text: z.string().min(1),
  imageUrl: z.string().nullable().optional(),
});

/** One round per topic: A1 Teil 2 plays "Essen und Trinken", then "Einkaufen". */
const rounds = z
  .array(z.object({ topic: z.string().min(1).optional(), cards: z.array(card).min(1) }))
  .min(1);

export const FRAGEN_UND_ANTWORTEN = z.object({
  rounds,
  rubric: z.object({ frage: scale, antwort: scale }),
});

export const BITTEN_UND_REAGIEREN = z.object({
  rounds,
  rubric: z.object({ bitte: scale, reaktion: scale }),
});

export const ALLTAGSGESPRAECH = z.object({
  topic: z.string().min(1),
  cards: z
    .array(
      z.object({
        key: z.string().min(1),
        text: z.string().min(1),
        imageUrl: z.string().nullable().optional(),
      }),
    )
    .min(1),
  jokerCards: z.number().int().nonnegative(),
  rubric: z.object({ perInteractionAct: z.array(z.number()).min(1) }),
});

export const ETWAS_AUSHANDELN = z.object({
  topic: z.string().min(1),
  goal: z.string().min(1),
  prompts: z.array(z.string().min(1)).min(1),
  participantCards: z.object({
    A: z.array(z.string().min(1)).min(1),
    B: z.array(z.string().min(1)).min(1),
  }),
  rubric: z.object({
    erfuellungDerAufgabenstellung: z.array(z.number()).min(1),
    sprachlicheRealisierung: z.array(z.number()).min(1),
  }),
});

export const AUFGABENTYP_SCHEMAS = {
  EINZELAUSWAHL,
  RICHTIG_FALSCH,
  ZUORDNUNG,
  KURZANTWORT,
  FORMULAR_AUSFUELLEN,
  TEXT_SCHREIBEN,
  SICH_VORSTELLEN,
  FRAGEN_UND_ANTWORTEN,
  BITTEN_UND_REAGIEREN,
  ALLTAGSGESPRAECH,
  ETWAS_AUSHANDELN,
};

/** The common envelope every section carries, regardless of `aufgabentyp`. */
export const SECTION_ENVELOPE = z.object({
  sectionId: z.string().min(1),
  fertigkeit: z.enum(['HOEREN', 'LESEN', 'SPRACHBAUSTEINE', 'SCHREIBEN', 'SPRECHEN']),
  label: z.string().min(1),
  teil: z.number().int().nonnegative(),
  title: z.string().min(1),
  aufgabentyp: z.enum(
    /** @type {[string, ...string[]]} */ (Object.keys(AUFGABENTYP_SCHEMAS)),
  ),
  contentRevision: z.string().min(1),
  instructions: z.array(z.string()).default([]),
  position: z.number().int().positive(),
  scoring: z.object({
    mode: z.enum(['AUTO', 'MANUAL', 'MANUAL_WITH_AI_SUGGESTION', 'NOT_SCORED']),
    maxPoints: z.number().int().nonnegative(),
    examPart: z.enum(['WRITTEN', 'ORAL']),
  }),
  media: z
    .object({ transcript: z.string().optional() })
    .nullable()
    .optional(),
  content: z.unknown(),
});

/**
 * Validates one section's envelope and its `content` against the matching
 * `aufgabentyp` schema. Throws with the section id in the message — the
 * importer never guesses which section a validation failure belongs to.
 */
export function validateSection(raw) {
  const envelope = SECTION_ENVELOPE.parse(raw);
  const schema = AUFGABENTYP_SCHEMAS[envelope.aufgabentyp];
  if (!schema) {
    throw new Error(
      `${envelope.sectionId}: no Zod schema for aufgabentyp ${envelope.aufgabentyp} yet`,
    );
  }
  try {
    const content = schema.parse(envelope.content);
    return { ...envelope, content };
  } catch (error) {
    throw new Error(
      `${envelope.sectionId} (${envelope.aufgabentyp}) content is invalid: ${error.message}`,
    );
  }
}

/** One Teil's official recording. URL and duration are null until uploaded. */
export const HOEREN_RECORDING = z.object({
  teil: z.number().int().positive(),
  audioAssetKey: z.string().min(1),
  audioUrl: z.string().nullable(),
  durationSeconds: z.number().positive().nullable(),
});

/**
 * `format.hoerenDelivery` — Exam Day's Hören contract for the generic model:
 * one recording per Teil, each played once. telc's repeats ("Sie hören jeden
 * Text zweimal") are inside the file, so a second play would be a third and
 * fourth hearing. Optional: a source with no Hören simply omits it.
 */
export const HOEREN_DELIVERY = z.object({
  deliveryMode: z.literal('PER_TEIL_RECORDINGS'),
  playsAllowed: z.literal(1),
  pauseAllowed: z.literal(false),
  seekAllowed: z.literal(false),
  restartAllowed: z.literal(false).optional(),
  recordings: z
    .array(HOEREN_RECORDING)
    .min(1)
    .refine(
      (recordings) =>
        new Set(recordings.map((r) => r.teil)).size === recordings.length,
      { message: 'each Teil has at most one recording' },
    ),
});

export const GRADE_BAND = z.object({
  label: z.enum(['SEHR_GUT', 'GUT', 'BEFRIEDIGEND', 'AUSREICHEND', 'TEILGENOMMEN']),
  minimum: z.number().nonnegative(),
  maximum: z.number().nonnegative(),
});

export const FORMAT = z.object({
  hoerenDelivery: HOEREN_DELIVERY.optional(),
  gradeBands: z.array(GRADE_BAND).optional(),
});

/** One entry in the top-level `assets[]` manifest — bookkeeping for whoever
 *  uploads the real image, not the image itself. */
export const ASSET_MANIFEST_ENTRY = z.object({
  assetKey: z.string().min(1),
  usedBy: z.array(z.string().min(1)).min(1),
  sourcePages: z.array(z.number().int().positive()).default([]),
  requiredForTask: z.boolean(),
  containsSolution: z.boolean(),
  targetFileName: z.string().optional(),
  imageUrl: z.string().nullable(),
  altText: z.string().optional(),
  extractionNotes: z.string().optional(),
});

/**
 * Validates `source.format` and `source.assets`, both optional. Returns
 * `{ format, assets }` ready to store as-is on `modelltests.format`/
 * `.assets` — `null` for whichever the source didn't carry, never `{}` or
 * `[]`, so a reader can tell "none extracted" from "extracted as empty."
 */
export function validateFormatAndAssets(source) {
  const format = source.format ? FORMAT.parse(source.format) : null;
  const assets = source.assets
    ? z.array(ASSET_MANIFEST_ENTRY).parse(source.assets)
    : null;
  return {
    format: format && Object.keys(format).length > 0 ? format : null,
    assets: assets && assets.length > 0 ? assets : null,
  };
}
