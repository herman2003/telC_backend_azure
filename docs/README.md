# Documentation

Start here. Every permanent document is reachable from this page — if it is not
listed, it is not authoritative.

Writing or moving a document? Read `../.claude/rules/documentation.md` first.

- **[glossary.md](glossary.md)** — the domain words. Read before naming anything.
- **[decisions.md](decisions.md)** — choices that look like bugs and are not.
- **[backlog.md](backlog.md)** — open work, verified against the code.

---

## architecture/ — how the system fits together

System-wide design, boundaries and data flow. Not one feature's rules.

| | |
|---|---|
| [b2b2c.md](architecture/b2b2c.md) | centres, students, seats — who pays and who learns |
| [multi-level.md](architecture/multi-level.md) | A1/A2/B1/B2: storage, per-feature impact, how a level is added |
| [modelltest-content.md](architecture/modelltest-content.md) | how exam content is stored and served |
| [entitlements-interface.md](architecture/entitlements-interface.md) | the entitlement shape add-ons are built on |
| [sprechen-room.md](architecture/sprechen-room.md) | the live speaking room |

## adr/ — decisions and why

One per decision with long-term consequences. Never renumbered, never
rewritten — superseded instead.

| | |
|---|---|
| [0001](adr/0001-answer-key-with-exercise.md) | the answer key ships with the exercise |
| [0002](adr/0002-the-centre-pays-the-code-holds.md) | the centre pays, the code holds the entitlement |
| [0003](adr/0003-prices-carry-vat-and-a-period-is-a-month.md) | prices carry VAT, a period is a calendar month |
| [0004](adr/0004-independent-user-subscription-b19-deferred.md) | independent user subscriptions deferred |
| [0005](adr/0005-ai-speaking-assign-from-stock.md) | AI Speaking credits assigned from stock |
| [0006](adr/0006-ai-schreiben-assign-from-stock.md) | AI Schreiben credits assigned from stock (200 FCFA HT) |

## domains/ — what the product does

Business rules and approved behaviour, per domain. Not plans.

**Money and access** — [entitlements](domains/entitlements.md) ·
[billing-period](domains/billing-period.md) ·
[payment-mints-codes](domains/payment-mints-codes.md) ·
[ai-speaking-credits](domains/ai-speaking-credits.md) ·
[unused-credit policy](domains/ai-speaking-credits-unused.md) ·
[ai-schreiben-credits](domains/ai-schreiben-credits.md) ·
[offres-lerniqo](domains/offres-lerniqo.md) (FR, commercial)

**Exam Day** — [exam-simulator](domains/exam-simulator.md) ·
[exam-schreiben-visibility](domains/exam-schreiben-visibility.md) ·
[center-modelltest-preview](domains/center-modelltest-preview.md)

**Content** — [answer-key-with-exercise](domains/answer-key-with-exercise.md) ·
[hoeren-training-exam-alignment](domains/hoeren-training-exam-alignment.md) ·
[vocab-grammar](domains/vocab-grammar.md)

**Speaking** — [sprechen-practice](domains/sprechen-practice.md) ·
[sprechen-lobby](domains/sprechen-lobby.md) ·
[speaking-room-topics](domains/speaking-room-topics.md) ·
[elena-session-rules](domains/elena-session-rules.md)

**Platform** — [center-session-timeouts](domains/center-session-timeouts.md) ·
[push-notifications](domains/push-notifications.md)

## contracts/ — what clients depend on

Interfaces the Flutter app and the centre dashboard build against. The
generated OpenAPI at `/api-docs` is the source of truth for shapes; these cover
what it cannot express — rules, sequences, conventions.

| | |
|---|---|
| [id-conventions.md](contracts/id-conventions.md) | the id formats answers are submitted with |
| [b2-level.md](contracts/b2-level.md) | what B2 changes for the clients |
| [center-dashboard-sync.md](contracts/center-dashboard-sync.md) | dashboard ↔ backend decisions |
| [schreiben-api.md](contracts/schreiben-api.md) | Schreiben |
| [sprechen-api.md](contracts/sprechen-api.md) | Sprechen — **authoritative**; [FR version](contracts/sprechen-api-fr.md) |
| [sprechen-frontend-guide.md](contracts/sprechen-frontend-guide.md) | Sprechen integration walkthrough |
| [sprechen-room-ice-servers.md](contracts/sprechen-room-ice-servers.md) | STUN/TURN |
| [speaking-room-topics.md](contracts/speaking-room-topics.md) | synchronised room topics |
| [activation-codes-suspend-reactivate.md](contracts/activation-codes-suspend-reactivate.md) | code lifecycle |
| [center-student-level-fr.md](contracts/center-student-level-fr.md) | student level (FR checklist) |
| [sprachbausteine-correction-fr.md](contracts/sprachbausteine-correction-fr.md) | correction note (FR) |

## guides/ — how to do a thing

| | |
|---|---|
| [branching.md](guides/branching.md) | branch and release model |
| [adding-a-level.md](guides/adding-a-level.md) | runbook for A1/A2, written from doing B2 |
| [migration-baseline.md](guides/migration-baseline.md) | adopting the migration baseline |
| [turn-server.md](guides/turn-server.md) | setting up TURN |
| [stripe-local.md](guides/stripe-local.md) | Stripe locally |
| [notchpay.md](guides/notchpay.md) | Notch Pay setup |

## operations/ — running it in production

| | |
|---|---|
| [deploy-vps.md](operations/deploy-vps.md) | leaving App Platform for a VPS |
| [billing-smoke.md](operations/billing-smoke.md) | production billing smoke test |
| [qa-billing-edge-cases.md](operations/qa-billing-edge-cases.md) | grace, block, failed webhook, duplicates (FR) |
| [qa-billing-period-and-prorata.md](operations/qa-billing-period-and-prorata.md) | period, renewal, mid-period prorata (FR) |

## Other directories

| | |
|---|---|
| `archive/` | superseded plans and finished build blocks. History, not truth. |
| `ideas/` | proposals not decided on |
| `prompts/` | one-off client build prompts |
| `superpowers/` | **tool-managed** — plans and specs written by the skills workflow. Do not reorganise; `.superpowers/sdd` references these paths. |
| `grammar-image-previews/` | generated image assets |

---

## Adding documentation

1. Search first: `grep -ril "<topic>" docs/`. Update the authoritative document
   if one exists.
2. New permanent document → pick the directory above by what it *is*, not what
   feature it belongs to, name it `kebab-case.md`, and add it to this page.
3. Temporary plans do not belong here. They live in `docs/plans/active/` or
   wherever the skill that created them puts them, and are archived or deleted
   when the work ships.
4. Changing documented behaviour? Update the document in the same commit.
