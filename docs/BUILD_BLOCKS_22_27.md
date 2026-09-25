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

### Intent

Start (4 500 FCFA/élève/mois) promises each student **5 AI speaking sessions a
month**. The code gives **2 per rolling 24 hours**. We are already selling one
thing and shipping another.

Bring the code to the promise:

- 5 sessions per **calendar month**, not a rolling window
- **5 minutes** maximum per session
- auto-close after **30 seconds of silence at the start**
- auto-close on prolonged inactivity
- **one active session at a time** per student

No payment work. No new product. This is Start doing what Start says.

### Why first

It is small, it is wrong in production now, and its new counter is the first
thing block 23's entitlement table will hold. Fixing it after 23 would mean
designing it twice.

### Skills, in order

| | Skill | What it must produce |
|---|---|---|
| 1 | `/deprecation-and-migration` | The plan for students **mid-window** when the change lands. A rolling 24h counter becoming a monthly one is a semantic change: decide whether existing usage carries over, resets, or is forgiven — and write the migration that does it |
| 2 | `/spec-driven-development` | The spec for all five rules, including what the client sees when a session is refused and what "prolonged inactivity" means in seconds |
| 3 | `/agent-skills:build` | The implementation, TDD, task by task |
| 4 | `/code-review-and-quality` | Review before merge. Fix what it finds, then re-run the four suites |

### 🛑 Human checkpoints

- **After step 1** — the mid-window decision is a *commercial* one (a student
  who has used their 2 today: do they get 5 more?). User confirms before code.
- **After step 2** — confirm "prolonged inactivity" in seconds, and whether the
  5-minute cap is hard (cut mid-sentence) or soft (warn, then cut).
- **Before merge** — the four suites, stated with their numbers.

### Done when

A Start student gets exactly 5 sessions in a calendar month, a session dies at
5 minutes, a silent start dies at 30 seconds, a second session is refused while
one is live — and the frontends have been told, because all four are
user-visible changes.

---

## Block 23 — The entitlement foundation ⬅ the block that matters

### Intent

Three of the five products are held by a **student**, not a center: Prep Pass
(60 days), AI Speaking credits (a balance), AI Assisted Learning (a monthly
add-on). The schema has nowhere to put any of them. A center holds seats and
exam slots; a student holds nothing.

Build one shape that all three reuse:

- an **entitlement** row: which student, which product, and either a balance or
  an expiry
- new `PaymentKind` values for the three products
- one service that **grants** on a verified webhook and **spends** on use
- the center pays; the student holds. See the ADR in step 2

### Why it is the expensive one

24, 25 and 26 are each a few days *if this is right* and a rewrite each if it
is not. Every hour spent on the shape here is repaid three times.

### Decision already taken

**The center pays, always.** The schema is B2B2C, the offer sheet prices
everything "par élève" sold to the centre, and student-direct payment would
mean a new checkout plus app-store rules on mobile. Students never see money.
Record it, do not re-litigate it.

### Skills, in order

| | Skill | What it must produce |
|---|---|---|
| 1 | `/api-and-interface-design` | **The step of this block.** The entitlement table, the endpoints a center uses to buy for N students, the endpoint a student's client reads to know what they hold, and the internal spend interface. Design it against all three future products at once, not just the first |
| 2 | `/documentation-and-adrs` | One ADR: *the center pays, the student holds.* With the alternatives rejected and why, because this will be questioned in six months |
| 3 | `/spec-driven-development` | The spec, built on the shape from step 1 |
| 4 | `/planning-and-task-breakdown` | The split. This is too big for one pass — expect 4–6 tasks, each shippable |
| 5 | `/agent-skills:build` | Build, one task at a time, TDD |
| 6 | `/security-and-hardening` | It grants paid things from a webhook. Check: replay, idempotency, a grant that cannot be forged, a spend that cannot go negative under concurrency, and a center that cannot grant to another center's student |
| 7 | `/code-review-and-quality` | Review before merge |

### 🛑 Human checkpoints

- **After step 1** — the user reads the table and the endpoints before any
  spec. This is the one review that pays for itself.
- **After step 4** — the user approves the task split before building.
- **After step 6** — any finding on the money path is reported to the user
  before it is fixed, not after.
- **Before merge** — the four suites.

### Done when

A center can buy a product for a named set of its students, a verified webhook
grants it, a student's client can read what they hold, spending it is atomic,
and nothing in the design is specific to any one of the three products.

---

## Block 24 — AI Speaking credits

### Intent

**300 FCFA per credit. 1 credit = one 5-minute AI session.** A center buys a
pack, the credits go to its students, and a student who has used their 5 Start
sessions spends credits instead.

Pure balance. If block 23 is right, this is the exam-slot pattern with a
different noun.

### Skills, in order

| | Skill | What it must produce |
|---|---|---|
| 1 | `/spec-driven-development` | What a credit is, what spends one, whether it expires, and the order of spend: Start's 5 free sessions first, then credits |
| 2 | `/agent-skills:build` | Build |
| 3 | `/code-review-and-quality` | Review before merge |

The spine, nothing more. If this block starts wanting a design skill, block 23
was not finished.

### 🛑 Human checkpoints

- **After step 1** — confirm two things: do credits expire, and are they held
  per student or pooled by the center for any student to draw on?
- **Before merge** — the four suites.

### Done when

A center buys 100 credits, a student out of free sessions spends one, the
balance drops by exactly one under concurrent calls, and the free allowance is
always used first.

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

**22** (small, already wrong) → **23** (the shape everything reuses) → **24**
(easiest real product) → **25** (same shape, an expiry) → **26** (four
sub-blocks, mostly AI) → **27** (a conversation) → **ship**.
