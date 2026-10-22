# Spec: Multi-Level Modelltest JSON Content Contract

## Status

Approved as the shape for Phase 3 generic-model content (A1/A2) — chosen
over `docs/architecture/multi-level.md` Part 3's `ExamSection.material`
sketch, 2026-10-22. No runtime, database, endpoint, or seed changes are
part of this document itself; the generic schema design still lives in
`docs/architecture/multi-level.md` Part 3 and `docs/plans/active/multi-level-phase-3-generic-model.md`.

**Known corrections not yet folded into the body below** (surfaced by a
review against the real telc A2 PDF; see
`docs/plans/active/multi-level-phase-3-generic-model.md`'s "Resolved —
contract shape" section for the full list, and
`docs/plans/active/a2-modelltest-1-extraction-prompt.md` for them applied):
telc uses fractional (0.5/1.5) points in Schreiben and Sprechen rubrics at
every level; `Schreiben Teil 2` and all `Sprechen` sections must not use
`scoring.mode: "AUTO"`; Hören is one continuous, unpausable recording on
Exam Day, not per-Teil clips; grade bands belong in `format`; a visual-asset
record shape is needed; `modelltest.number` is the paper's own per-level
number, never the global catalogue number.

## Assumptions

1. Existing B1 Modelltests and their current endpoints must continue to work during migration.
2. One public content contract should support A1, A2, B1, and B2; there should be no level-specific endpoint families.
3. B1 and B2 form one structural family. A1 and A2 form a second structural family, but their individual Aufgabenarten still differ.
4. German labels such as `Hören`, `Lesen`, `Schreiben`, `Sprechen`, and `Sprachbausteine` are user-facing. Machine keys remain ASCII-safe uppercase values such as `HOEREN`.
5. The canonical source JSON may contain solutions and transcripts. Candidate-facing exam responses must remove them recursively.
6. Imported content remains immutable by `contentRevision`; correcting content creates a new revision rather than silently changing an active exam.

## Objective

Define a validated canonical JSON format from which Lerniqo can import and serve telc Modelltests for A1, A2, B1, and B2. The contract must:

- preserve the current B1 content model through an adapter;
- let B2 reuse compatible B1 structures while supporting its own Schreiben and Sprechen rules;
- represent A1/A2 Aufgabenarten without forcing them into B1-specific tables;
- carry exam timing, block order, scoring, and pass rules as data;
- provide one source of truth for solutions;
- support training responses with solutions and exam responses without solutions.

## Existing project context

- NestJS/TypeScript backend in `src/`.
- Prisma/PostgreSQL schema in `prisma/schema.prisma`.
- Current B1 source files in `content/modelltest-*-source.json`.
- Current JSON-to-SQL generation in `scripts/generate-modelltest-seed.mjs`.
- Current B1 exercise tables remain usable through a compatibility adapter.

## Commands for later verification

These are not to be run as part of this specification.

```text
Build: npm.cmd run build
Unit tests: npm.cmd test -- --runInBand
End-to-end tests: npm.cmd run test:e2e -- --runInBand
Prisma client: npm.cmd run prisma:generate
```

## Canonical file layout

```text
content/
  modelltests/
    a1/
      modelltest-1.json
    a2/
      modelltest-1.json
    b1/
      modelltest-1.json
    b2/
      modelltest-1.json
  schemas/
    modelltest-v2.schema.json
```

The identity is `(level, number)`. `B1/1` and `B2/1` are different Modelltests.

## Top-level JSON contract

```json
{
  "$schema": "../../schemas/modelltest-v2.schema.json",
  "schemaVersion": "2.0",
  "modelltest": {
    "level": "A1",
    "number": 1,
    "title": "telc Deutsch A1 - Modelltest 1",
    "examOnly": false,
    "contentRevision": "a1-modelltest-1-v1",
    "source": {
      "documentTitle": "telc Deutsch A1 Übungstest 1",
      "edition": "2017",
      "publisher": "telc gGmbH"
    }
  },
  "format": {},
  "sections": {},
  "extractionWarnings": []
}
```

