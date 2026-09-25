# Spec: Block 22a — Elena session rules

**Written:** 2026-09-25
**Block:** 22a of `docs/BUILD_BLOCKS_22_27.md`
**Answers to:** `docs/OFFRES_LERNIQO.md` §1, Sprechen IA Light
**Status:** built and reviewed on `feat/elena-session-rules`. The Flutter half is `docs/ELENA_FLUTTER_CHANGE_REQUEST.md`.

---

## Assumptions I am making

1. The Flutter app connects **directly to Google** with the minted token. No
   audio passes through this backend — confirmed in `LiveTokenController`.
2. Therefore the backend **cannot detect silence**. Rules 2 and 3 below are
   Flutter's to enforce; the backend's only lever is how long the token lives.
3. Elena is the product's only live AI conversation. There is no second live
   path to keep in step.
4. Guests keep their current treatment: capped by IP, because a guest
   `studentId` can be re-rolled.
5. Existing env variables stay the way limits are configured. No new
   configuration mechanism.
6. `ELENA_CONCURRENT_MAX` stays a **global** spend ceiling. The new per-student
   rule sits beside it, not instead of it.

→ Correct me now, or the plan proceeds on these.

---

## Objective

Start (4 500 FCFA/élève/mois) promises each student a Sprechen IA Light
session that:

| | rule | who can enforce it |
|---|---|---|
| 1 | **5 minutes maximum** per session | **backend** — the token's expiry, enforced by Google |
| 2 | closes after **30 s of silence at the start** | **Flutter only** |
| 3 | closes after **60 s of silence** mid-session | **Flutter only** |
| 4 | **one active session at a time** per student | **backend** |

Today the backend gives **10 minutes** (`GEMINI_LIVE_SESSION_MAX_MINUTES`) and
has **no per-student concurrency** — the only pool is a global one of
`ELENA_CONCURRENT_MAX` slots, so one student can hold two at once while another
is refused with "Elena parle avec quelqu'un d'autre".

**This block delivers rules 1 and 4, and nothing else.** Rules 2 and 3 go to
the Flutter team as a written change request; the backend cannot do them and
must not pretend to.

Not in this block: the 5-sessions-a-month allowance. That is 22b, inside
block 23, because a monthly counter cannot live in Valkey.

---

## What changes

### R1 — Five minutes, not ten

`GEMINI_LIVE_SESSION_MAX_MINUTES` default `10` → `5`.

It flows to two places already and needs no new plumbing:

- `mintLiveToken` sets the token's `expireTime`, which **Google** enforces. A
  modified client cannot extend it.
- the concurrency slot's TTL, so a crashed app frees its slot in 5 minutes
  rather than 10.

Halves the worst-case Gemini spend per session.

### R4 — One live session per student

A second `acquire` for a student who already holds a live slot is refused,
with its own message key, **before** any counter is spent.

Design constraints, in order of how much they matter:

1. **Refuse before consuming.** A student told "you already have a session
   open" must not have paid for it out of their daily allowance.
2. **The slot must expire on its own.** The backend never learns that a
   browser-to-Google session ended unless the client calls
   `/api/speaking/live-session/end`. A crashed app must not lock a student out
   for the rest of the day — the per-student slot carries the same TTL as the
   session ceiling, so the worst case is a 5-minute wait.
3. **Valkey may be down.** Every existing layer degrades to an in-process
   counter; this one does the same, and the fallback must not be *stricter*
   than the real thing. Refusing a student because Valkey restarted is worse
   than letting a rare second session through.
4. **Guests are capped by IP, not by student.** A per-student slot for a guest
   would key on a UUID they can re-roll, which is not a limit. Guests keep the
   IP treatment they have now.
5. **Release is idempotent** and must clear the per-student slot as well as the
   pool slot, or `/end` would free the shared resource and keep the student
   locked out of their own.

### Order inside `acquire`

Load-bearing, and the existing comment explains why the current order is what
it is. The new claim goes **first**:

```
1. claim this student's own slot, atomically          → refuse, spend nothing
2. is the global pool full?                           → refuse, give the slot back
3. consume the caller's own daily allowance           → refuse, give the slot back
4. consume the global daily counter
5. claim the concurrency slot (atomic)
```

**The claim is the check.** An earlier draft read whether the slot was held and
took it at the end; review found that two requests arriving together both read
"free" and both were granted — the one thing this rule exists to stop. A double
tap is enough to trigger it.

