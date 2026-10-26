# Modelltest source JSON — format rules (Lerniqo)

**Canonical example:** `content/modelltest-3-source.json`  
**Pipeline:**
1. Produce `content/modelltest-{N}-source.json` in this shape
2. `node scripts/normalize-modelltest-source.mjs <raw.json> <out.json>`
3. `node scripts/generate-modelltest2-seed.mjs` (or the N-specific seed generator) → SQL migration

Replace `{N}` with the modelltest number (e.g. `4`).

---

## Top-level shape

```json
{
  "modelltest": { "number": N, "title": "Modelltest N" },
  "sections": { ... },
  "answerKey": { ... },
  "extractionWarnings": []
}
```

| Field | Rule |
|-------|------|
| `modelltest.number` | Positive integer |
| `modelltest.title` | Exactly `"Modelltest {N}"` (normalize script rewrites this) |
| `answerKey.*` | **Must match** the correct answers embedded in `sections` (seed asserts equality) |
| `extractionWarnings` | Optional string array (provenance notes only) |

---

## Counts (hard)

| Section | Counts |
|---------|--------|
| `lesenTeil1.titles` | **10** (`a`–`j`) |
| `lesenTeil1.texts` | **5** (n° 1–5) |
| `lesenTeil2.questions` | **5** (n° 6–10), each **3** options `a/b/c` |
| `lesenTeil3.announcements` | **12** (`a`–`l`) |
| `lesenTeil3.situations` | **10** (n° 11–20) |
| `sprachbausteineTeil1.gaps` | **10** (n° 21–30), each **3** options, **exactly one** `isCorrect: true` |
| `sprachbausteineTeil2.words` | **15** (`a`–`o`) |
| `sprachbausteineTeil2.gaps` | **10** (n° 31–40) |
| `hoeren.teil1.questions` | **5** (n° 41–45) |
| `hoeren.teil2.questions` | **10** (n° 46–55) |
| `hoeren.teil3.questions` | **5** (n° 56–60) |
| `sprechen` | **3** parts: `teil1`, `teil2`, `teil3` |

---

## `contentRevision` naming

```
modelltest-{N}-lesen-teil1-v1
modelltest-{N}-lesen-teil2-v1
modelltest-{N}-lesen-teil3-v1
modelltest-{N}-sprachbausteine-teil1-v1
modelltest-{N}-sprachbausteine-teil2-v1
modelltest-{N}-hoeren-teil1-v1
modelltest-{N}-hoeren-teil2-v1
modelltest-{N}-hoeren-teil3-v1
modelltest-{N}-schreiben-v1
```

(Sprechen revisions are set by the seed generator / DB rows.)

---

## Section schemas

### `sections.lesenTeil1`

```json
{
  "contentRevision": "modelltest-N-lesen-teil1-v1",
  "label": "Leseverstehen Teil 1",
  "instruction": "...",
  "titles": [{ "key": "a", "content": "...", "sortOrder": 0 }],
  "texts": [{
    "textNumber": 1,
    "von": null,
    "an": null,
    "body": "...",
    "sortOrder": 0,
    "correctTitleKey": "i"
  }]
}
```

- `titles[].key`: `a`…`j`
- `texts[].correctTitleKey`: one of those keys
- `sortOrder`: 0-based, sequential

### `sections.lesenTeil2`

```json
{
  "contentRevision": "modelltest-N-lesen-teil2-v1",
  "label": "Leseverstehen Teil 2",
  "instruction": "...",
  "cautionNote": "",
  "topSender": "",
  "topReceiver": "",
  "topBody": "main reading text...",
  "quotedThread": "",
  "questions": [{
    "questionNumber": 6,
    "prompt": "...",
    "sortOrder": 0,
    "options": [
      { "key": "a", "content": "...", "isCorrect": false, "sortOrder": 0 },
      { "key": "b", "content": "...", "isCorrect": true, "sortOrder": 1 },
      { "key": "c", "content": "...", "isCorrect": false, "sortOrder": 2 }
    ]
  }]
}
```

- String fields above: use `""`, never `null` (normalize script coerces)
- Exactly one `isCorrect: true` per question

### `sections.lesenTeil3`

```json
{
  "contentRevision": "modelltest-N-lesen-teil3-v1",
  "label": "Leseverstehen Teil 3",
  "instruction": "...",
  "announcements": [{ "key": "a", "title": "...", "content": "...", "sortOrder": 0 }],
  "situations": [{
    "situationNumber": 11,
    "content": "...",
    "noMatch": false,
    "correctAnnouncementKey": "b",
    "sortOrder": 0
  }]
}
```

- Match: `noMatch: false`, `correctAnnouncementKey`: `a`–`l`
- No match: `noMatch: true`, `correctAnnouncementKey: null` → answerKey `"X"`

### `sections.sprachbausteineTeil1`

```json
{
  "teilNumber": 1,
  "contentRevision": "modelltest-N-sprachbausteine-teil1-v1",
  "label": "Sprachbausteine Teil 1",
  "instruction": "...",
  "body": "text with _____ gaps...",
  "gaps": [{
    "gapKey": "21",
    "gapNumber": 21,
    "sortOrder": 0,
    "options": [
      { "key": "a", "content": "...", "isCorrect": true, "sortOrder": 0 },
      { "key": "b", "content": "...", "isCorrect": false, "sortOrder": 1 },
      { "key": "c", "content": "...", "isCorrect": false, "sortOrder": 2 }
    ]
  }]
}
```