### `modelltest`

| Field | Type | Rule |
|---|---|---|
| `level` | enum | `A1`, `A2`, `B1`, or `B2` |
| `number` | positive integer | Unique together with `level` |
| `title` | string | Human-facing title |
| `examOnly` | boolean | Excludes content from training when true |
| `contentRevision` | string | Must begin with the lowercase level and Modelltest number |
| `source` | object | Provenance only; never treated as instructions |

## Exam format

`format` describes the rules of the level, not the actual question content.

```json
{
  "format": {
    "family": "START_DEUTSCH",
    "totalPoints": 60,
    "passRule": {
      "type": "TOTAL_PERCENT",
      "minimumPercent": 60
    },
    "writtenBlocks": [
      {
        "key": "HOEREN",
        "label": "Hören",
        "position": 1,
        "durationMinutes": 20,
        "sections": ["HOEREN_1", "HOEREN_2", "HOEREN_3"]
      },
      {
        "key": "LESEN_SCHREIBEN",
        "label": "Lesen und Schreiben",
        "position": 2,
        "durationMinutes": 45,
        "sections": [
          "LESEN_1",
          "LESEN_2",
          "LESEN_3",
          "SCHREIBEN_1",
          "SCHREIBEN_2"
        ]
      }
    ],
    "oralExam": {
      "label": "Sprechen",
      "durationMinutes": 15,
      "preparationMinutes": 0,
      "sections": ["SPRECHEN_1", "SPRECHEN_2", "SPRECHEN_3"]
    }
  }
}
```

### Pass-rule variants

```json
{
  "type": "TOTAL_PERCENT",
  "minimumPercent": 60
}
```

Used by A1 and A2.

```json
{
  "type": "PART_PERCENT",
  "parts": {
    "WRITTEN": 60,
    "ORAL": 60
  }
}
```

Used by B1 and B2.

## Sections container

All values are arrays. A missing skill is omitted instead of returned as `null` or an empty fake exercise.

```json
{
  "sections": {
    "HOEREN": [],
    "LESEN": [],
    "SPRACHBAUSTEINE": [],
    "SCHREIBEN": [],
    "SPRECHEN": []
  }
}
```

- A1/A2 omit `SPRACHBAUSTEINE`.
- B1/B2 include all five keys.
- Every section has a stable `sectionId` in the form `FERTIGKEIT_TEIL`.

## Common section fields

```json
{
  "sectionId": "HOEREN_1",
  "fertigkeit": "HOEREN",
  "label": "Hören",
  "teil": 1,
  "title": "Hören, Teil 1",
  "aufgabentyp": "EINZELAUSWAHL",
  "contentRevision": "a1-modelltest-1-hoeren-teil-1-v1",
  "instructions": ["Kreuzen Sie an: a, b oder c."],
  "position": 1,
  "scoring": {
    "mode": "AUTO",
    "maxPoints": 6,
    "examPart": "WRITTEN"
  },
  "media": null,
  "content": {}
}
```

### Common enums

`fertigkeit`:

```text
HOEREN | LESEN | SPRACHBAUSTEINE | SCHREIBEN | SPRECHEN
```

`scoring.mode`:

```text
AUTO | MANUAL | MANUAL_WITH_AI_SUGGESTION | NOT_SCORED
```

`examPart`:

```text
WRITTEN | ORAL
```

`aufgabentyp`:

```text
EINZELAUSWAHL
RICHTIG_FALSCH
ZUORDNUNG
KURZANTWORT
FORMULAR_AUSFUELLEN
LUECKENTEXT_EINZELAUSWAHL
LUECKENTEXT_WORTBANK
TEXT_SCHREIBEN
SICH_VORSTELLEN
FRAGEN_UND_ANTWORTEN
BITTEN_UND_REAGIEREN
ALLTAGSGESPRAECH
ETWAS_AUSHANDELN
UEBER_EIN_THEMA_SPRECHEN
UEBER_ERFAHRUNGEN_SPRECHEN
DISKUSSION
GEMEINSAM_PLANEN
```

