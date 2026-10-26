# Answer id conventions

**Status:** approved

The id formats a client submits answers with. Not derivable from Swagger —
these are string-shape conventions inside the payloads, and they differ per
Teil. Verified against live responses on 2026-10-22.

Everything else about these endpoints is generated at `/api-docs`; this file
covers only what that cannot express.

| Context | ID format | Example | Notes |
|---|---|---|---|
| Sprachbausteine Teil 1 gap | numeric string | `"21"` | `"21"` through `"30"` |
| Sprachbausteine Teil 1 option | gapId + letter | `"21a"`, `"21b"`, `"21c"` | three options per gap |
| Sprachbausteine Teil 2 gap | numeric string | `"31"` | `"31"` through `"40"` |
| Sprachbausteine Teil 2 word | `"w"` + letter | `"wa"` through `"wo"` | 15 words in shared pool |
| Lesen Teil 1 text | numeric string | `"1"` through `"5"` | text number |
| Lesen Teil 1 title | UUID | `"ffffffff-0001-..."` | full UUID — use as-is |
| Lesen Teil 2 question | numeric string | `"6"` through `"10"` | question number |
| Lesen Teil 2 option | questionId + letter | `"6a"`, `"6b"`, `"6c"` | three options per question |
| Lesen Teil 3 situation | numeric string | `"11"` through `"20"` | situation number |
| Lesen Teil 3 announcement | letter string | `"a"` through `"l"` | 12 announcements |

**Important note for Lesen Teil 1:** The `titles[].id` field and the values in `correctMatches` are
full UUIDs, not short strings. When a student selects a title, the value to submit is the UUID from
`titles[].id`, not a position number. This is different from all other parts of the exam.

---
