# Frontend: activation code suspend / reactivate / reset

**Source of truth:** `docs/superpowers/specs/2026-10-05-activation-suspend-reactivate-design.md`

## Statuses

| Status | Meaning |
|--------|---------|
| `activated` | Ready to hand out |
| `connected` | Student learning |
| `suspended` | Paused — same student, data kept, seat still paid/held |
| `deactivated` | Terminal take-back (remove student / payment retire) — no reactivate |

## Endpoints

| Method | Path | Intent |
|--------|------|--------|
| GET | `/api/centers/me/activation-codes` | List (+ `reset` allowance) |
| GET | `/api/centers/me/seats` | bought / used |
| PATCH | `/api/centers/me/activation-codes/:id` | Set/clear `level` (CEFR) on **activated** only |
| POST | `/api/centers/me/activation-codes/:id/deactivate` | Pause connected → suspended |
| POST | `/api/centers/me/activation-codes/:id/reactivate` | Resume suspended → connected |
| POST | `/api/centers/me/activation-codes/:id/reset` | New code; **wipe data now** (keeps `level`) |

`ActivationCodeDto.level`: `A1` \| `A2` \| `B1` \| `B2` \| `null`. Body for PATCH: `{ "level": "A2" }` or `{ "level": null }`. On redeem, a non-null code level is copied onto the student.

### Training catalogue (Option A)

After redeem, training lists / access are filtered by `student.level` vs `Modelltest.level` (exact match). Errors: `LEVEL_REQUIRED` (no level on student), `LEVEL_MISMATCH` (wrong MT). Prep Pass unlocks the full pool **of that level only**, for Lesen, Hören
and Sprachbausteine. Schreiben and Sprechen topics are on Start for every
Modelltest and carry no level check yet (Phase 1b) — see
`../domains/offres-lerniqo.md`. Without content for A1/A2/B2 yet, those seats see an empty training catalogue.

There is **no** `activate` / reactivate-of-deactivated route.

## Errors (manager)

`ACCOUNT_NOT_FINALIZED`, `SUBSCRIPTION_INACTIVE`, `CODE_NOT_FOUND`, `INVALID_CODE_TRANSITION`, `CODE_HAS_NO_STUDENT`, `CODE_RESET_LIMIT_REACHED`, `CODE_CHANGED`

## Errors (student)

`CODE_SUSPENDED` (learn + redeem), plus existing redeem errors.