The `aufgabentyp` is the discriminator. Its `content` must match exactly one of the following shapes.

## Aufgabenart: `EINZELAUSWAHL`

Used for A1/A2 Lesen or Hören questions with one correct option.

```json
{
  "aufgabentyp": "EINZELAUSWAHL",
  "content": {
    "stimulus": {
      "type": "TEXT",
      "body": "Optional shared text or description",
      "imageUrl": null
    },
    "items": [
      {
        "number": 1,
        "prompt": "Was kostet der Pullover?",
        "options": [
          { "key": "a", "text": "30,00 €", "imageUrl": null },
          { "key": "b", "text": "95,00 €", "imageUrl": null },
          { "key": "c", "text": "19,95 €", "imageUrl": null }
        ],
        "solution": { "key": "c" }
      }
    ]
  }
}
```

## Aufgabenart: `RICHTIG_FALSCH`

```json
{
  "aufgabentyp": "RICHTIG_FALSCH",
  "content": {
    "stimulus": {
      "type": "TEXT",
      "body": "Optional shared reading text",
      "imageUrl": null
    },
    "items": [
      {
        "number": 7,
        "statement": "Die Fahrgäste sollen sich im Restaurant treffen.",
        "solution": { "value": false }
      }
    ]
  }
}
```

## Aufgabenart: `ZUORDNUNG`

Supports Überschriften–Texte, Situationen–Anzeigen, and Personen–Orte.

```json
{
  "aufgabentyp": "ZUORDNUNG",
  "content": {
    "leftLabel": "Situation",
    "rightLabel": "Anzeige",
    "allowNoMatch": true,
    "noMatchKey": "X",
    "choices": [
      {
        "key": "a",
        "title": "Anzeige A",
        "body": "Text der Anzeige",
        "imageUrl": null
      }
    ],
    "items": [
      {
        "number": 11,
        "prompt": "Sie möchten in Deutschland studieren.",
        "solution": { "choiceKey": "a" }
      }
    ]
  }
}
```

## Aufgabenart: `KURZANTWORT`

Used for A2 Hören, Teil 1 and other short notes.

```json
{
  "aufgabentyp": "KURZANTWORT",
  "content": {
    "items": [
      {
        "number": 1,
        "prompt": "Rufnummer",
        "placeholder": "________",
        "normalization": {
          "trim": true,
          "ignoreCase": true,
          "ignoreWhitespace": true
        },
        "solution": {
          "acceptedAnswers": ["1688538", "168 85 38"]
        }
      }
    ]
  }
}
```

The importer must reject an empty `acceptedAnswers` list. Normalization is explicit; the scorer must not invent fuzzy matching.

## Aufgabenart: `FORMULAR_AUSFUELLEN`

Used by A1/A2 Schreiben, Teil 1.

```json
{
  "aufgabentyp": "FORMULAR_AUSFUELLEN",
  "content": {
    "scenario": "Ihre Freundin möchte eine Reise buchen.",
    "sourceDocuments": [
      {
        "type": "TEXT",
        "title": "Informationen zur Person",
        "body": "...",
        "imageUrl": null
      }
    ],
    "fields": [
      {
        "number": 1,
        "label": "Anzahl der Personen",
        "inputType": "TEXT",
        "normalization": {
          "trim": true,
          "ignoreCase": true,
          "ignoreWhitespace": false
        },
        "solution": {
          "acceptedAnswers": ["4", "vier"]
        }
      }
    ]
  }
}
```

## Aufgabenarten: Sprachbausteine

### `LUECKENTEXT_EINZELAUSWAHL`

Compatible with the current B1/B2 Sprachbausteine, Teil 1.

```json
{
  "aufgabentyp": "LUECKENTEXT_EINZELAUSWAHL",
  "content": {
    "body": "Liebe Maria, ich _____ dir heute ...",
    "gaps": [
      {
        "number": 21,
        "key": "21",
        "options": [
          { "key": "a", "text": "schreibe" },
          { "key": "b", "text": "schreibt" },
          { "key": "c", "text": "schreiben" }
        ],
        "solution": { "key": "a" }
      }
    ]
  }
}
```

