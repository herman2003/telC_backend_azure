# Build blocks 22–27 — the runbook

**Written:** 2026-09-25
**For:** whoever (human or agent) picks up the next block.

One block at a time. Read the block, run the skills in the order listed, stop
at every 🛑 and wait for a human. Do not start a block before the one before it
is merged.

Blocks 16–21 built the exam simulator. These six finish the commercial model in
`docs/OFFRES_LERNIQO.md` (Start, Prep Pass, Exam Day, AI Assisted Learning,
AI Speaking).

---

## Standing rules — apply to every block, never repeated below

| | |
|---|---|
| Branch | from `dev`, named `feat/<block-topic>`. Never from `main` |
| Migrations | never a bare `prisma migrate`. `.env` is production. Export `.env.test` and refuse `ep-wandering-hall` |
| Before merging | all four suites green: unit, e2e, integration, build |
| Plan file | `tasks/phases/<n>-<topic>-intent.md`. It is gitignored — commit with `git add -f` |
| Decisions | business decisions need the user **and Herman**. Technical ones, the user alone |
| Money paths | anything that grants a paid thing gets `/security-and-hardening` before merge |

The spine of every block is **spec → build → review**. Bigger blocks add a
design skill in front and a hardening skill behind. That is the only pattern
here.

---

## Block 22 — Fix Sprechen IA Light

> **Split on 2026-09-25**, after `/deprecation-and-migration`. Two systems were
> hiding behind one name, and only one of them can be fixed without schema.

### What the investigation found

"Sprechen IA Light" is **Elena**, the live Gemini conversation
(`LiveSessionLimitService`, Valkey counters) — not `AiQuotaService`, which
meters transcript evaluation in Postgres. The offer's four rules land on Elena.

Two consequences:

- **No data migration is needed.** The Postgres quota is derived from rows, and
  Elena's counters are TTL buckets. Nothing stored has to be rewritten.
- **A monthly allowance cannot live in Valkey.** Those counters expire by TTL
  and degrade to in-process memory when Valkey is down, so a restart would hand
  out free sessions. Five-a-month belongs in Postgres — in the same table
  block 23 builds, because AI Speaking credits extend exactly this counter.

### Block 22a — the session rules (no schema)

**Intent.** Make a live session behave as Start promises, using only what
already exists.

- session cap **10 minutes → 5** (`GEMINI_LIVE_SESSION_MAX_MINUTES`)
- close after **30 seconds of silence at the start**
- close after **60 seconds of silence mid-session**
- **one active session per student** — today's concurrency pool is global, not
  per student

| | Skill | What it must produce |
|---|---|---|
| 1 | `/spec-driven-development` | The four rules, including what the client is told on each close and how a dropped connection is distinguished from silence |
| 2 | `/agent-skills:build` | The implementation, TDD |
| 3 | `/code-review-and-quality` | Review before merge |

🛑 **Human checkpoints** — confirm the close messages are the ones the app
should show; the four suites before merge.

**Done when** a session dies at 5 minutes, a silent start dies at 30 seconds, a
silent middle dies at 60, and a student cannot hold two at once.

### Block 22b — the monthly allowance (folded into block 23)

**Intent.** 5 sessions per **calendar month, UTC**, per student, counted in
Postgres, extended later by bought credits.

Built as part of block 23, on the entitlement table. Building it in Valkey
first would mean building it twice.

**One design rule, decided now:** every caller asks a single function
`quotaWindowStart(now)` where the window begins. Today it returns the start of
the UTC month and nothing else.

That seam exists so that *if* a grandfathering rule is ever needed after
launch — a student mid-window on switch-over day — it is one line inside one
function instead of a hunt through every caller. **No such constant is written
now:** the product has not launched, production is demo data, and there is no
student whose history could be punished. Dead code with a future date in it
never gets deleted.

## Block 23 — The entitlement foundation, delivering AI Speaking credits

> **Design:** `ENTITLEMENTS_INTERFACE_DESIGN.md` · **Decision:** `adr/0002` ·
> **Spec:** `ENTITLEMENTS_SPEC.md`. All three agreed 2026-09-25.

### Why block 24 is folded in here

An abstraction with no consumer is a guess. Tasks 1–5 are plumbing nobody can
buy; task 6 makes Elena draw on it, and at that point **AI Speaking credits
work end to end** — bought, pooled, capped, spent. The foundation is proven by
a real product instead of by the next block discovering it is the wrong shape.

### The shape

```
a POOL is counted          a CAP is permission        an ASSIGNMENT is timed
(center_id, product)       (code_id, product)         (code_id, product)
 balance: 40                cap: 10, used: 6           expires_at: …
```

The cap sits on the **activation code**, not the student: a code exists before
anybody holds it, so a centre can buy ahead, and a seat that changes hands
carries what was bought for it.

### Settled while speccing

| | |
|---|---|
| `payments.metadata Json?` | the manager's chosen codes and cap have to survive from the purchase to the webhook, and there is no column anywhere for that |
| the Elena conversation is the unit | it becomes a row in `ai_usage`; the monthly allowance is derived from it, so nothing resets on a schedule |
| grading loses its own allowance | a correction after a paid session must not meet a second counter. One with no session behind it counts as a session. The burst limit stays |
| a cap is total, not monthly | a monthly cap needs a reset job, which this codebase does not have, or derived counting, which breaks when a seat changes hands |

### The tasks

