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
 * Covers the 9 `aufgabentyp` values A2 Modelltest 1 needs. The other 8
 * (B-family Sprechen/Sprachbausteine shapes) are added only when a level
 * that needs the generic model for them actually exists.
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

export const RICHTIG_FALSCH = z.object({
  stimulus: asset.optional(),
  items: z
    .array(
      z.object({
        number: z.number().int().positive(),
        statement: z.string().min(1),
        solution: z.object({ value: z.boolean() }),
      }),
    )
    .min(1),
});

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
      z.object({
        number: z.number().int().positive(),
        label: z.string().min(1),
        inputType: z.enum(['TEXT', 'DATE', 'CHOICE']),
        normalization,
        solution: z.object({
          acceptedAnswers: z.array(z.string().min(1)).min(1),
        }),
      }),
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

export const SICH_VORSTELLEN = z.object({
  prompts: z.array(z.string().min(1)).min(1),
  examinerPrompts: z.array(z.string()).default([]),
  participants: z.number().int().positive(),
  rubric: z.object({
    vorstellen: z.array(z.number()).min(1),
    zusatzfragen: z.array(z.number()).min(1),
  }),
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