### `LUECKENTEXT_WORTBANK`

Compatible with the current B1/B2 Sprachbausteine, Teil 2.

```json
{
  "aufgabentyp": "LUECKENTEXT_WORTBANK",
  "content": {
    "body": "Sehr geehrte Damen und Herren, _____ ...",
    "wordBank": [
      { "key": "a", "text": "ABER" },
      { "key": "b", "text": "DESHALB" }
    ],
    "gaps": [
      {
        "number": 31,
        "key": "31",
        "solution": { "wordKey": "b" }
      }
    ]
  }
}
```

## Aufgabenart: `TEXT_SCHREIBEN`

Supports A1/A2 short texts and B1/B2 letters or emails.

```json
{
  "aufgabentyp": "TEXT_SCHREIBEN",
  "content": {
    "choiceGroup": null,
    "taskCode": "A",
    "intro": "Sie schreiben an die Touristeninformation.",
    "stimulus": {
      "heading": "Information",
      "body": "Optional source material",
      "features": [],
      "contact": null,
      "imageUrl": null
    },
    "instructions": "Schreiben Sie einen passenden Text.",
    "bulletPoints": [
      "Bitten Sie um Informationen.",
      "Bitten Sie um Hoteladressen."
    ],
    "selectionRule": {
      "type": "ALL"
    },
    "wordLimit": {
      "minimum": 30,
      "recommended": 30,
      "maximum": null
    },
    "closingReminder": "Vergessen Sie Anrede und Gruß nicht."
  }
}
```

B2 uses two separate sections with the same `sectionId` family but different `variant` values:

```json
{
  "sectionId": "SCHREIBEN_1_A",
  "fertigkeit": "SCHREIBEN",
  "teil": 1,
  "variant": "A",
  "aufgabentyp": "TEXT_SCHREIBEN",
  "content": {
    "choiceGroup": "SCHREIBEN_1",
    "taskCode": "A",
    "selectionRule": {
      "type": "CHOOSE_N_OR_OWN",
      "requiredBulletPoints": 3,
      "allowOwnPoint": true
    },
    "wordLimit": {
      "minimum": 150,
      "recommended": null,
      "maximum": null
    }
  }
}
```

Exactly one task from the same `choiceGroup` is submitted.

## Hören media object

All Hören sections require this object:

```json
{
  "media": {
    "audioAssetKey": "a2/modelltest-1/hoeren/teil-1.mp3",
    "audioUrl": null,
    "durationSeconds": 410,
    "playsAllowed": 1,
    "transcript": "Vollständiger Hörtext ..."
  }
}
```

- `audioAssetKey` is stable and environment-independent.
- `audioUrl` is generated at runtime; it should not be the canonical identity.
- `playsAllowed` describes button/play authorization, not how often a passage is repeated inside the recording.
- `transcript` and every `solution` field are removed from candidate exam responses.

## Sprechen task shapes

### `SICH_VORSTELLEN`

```json
{
  "aufgabentyp": "SICH_VORSTELLEN",
  "content": {
    "prompts": ["Name", "Alter", "Land", "Wohnort", "Sprachen", "Beruf", "Hobby"],
    "examinerPrompts": [],
    "participants": 2
  }
}
```

### `FRAGEN_UND_ANTWORTEN` / `BITTEN_UND_REAGIEREN`

```json
{
  "aufgabentyp": "FRAGEN_UND_ANTWORTEN",
  "content": {
    "topic": "Essen und Trinken",
    "cards": [
      { "key": "a", "text": "Frühstück", "imageUrl": null },
      { "key": "b", "text": "Lieblingsessen", "imageUrl": null }
    ],
    "jokerCards": 0
  }
}
```

### `ALLTAGSGESPRAECH` / `ETWAS_AUSHANDELN`