| | task | delivers |
|---|---|---|
| 1 | three tables, the enums, `payments.metadata`, the migration | the shape |
| 2 | grant on the verified webhook, into the pool | money lands before anything is handed out |
| 3 | caps: set, remove, list | the manager's screen |
| 4 | `mayUse` / `spend`, and the Start freeze | the interface all three products call |
| 5 | `GET /api/me/entitlements` | what the app renders |
| 6 | **22b** — Elena as a row, 5 a month, credits after | the first real consumer of task 4 |

### Skills, in order

| | Skill | note |
|---|---|---|
| 1 | `/api-and-interface-design` | ✅ done |
| 2 | `/documentation-and-adrs` | ✅ done — ADR 0002 |
| 3 | `/spec-driven-development` | ✅ done |
| 4 | `/agent-skills:build` | one task at a time |
| 5 | `/security-and-hardening` | it grants paid things from a webhook |
| 6 | `/code-review-and-quality` | before merge |

🛑 **Human checkpoints** — any finding on the money path is reported before it
is fixed; the four suites before merge.

**Done when** a centre buys 40 credits for four seats, the webhook grants them,
a fifth student with no cap is refused, a student spends their five free
sessions before any credit, two simultaneous spends of the last credit leave
the pool at zero rather than minus one, and a lapsed centre freezes without
losing anything.

---

## Block 24 — folded into block 23

AI Speaking credits ship with the foundation that carries them. The number is
kept rather than reused, so nothing in the history has to be renumbered.

---

## Block 25 — Prep Pass

### Intent

**3 000 FCFA per student, 60 days, paid once.** Unlimited access to the
existing exercise library — Hören, Lesen, Sprachbausteine, Schreiben, Sprechen,
20+ exercises, repeatable — for 60 days. Not a mock exam; training.

An entitlement with an expiry, gating content that already exists. No new
content, no new AI.

### Skills, in order

| | Skill | What it must produce |
|---|---|---|
| 1 | `/spec-driven-development` | Mainly one question: **60 days from purchase, or from first use?** Plus exactly which existing endpoints the pass gates, and what a student without one sees |
| 2 | `/agent-skills:build` | Build |
| 3 | `/code-review-and-quality` | Review before merge |

### 🛑 Human checkpoints

- **After step 1** — the user answers the 60-days question. Purchase is simpler
  and honest; first-use is kinder and needs a "not started" state. It is a
  commercial choice, not a technical one.
- **Before merge** — the four suites.

### Done when

A center buys passes for named students, those students reach the library, the
access dies on day 61, and a student without a pass is refused with a code the
app can render as an offer.

---

## Block 26 — AI Assisted Learning

### Intent

**2 000 FCFA/élève/mois.** An AI that accompanies a student *while they learn*,
across Hören, Lesen, Schreiben and Sprechen: explains why an answer is wrong,
points at the passage that gives the clue, guides when the student is stuck,
and gives targeted feedback.

Different from AI Speaking. AI Speaking makes the student talk; this one makes
the student understand.

Barely a payment block — one recurring add-on beside Start, then four separate
pieces of AI behaviour. Treat it as **four small blocks**, not one.

### Skills, in order

| | Skill | What it must produce |
|---|---|---|
| 1 | `/idea-refine` | "L'IA accompagne l'élève" is a positioning line, not a spec. Turn it into concrete behaviour per skill, with real examples of what the student sees |
| 2 | `/spec-driven-development` | The spec, per skill, with the cost per interaction and what happens when the model is slow or wrong |
| 3 | `/planning-and-task-breakdown` | Four sub-blocks, one per skill. Ordered cheapest-first so the pattern is proven before the hard one |
| 4 | `/agent-skills:build` | One sub-block at a time |
| 5 | `/code-review-and-quality` | **After each sub-block**, not once at the end |

### 🛑 Human checkpoints

- **After step 1** — the user and Herman agree what the AI actually does. This
  is a product definition, not a technical one.
- **After step 3** — the user approves the four sub-blocks and their order.
- **After each sub-block's review** — ship or continue, the user decides.

### Done when

Each of the four skills has AI help a student can trigger, it is gated behind
the add-on, and the cost per student per month is measured — not estimated.

---

## Block 27 — Exam Day AI tier: decide, do not code

### Intent

Phase 21 shipped a **1 500 FCFA AI tier** for Exam Day: the model writes a
suggested Schreiben mark and a Sprechen transcript for the examiner to read
before typing their own mark. **It is not in the offer sheet**, which prices
Exam Day at 1 000 flat and puts the AI money in AI Assisted Learning (2 000/
mois) and AI Speaking (300/crédit).

Three ways out:

1. add the AI tier to the offer sheet as a second Exam Day price
2. fold it into AI Assisted Learning — a center with that add-on gets AI
   suggestions on exams for free
3. drop it, and remove the tier

### Skills

**None for the decision.** One conversation, the user and Herman.

Then:

| | Skill | When |
|---|---|---|
| 1 | `/documentation-and-adrs` | Record whichever way it goes, with the reasoning |
| 2 | `/agent-skills:build` | Only if option 2 or 3 needs code |

### 🛑 Human checkpoint

The whole block. Nothing starts without it.

---

## After all six

| | Skill | Why |
|---|---|---|
| 1 | `/shipping-and-launch` | The four deploy-safety items in `docs/BACKLOG.md` §4: a real `/health`, `enableShutdownHooks()`, migrations as a DigitalOcean PRE_DEPLOY job, expand/contract for renames. Before the first paying center, not after |

---

## The order, in one line

**22a** done → **23** the shape, with 22b and AI Speaking credits inside it →
**25** Prep Pass, same shape plus an expiry → **26** AI Assisted Learning, four
sub-blocks and mostly AI rather than payment → **27** a conversation, not code
→ **ship**. Block 24 is folded into 23.