Claiming first means every later refusal has to hand the slot back, or a
student turned away by somebody else's traffic would lose five minutes of their
own. Nothing shared is touched before step 2, so the refusal in step 1 still
costs them nothing.

---

## What the client is told

Existing refusals return 429 with a `messageKey` the app maps to French copy.
One new key:

| messageKey | when | suggested copy |
|---|---|---|
| `elenaSessionAlreadyOpen` | this student already has a live session | « Vous avez déjà une session ouverte avec Elena. Terminez-la avant d'en commencer une autre. » |

Existing keys are unchanged: `elenaDailyLimit`, `elenaBusyToday`,
`elenaBusyNow`. The new one is deliberately **not** `elenaBusyNow` — that one
means Elena is busy with somebody else, and telling a student that when the
somebody else is *them* would send them away to wait for nothing.

---

## Handed to the Flutter team

The backend cannot see audio, so these are theirs. To be sent as a change
request when this block merges:

- **R2** — end the session after **30 seconds** with no speech detected at the
  start, and call `POST /api/speaking/live-session/end`.
- **R3** — end the session after **60 seconds** of silence mid-conversation,
  same call.
- Always call `/live-session/end`, including on a crash-recovery path, a
  back-navigation, and an app-background timeout. Without it the slot is held
  until TTL and the student is locked out of their own next session for up to
  5 minutes.
- The session now ends at **5 minutes**, not 10. Show the remaining time.

---

## Tech stack and commands

NestJS 11, TypeScript, Jest. Valkey through `ValkeyService`, with an in-process
`NodeCache` fallback.

```
Build:       npm run build
Typecheck:   npx tsc --noEmit -p tsconfig.json
Unit:        npx jest
E2E:         npm run test:e2e
Integration: npm run test:integration
Lint:        npx eslint <files>
```

## Files this touches

```
src/modules/speaking/live/live-session-limit.service.ts   the rules
src/modules/speaking/live/live-token.controller.ts        only if the refusal shape changes
test/…-live-session-limit…spec.ts                          the tests
.env.example                                               the new default
```

No schema change. No migration. No new dependency.

## Testing strategy

Unit tests only — this is one service with an injected Valkey double. The four
cases that must exist:

1. a student holding a live session is refused, and **no counter is consumed**
2. the refusal carries `elenaSessionAlreadyOpen`, not `elenaBusyNow`
3. `release` frees the per-student slot as well as the pool slot
4. with Valkey unavailable, a second session is still bounded by the in-process
   fallback, and the first session is never refused

Plus one asserting the token is minted with a **300-second** expiry, because
that number is the product promise and a default changed by accident would be
silent.

## Boundaries

- **Always:** all four suites green before merge; the refusal must cost the
  student nothing.
- **Ask first:** anything that would make a *guest's* limits stricter, and any
  change to `ELENA_CONCURRENT_MAX` semantics.
- **Never:** detect silence server-side by proxying audio. The architecture is
  client-to-Google on purpose, and routing audio through us would cost
  bandwidth twice and add a transcript we do not need.

## Success criteria

- [ ] A minted token expires **300 seconds** after issue.
- [ ] A student with a live session gets 429 `elenaSessionAlreadyOpen` and
      their daily allowance is untouched.
- [ ] After `/live-session/end`, the same student may start again immediately.
- [ ] A student whose app dies waits at most 5 minutes, not a day.
- [ ] Two *different* students are unaffected by each other, up to the global
      pool.
- [ ] Guests behave exactly as they do today.
- [ ] The Flutter change request for R2 and R3 is written and sent.

## Answered while building

1. **`ELENA_CONCURRENT_MAX` stays 2 in this block, and should become 10.**
   Concurrency is not the budget — `ELENA_GLOBAL_DAILY_MAX` is. At 2, a class
   of twenty doing Sprechen together sees eighteen refusals, which reads as
   broken rather than busy. Raising it costs nothing extra because the daily
   cap still holds the line. Left as a one-line configuration change rather
   than folded in here.
2. **Guests keep 2 per IP per 24 h.** Cutting them to 1 punishes shared
   connections, and a school or a cybercafé is one IP. The real issue is that
   guests and paying students share one daily budget, so a busy demo day can
   starve a centre that paid — the fix is a separate `ELENA_GUEST_DAILY_MAX`,
   also left as a backlog item rather than widened into this block.

## Still open, for block 23

The global daily cap must be checked **after** a student's own allowance once
allowances exist. A student who spent 300 FCFA on a credit and is refused by a
platform-wide counter is a refund request.