```json
{
  "aufgabentyp": "ETWAS_AUSHANDELN",
  "content": {
    "topic": "Ein neues Hobby",
    "goal": "Finden Sie zwei passende Aktivitäten.",
    "prompts": ["Was?", "Wann?", "Warum?", "Warum nicht?"],
    "participantCards": {
      "A": ["Singen", "Tanzen", "Malen", "Fußball spielen"],
      "B": ["Musik machen", "Fotografieren", "Tischtennis", "Kochkurs"]
    }
  }
}
```

### B1 `UEBER_EIN_THEMA_SPRECHEN`

B1 Sprechen Teil 2. Not B2's Teil 1 (`UEBER_ERFAHRUNGEN_SPRECHEN`, below) —
the two levels put a different task at the same Teil number; see
`docs/architecture/multi-level.md` Part 1 for why that distinction is load-
bearing.

```json
{
  "aufgabentyp": "UEBER_EIN_THEMA_SPRECHEN",
  "content": {
    "topic": "Freizeitaktivitäten",
    "prompts": ["Was machen Sie gern in Ihrer Freizeit?", "Warum?"],
    "talkDurationSeconds": 60
  }
}
```

### B2 `UEBER_ERFAHRUNGEN_SPRECHEN`

```json
{
  "aufgabentyp": "UEBER_ERFAHRUNGEN_SPRECHEN",
  "content": {
    "preparationAtHome": true,
    "talkDurationSeconds": 90,
    "topics": [
      {
        "key": "reise",
        "title": "Eine Reise, die Sie unternommen haben",
        "prompts": ["Ziel", "Zeit", "Land und Leute", "Sehenswürdigkeiten"]
      }
    ],
    "followUpQuestionsRequired": true
  }
}
```

### B2 `DISKUSSION`

```json
{
  "aufgabentyp": "DISKUSSION",
  "content": {
    "sourceText": {
      "title": "Getrennte Schulen für Mädchen und Jungen?",
      "body": "..."
    },
    "instructions": [
      "Geben Sie wichtige Aussagen wieder.",
      "Äußern und begründen Sie Ihre Meinung.",
      "Sprechen Sie über mögliche Lösungen."
    ]
  }
}
```

### `GEMEINSAM_PLANEN`

```json
{
  "aufgabentyp": "GEMEINSAM_PLANEN",
  "content": {
    "scenario": "Planen Sie gemeinsam eine Reise.",
    "goal": "Entwickeln Sie einen gemeinsamen Plan.",
    "prompts": ["Ziel", "Termin", "Transport", "Unterkunft", "Programm"]
  }
}
```

## A1 manifest

```json
{
  "modelltest": {
    "level": "A1",
    "number": 1,
    "contentRevision": "a1-modelltest-1-v1"
  },
  "format": {
    "family": "START_DEUTSCH",
    "totalPoints": 60,
    "passRule": { "type": "TOTAL_PERCENT", "minimumPercent": 60 },
    "writtenBlocks": [
      {
        "key": "HOEREN",
        "label": "Hören",
        "position": 1,
        "durationMinutes": 20,
        "sections": ["HOEREN_1", "HOEREN_2", "HOEREN_3"]
      },
      {
        "key": "LESEN_SCHREIBEN",
        "label": "Lesen und Schreiben",
        "position": 2,
        "durationMinutes": 45,
        "sections": ["LESEN_1", "LESEN_2", "LESEN_3", "SCHREIBEN_1", "SCHREIBEN_2"]
      }
    ]
  },
  "sectionRules": {
    "HOEREN_1": { "aufgabentyp": "EINZELAUSWAHL", "itemCount": 6, "maxPoints": 6 },
    "HOEREN_2": { "aufgabentyp": "RICHTIG_FALSCH", "itemCount": 4, "maxPoints": 4 },
    "HOEREN_3": { "aufgabentyp": "EINZELAUSWAHL", "itemCount": 5, "maxPoints": 5 },
    "LESEN_1": { "aufgabentyp": "RICHTIG_FALSCH", "itemCount": 5, "maxPoints": 5 },
    "LESEN_2": { "aufgabentyp": "EINZELAUSWAHL", "itemCount": 5, "maxPoints": 5 },
    "LESEN_3": { "aufgabentyp": "RICHTIG_FALSCH", "itemCount": 5, "maxPoints": 5 },
    "SCHREIBEN_1": { "aufgabentyp": "FORMULAR_AUSFUELLEN", "itemCount": 5, "maxPoints": 5 },
    "SCHREIBEN_2": { "aufgabentyp": "TEXT_SCHREIBEN", "maxPoints": 10 },
    "SPRECHEN_1": { "aufgabentyp": "SICH_VORSTELLEN", "maxPoints": 3 },
    "SPRECHEN_2": { "aufgabentyp": "FRAGEN_UND_ANTWORTEN", "maxPoints": 6 },
    "SPRECHEN_3": { "aufgabentyp": "BITTEN_UND_REAGIEREN", "maxPoints": 6 }
  }
}
```