### `sections.sprachbausteineTeil2`

```json
{
  "contentRevision": "modelltest-N-sprachbausteine-teil2-v1",
  "label": "Sprachbausteine Teil 2",
  "instruction": "...",
  "body": "...",
  "words": [{ "letter": "a", "content": "FÜR", "sortOrder": 0 }],
  "gaps": [{
    "gapKey": "31",
    "gapNumber": 31,
    "correctWordKey": "h",
    "sortOrder": 0
  }]
}
```

- `words[].letter`: `a`…`o` (15 total; unused distractors allowed)
- `gaps[].correctWordKey`: letter of the correct word; each used word at most once

### `sections.hoeren`

```json
{
  "teil1": {
    "part": 1,
    "title": "Teil 1",
    "subtitle": "Hörverstehen, Teil 1",
    "instruction": "...",
    "contentRevision": "modelltest-N-hoeren-teil1-v1",
    "transcript": "...",
    "questions": [
      { "questionNumber": 41, "prompt": "...", "correctAnswer": "+", "sortOrder": 0 }
    ],
    "audioUrl": "https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/modelltest-N-hoeren/modelltest-N-hoeren-teil1.mp3",
    "imageUrl": "",
    "durationMinutes": 10
  },
  "teil2": { "part": 2, "...": "same shape, questions 46–55" },
  "teil3": { "part": 3, "...": "same shape, questions 56–60" }
}
```

| Field | Rule |
|-------|------|
| `correctAnswer` | Only `"+"` or `"-"` (string) |
| `audioUrl` | Full R2 public URL; if omitted, normalize injects flat `modelltest-{N}-hoeren-teil{p}.mp3` — **set explicitly** if using a folder like `modelltest-2-hoeren/` |
| `imageUrl` | `""` if none |
| `durationMinutes` | Number, typically `10` |
| `transcript` | Full spoken script (with speaker labels OK in text; not played as labels) |

### `sections.schreiben`

```json
{
  "contentRevision": "modelltest-N-schreiben-v1",
  "title": "Schriftlicher Ausdruck",
  "subtitle": "...",
  "taskType": "brief",
  "intro": "...",
  "stimulus": {
    "heading": "...",
    "subheading": null,
    "body": "...",
    "features": [],
    "contact": { "name": "...", "lines": ["..."] },
    "callToAction": null,
    "imageUrl": null
  },
  "taskInstructions": "...",
  "bulletPoints": ["...", "...", "...", "..."],
  "closingReminder": "..."
}
```

- `taskType`: currently `"brief"`
- Typically **4** `bulletPoints` (telc-style)

### `sections.sprechen`

```json
{
  "teil1": {
    "part": 1,
    "title": "Teil 1 Einander kennenlernen",
    "subtitle": "Teilnehmer/in A und B",
    "topicTitle": "...",
    "topicDescription": "...",
    "topicPoints": ["Name", "..."],
    "additionalExaminerTopics": ["..."],
    "instructions": "..."
  },
  "teil2": {
    "part": 2,
    "title": "Teil 2 Über ein Thema sprechen",
    "subtitle": "Teilnehmer/in A / Teilnehmer/in B",
    "topicTitle": "...",
    "commonInstructions": "...",
    "participants": {
      "A": { "label": "Teilnehmer/in A", "person": "Name, age, job", "text": "„...“" },
      "B": { "label": "Teilnehmer/in B", "person": "...", "text": "„...“" }
    }
  },
  "teil3": {
    "part": 3,
    "title": "Teil 3 Gemeinsam etwas planen",
    "subtitle": "Teilnehmer/in A und B",
    "topicTitle": "...",
    "topicDescription": "...",
    "topicPoints": ["Wann?", "Wo?", "..."],
    "instructions": "..."
  }
}
```

---

## `answerKey` (must mirror sections)

```json
{
  "lesenTeil1": { "1": "i", "2": "d", "3": "b", "4": "f", "5": "h" },
  "lesenTeil2": { "6": "c", "7": "c", "8": "b", "9": "a", "10": "a" },
  "lesenTeil3": { "11": "b", "12": "a", "13": "d", "14": "X", "15": "e", "16": "i", "17": "k", "18": "l", "19": "X", "20": "g" },
  "sprachbausteineTeil1": { "21": "a", "22": "c", "...": "..." },
  "sprachbausteineTeil2": { "31": "h", "32": "i", "...": "..." },
  "hoerenTeil1": { "41": "+", "42": "-", "43": "-", "44": "+", "45": "-" },
  "hoerenTeil2": { "46": "+", "...": "...", "55": "+" },
  "hoerenTeil3": { "56": "+", "57": "-", "58": "+", "59": "-", "60": "+" }
}
```

- Keys are **strings** (`"1"`, `"41"`, …)
- Lesen Teil 3 no-match → `"X"`
- Hören → `"+"` / `"-"` only

---

## Generation checklist

1. Full MT = Lesen 1–3 + Sprachbausteine 1–2 + Hören 1–3 + Schreiben + Sprechen 1–3  
2. Counts match the table above  
3. Every correct answer appears in both the section object **and** `answerKey`  
4. `contentRevision` uses `modelltest-{N}-…-v1`  
5. Hören `audioUrl` set after upload to R2  
6. Run normalize + seed generator; fix until asserts pass  

**Gold file to copy structure from:** `content/modelltest-3-source.json`