## A2 manifest

```json
{
  "modelltest": {
    "level": "A2",
    "number": 1,
    "contentRevision": "a2-modelltest-1-v1"
  },
  "format": {
    "family": "START_DEUTSCH",
    "totalPoints": 60,
    "passRule": { "type": "TOTAL_PERCENT", "minimumPercent": 60 },
    "writtenBlocks": [
      {
        "key": "HOEREN",
        "label": "Hören",
        "position": 1,
        "durationMinutes": 20,
        "sections": ["HOEREN_1", "HOEREN_2", "HOEREN_3"]
      },
      {
        "key": "LESEN_SCHREIBEN",
        "label": "Lesen und Schreiben",
        "position": 2,
        "durationMinutes": 50,
        "sections": ["LESEN_1", "LESEN_2", "LESEN_3", "SCHREIBEN_1", "SCHREIBEN_2"]
      }
    ]
  },
  "sectionRules": {
    "HOEREN_1": { "aufgabentyp": "KURZANTWORT", "itemCount": 5, "maxPoints": 5 },
    "HOEREN_2": { "aufgabentyp": "EINZELAUSWAHL", "itemCount": 5, "maxPoints": 5 },
    "HOEREN_3": { "aufgabentyp": "ZUORDNUNG", "itemCount": 5, "maxPoints": 5 },
    "LESEN_1": { "aufgabentyp": "EINZELAUSWAHL", "itemCount": 5, "maxPoints": 5 },
    "LESEN_2": { "aufgabentyp": "RICHTIG_FALSCH", "itemCount": 5, "maxPoints": 5 },
    "LESEN_3": { "aufgabentyp": "ZUORDNUNG", "itemCount": 5, "maxPoints": 5 },
    "SCHREIBEN_1": { "aufgabentyp": "FORMULAR_AUSFUELLEN", "itemCount": 5, "maxPoints": 5 },
    "SCHREIBEN_2": { "aufgabentyp": "TEXT_SCHREIBEN", "maxPoints": 10 },
    "SPRECHEN_1": { "aufgabentyp": "SICH_VORSTELLEN", "maxPoints": 3 },
    "SPRECHEN_2": { "aufgabentyp": "ALLTAGSGESPRAECH", "maxPoints": 6 },
    "SPRECHEN_3": { "aufgabentyp": "ETWAS_AUSHANDELN", "maxPoints": 6 }
  }
}
```

## B2 manifest

```json
{
  "modelltest": {
    "level": "B2",
    "number": 1,
    "contentRevision": "b2-modelltest-1-v1"
  },
  "format": {
    "family": "ZERTIFIKAT_DEUTSCH",
    "totalPoints": 300,
    "passRule": {
      "type": "PART_PERCENT",
      "parts": { "WRITTEN": 60, "ORAL": 60 }
    },
    "writtenBlocks": [
      {
        "key": "LESEN_SPRACHBAUSTEINE",
        "label": "Leseverstehen und Sprachbausteine",
        "position": 1,
        "durationMinutes": 90,
        "sections": ["LESEN_1", "LESEN_2", "LESEN_3", "SPRACHBAUSTEINE_1", "SPRACHBAUSTEINE_2"]
      },
      {
        "key": "HOEREN",
        "label": "Hörverstehen",
        "position": 2,
        "durationMinutes": 20,
        "sections": ["HOEREN_1", "HOEREN_2", "HOEREN_3"]
      },
      {
        "key": "SCHREIBEN",
        "label": "Schriftlicher Ausdruck",
        "position": 3,
        "durationMinutes": 30,
        "sections": ["SCHREIBEN_1_A", "SCHREIBEN_1_B"]
      }
    ],
    "oralExam": {
      "label": "Mündlicher Ausdruck",
      "durationMinutes": 15,
      "durationMinutesThreeParticipants": 25,
      "preparationMinutes": 20,
      "sections": ["SPRECHEN_1", "SPRECHEN_2", "SPRECHEN_3"]
    }
  },
  "sectionRules": {
    "LESEN_1": { "aufgabentyp": "ZUORDNUNG", "itemCount": 5, "maxPoints": 25 },
    "LESEN_2": { "aufgabentyp": "EINZELAUSWAHL", "itemCount": 5, "maxPoints": 25 },
    "LESEN_3": { "aufgabentyp": "ZUORDNUNG", "itemCount": 10, "maxPoints": 25 },
    "SPRACHBAUSTEINE_1": { "aufgabentyp": "LUECKENTEXT_EINZELAUSWAHL", "itemCount": 10, "maxPoints": 15 },
    "SPRACHBAUSTEINE_2": { "aufgabentyp": "LUECKENTEXT_WORTBANK", "itemCount": 10, "maxPoints": 15 },
    "HOEREN_1": { "aufgabentyp": "RICHTIG_FALSCH", "itemCount": 5, "maxPoints": 25 },
    "HOEREN_2": { "aufgabentyp": "RICHTIG_FALSCH", "itemCount": 10, "maxPoints": 25 },
    "HOEREN_3": { "aufgabentyp": "RICHTIG_FALSCH", "itemCount": 5, "maxPoints": 25 },
    "SCHREIBEN_1_A": { "aufgabentyp": "TEXT_SCHREIBEN", "maxPoints": 45 },
    "SCHREIBEN_1_B": { "aufgabentyp": "TEXT_SCHREIBEN", "maxPoints": 45 },
    "SPRECHEN_1": { "aufgabentyp": "UEBER_ERFAHRUNGEN_SPRECHEN", "maxPoints": 25 },
    "SPRECHEN_2": { "aufgabentyp": "DISKUSSION", "maxPoints": 25 },
    "SPRECHEN_3": { "aufgabentyp": "GEMEINSAM_PLANEN", "maxPoints": 25 }
  }
}
```

The ungraded B2 introduction `Einander kennenlernen` may be represented as an additional `SPRECHEN_INTRO` section with `scoring.mode: NOT_SCORED`; it must not be confused with scored `SPRECHEN_1`.

## Candidate-facing API projection

The canonical source is not returned directly. The API must recursively remove:

```text
solution
acceptedAnswers
transcript
answerKey
isCorrect
correctAnswer
correctOptionId
correctTitleId
correctWordId
```

Example public section:

```json
{
  "sectionId": "HOEREN_1",
  "fertigkeit": "HOEREN",
  "label": "Hören",
  "teil": 1,
  "aufgabentyp": "EINZELAUSWAHL",
  "instructions": ["Kreuzen Sie an: a, b oder c."],
  "media": {
    "audioId": "c0a80121-0000-4000-8000-000000000001",
    "playsAllowed": 1,
    "durationSeconds": 410
  },
  "content": {
    "items": [
      {
        "number": 1,
        "prompt": "Was kostet der Pullover?",
        "options": [
          { "key": "a", "text": "30,00 €" },
          { "key": "b", "text": "95,00 €" },
          { "key": "c", "text": "19,95 €" }
        ]
      }
    ]
  }
}
```

## Compatibility with current B1 backend

The first implementation should be additive:

1. Keep the current B1 tables and services.
2. Add a B1 adapter that converts current DTOs into the canonical `sections` arrays.
3. Let the B2 adapter reuse the B1 Lesen, Sprachbausteine, and Hören storage.
4. Store B2 Schreiben variants as multiple tasks in one choice group.
5. Store A1/A2 sections using the discriminated `aufgabentyp` contract rather than the B1-specific Lesen tables.
6. Move block-to-section mapping out of the hard-coded TypeScript object and into the level format data.

The old endpoints remain until the frontend consumes the canonical content endpoint.

## Validation rules

The JSON validator must reject a file when:

- `(level, number)` is missing or invalid;
- a `sectionId` is duplicated;
- a block references a missing section;
- A1/A2 contain `SPRACHBAUSTEINE`;
- B1/B2 omit required `SPRACHBAUSTEINE` sections;
- `contentRevision` is duplicated globally;
- `aufgabentyp` and `content` shape do not match;
- an automatically scored item has no solution;
- a manually scored task contains an automatic solution;
- option keys are duplicated within an item;
- a solution references an absent option or matching choice;
- section points do not add up to the level total;
- B2 Schreiben variants do not share one `choiceGroup`;
- Hören has no audio asset, duration, or transcript;
- an answer key exists in more than one authored source of truth.

## Code style for the later implementation

Use a discriminated union rather than a single object with many optional fields:

```ts
type AufgabenContent =
  | { aufgabentyp: 'EINZELAUSWAHL'; content: EinzelauswahlContent }
  | { aufgabentyp: 'RICHTIG_FALSCH'; content: RichtigFalschContent }
  | { aufgabentyp: 'ZUORDNUNG'; content: ZuordnungContent }
  | { aufgabentyp: 'KURZANTWORT'; content: KurzantwortContent }
  | { aufgabentyp: 'FORMULAR_AUSFUELLEN'; content: FormularContent }
  | { aufgabentyp: 'TEXT_SCHREIBEN'; content: TextSchreibenContent };
```

## Testing strategy for the later implementation

- JSON-schema tests: one valid fixture per level and one invalid fixture per validation rule.
- Adapter unit tests: current B1 content maps to the canonical contract without changing answers.
- Security tests: no solution or transcript survives the exam projection.
- Import integration tests: B1/1 and B2/1 coexist.
- Exam tests: each level receives the correct blocks, durations, sections, scoring, and pass rule.
- Backward-compatibility tests: current B1 endpoints retain their existing response contracts.

## Boundaries

### Always

- Validate source JSON before creating SQL.
- Resolve Modelltests internally by UUID or `(level, number)`.
- Derive an exam session's level from its selected Modelltest.
- Keep solutions server-side during exams.
- Preserve existing B1 behavior until its clients migrate.

### Ask first

- Removing or changing an existing B1 endpoint.
- Replacing current B1 normalized tables with JSON-only persistence.
- Changing scoring or pass thresholds.
- Allowing fuzzy matching for A1/A2 form and short-answer tasks.

### Never

- Select a Modelltest by number alone after multiple levels exist.
- Trust the client to state the level or scoring rules of an exam session.
- Send solutions or transcripts in candidate exam content.
- Represent absent `Sprachbausteine` with fake empty sections.
- Reuse a B1 content revision identifier for another level.

## Success criteria

- Valid A1, A2, B1, and B2 fixtures pass one schema validator.
- Invalid task/content combinations fail before SQL generation.
- B1 Modelltest 1 and B2 Modelltest 1 can coexist.
- A1/A2 payloads contain no `Sprachbausteine`.
- B2 contains two alternative Schreiben tasks but requires exactly one submission.
- Candidate exam responses contain no solutions or transcripts.
- Existing B1 clients continue working during migration.

## Open questions requiring approval

1. Should A1/A2 `KURZANTWORT` scoring accept only explicit alternatives, as proposed, or use limited normalization rules beyond whitespace and case?
2. Should the new canonical database persistence use normalized task tables or a validated JSON `payload` per section? The recommended first migration is hybrid: keep current B1/B2-compatible tables and use validated payloads for A1/A2 variants.
3. Should the canonical content endpoint use `(level, number)` or the Modelltest UUID? Recommendation: human-facing lookup by `(level, number)`, internal/session references by UUID.
