# Backlog

Open work only. Every item below was re-verified against the codebase or against
production on **2026-08-21**; anything that turned out to be already fixed has
been removed rather than marked done.

🔵 = blocked on a decision, not on effort.

See `docs/decisions.md` for choices that look like bugs and are not — read it
before "fixing" anything in auth registration or the Modelltest query params.

---

## 1 — User-facing bugs

### Registration silently discards a re-registered password
`auth.service.ts:102-107` — **verified still present**

The `update` on the unverified-re-registration path writes only
`email_verification_token` and `email_verification_expires`. The password and
name from the second attempt are dropped.

A student registers, never verifies, registers again weeks later with a
different password, verifies, gets logged in — and the next day cannot log in
with the password she actually chose. No error, nothing in the logs, nothing
support can see.

Safe to fix precisely because the account is unverified: nobody has proven
ownership, so no account is being hijacked. Add `password_hash`, `first_name`,
`last_name` to that `update`.

**Three lines. Highest user impact on this list.**

### `emailVerified` is hardcoded `true` in the auth response
`auth.service.ts:468` — **verified still present**

`issueAuthResponse` returns a literal `true` rather than reading
`student.email_verified`. True by construction on the email/password paths; on
the Google path the account is created with `email_verified` taken from the
Google payload, which can be `false`. The response then tells the frontend the
address is verified when it is not.

---

## 2 — Correctness

### Sprachbausteine serves Modelltest 1 for a malformed `?modelltest=`
`sprachbausteine.controller.ts:37` — **verified in production today**

```
GET /api/sprachbausteine/exercise?modelltest=abc  →  200, Modelltest 1
GET /api/writing/exercise?modelltest=abc          →  400   ← correct
GET /api/reading/exercise?modelltest=abc          →  400   ← fixed 2026-08-21
```

Identical cause to the Lesen bug fixed earlier today: the param is declared as
`number` with `DefaultValuePipe(1)` and `ParseIntPipe`, but `main.ts` installs a
global `ValidationPipe({ transform: true })`. Global pipes run **before**
parameter pipes, so `'abc'` is coerced before `ParseIntPipe` ever sees it and
`DefaultValuePipe` substitutes 1. Malformed input silently yields a valid-looking
exam instead of an error, hiding client bugs.

Fix is the same: take the raw string and parse explicitly, as
`writing.controller.ts:69` and now `lesen.controller.ts` do. This becomes more
than cosmetic the moment a second Modelltest exists.

### Two e2e suites do not install the global pipes
`test/app.e2e-spec.ts` — **verified** (`test/speaking-websocket.e2e-spec.ts`
was deleted on 2026-09-19 with the live-speaking tables it wrote to)

They build test apps without the global `ValidationPipe` from `main.ts`, so any
assertion they make about validation or transformation does not represent
production. This is not hypothetical: it is exactly how `lesen.e2e-spec.ts`
asserted `400` for `?modelltest=abc` and passed, while production returned `200`.

### JWT carries no `emailVerified` claim, and no guard checks one
`token-payload.interface.ts`, `jwt-auth.guard.ts` — **verified**

`AccessTokenPayload` is `{ type, studentId, deviceId, sessionId?, isGuest? }`.
The guard verifies signature, requires a `sessionId`, and checks revocation —
there is no verification check anywhere.

The invariant holds today only because of *where* tokens are issued, which is
correct but implicit. A future sixth call site for `issueAuthResponse()` could
hand a token to an unverified student with nothing to stop it. Adding the claim
also unblocks the `emailVerified` fix above.

### `contentRevision` describes only Teil 2
`lesen.service.ts:44` — **verified**

The response-level revision is taken from Teil 2 but serves as the client's
staleness key for the whole payload. Edit Modelltest 2's Teil 1 or Teil 3 and no
cache invalidates.

---

## 3 — Modelltest 2 gates

### 🔵 Hören content lives in TypeScript, not the database
`listening.service.ts` — **verified: 3 hardcoded `modelltest-1-*` revisions, 0 listening models in the schema**

No table, no `modelltest_id`, nothing for a seed to insert into. Adding a second
exam to Hören is a code change, not a content change.

**Blocked on one product answer: how many Modelltests in total?**
- Two and done → duplicate the `CATALOG` object (~1 day)
- Four or five → migrate to the database now (~2–3 days), while a single dataset
  exists to move. Pays for itself at Modelltest 3.

Largest single cost in the whole effort, and the only item here needing a
product decision rather than engineering.

### Settle the seed convention before writing the Modelltest 2 seed
**verified: 7 numbered `.sql` files at the repo root, plus 1 seed inside `prisma/migrations/`**

Two unrelated mechanisms, neither documented. Pick one home
(`prisma/seeds/modelltest-N/`), make inserts idempotent with
`ON CONFLICT DO NOTHING`, namespace the deterministic UUIDs by exam number.
Costs nothing extra while writing the seed anyway.

### `ListeningAttempt` cannot be attributed to an exam
`schema.prisma` — **verified: 0 `modelltest_id` on the model**

`WritingAttempt` and `SprachbausteineAttempt` both carry it. `ListeningAttempt`
has only a nullable `content_revision` and an `exercise_id` that is not a real
foreign key.

Existing rows can be backfilled to Modelltest 1 with certainty **only while one
exam exists**. That window closes when Modelltest 2 is seeded.

---

## 4 — Deferred auth hardening

These come from the account pre-hijacking research (Sudhodanan/Paverd, USENIX
Security '22) that informed the registration fix shipped 2026-08-21.

**They were downgraded from security gates to hygiene by that fix**, and by the
per-address registration cap shipped alongside it. Credentials are now never
written on an unverified address, and re-registration is capped at 5/hour, so a
stale unverified account no longer exposes an account-takeover path — only a
capped nuisance. Worth noting the app was always narrower than the paper's
general case: an unverified account here can do nothing, because no token is
issued until `verifyEmail`.

Revisit at a few thousand users, or sooner if abandoned signups become common.

### Prune unverified accounts
No scheduled deletion exists, and `@nestjs/schedule` is not installed. As of
2026-08-21 production held 13 students, 10 unverified, **9 unverified for over
7 days**.

Two effects. The address stays occupied forever, so a returning user always
lands on the re-registration path and can never get a clean signup — pruning
would fix that outright, since a deleted account makes their next attempt an
ordinary new signup with their new password. And the row is a standing (now
low-value) target.

If done: do the first cleanup **by hand**, reviewing exactly which rows would
go, before automating anything that deletes user data on a timer. Open product
question — whether abandoned accounts get a warning email first. Probably not
at this scale; it is one more email an attacker can trigger.

### Shorten the verification token TTL
`VERIFICATION_TOKEN_TTL_MS` is 24h (`auth.service.ts:28`). The link is a bearer
credential, and a day is a long time for one to sit in an inbox — forwarded
mail, shared devices, link-scanning proxies. 1–2h would be better.

**Not a one-constant change.** `wasVerificationSentRecently` reconstructs the
send time by subtracting the TTL from the stored expiry:

```ts
const sentAt = expiresAt.getTime() - VERIFICATION_TOKEN_TTL_MS;
```

Drop the constant to 2h and every existing row is misread — a row written an
hour ago yields a `sentAt` 22 hours in the future, so the cooldown check reports
"sent recently" and refuses to resend. Existing unverified users would be unable
to request a new verification email for up to a day. Needs a real
`verification_sent_at` column, or a backfill of stored expiries.

---

## 5 — Infrastructure

### Before the first paying center: four deploy-safety items
Added 2026-09-24. None of these matter while `main` is a demo; all of them
matter the day a real center pays.

1. **`/health` tells the truth.** ~~It answered `{ok: true}` without touching
   the database.~~ **Done (2026-10-13):** `GET /health` runs `SELECT 1` and
   returns 503 `DATABASE_UNAVAILABLE` when Neon is down. Still configure
   uptime/New Relic alerts so a human is notified (ops, not code).
2. **`enableShutdownHooks()`.** ~~Never called, so destroy hooks skipped on
   SIGTERM.~~ **Done (2026-10-13):** `configureLifecycle(app)` in
   `bootstrap-config` (called from `main.ts` before `listen`) so Prisma/Valkey
   close on deploy stop.
3. **Migrations as a PRE_DEPLOY job.** `npm start` runs `migrate deploy` in the
   new container, so a failed migration does not fail a deploy step — it stops
   the app from starting. DigitalOcean cancels a deployment whose PRE_DEPLOY
   job fails, which is the behaviour we want.
   **Postponed (2026-10-13):** PR #69 landed on `dev` then was reverted — DO
   Job estimate looked expensive; keep migrate-on-boot until a cheap Job /
   VPS release step is ready. Do not re-merge without wiring PRE_DEPLOY first.
4. **Expand/contract for renames.** Once (3) is not enough — the rename in
   `20260924160000_payment_quantity` broke the old container's reads for the
   length of a cutover. With paying centers that is an outage mid-checkout.
   Add, backfill, dual-write, cut over, drop a release later.

Doing (3) makes every future migration safer, not just the next one, so it is
the one worth doing first.


### No CI — nothing enforces that `main` is green
**verified: no `.github/workflows` directory at all**

Deleting the deploy workflow removed the build+test gate with it. `main` is
currently green only because the suites were run locally before each push;
nothing enforces it, and there is no build gate before a deploy either. Since
DigitalOcean auto-deploys on push, a broken commit reaches production directly.

A test-only workflow is ~15 lines and needs no cloud credentials — restore it
separately from whatever replaced the deploy half.

### Confirm App Platform instance count is 1
Console check, not code. All speaking-room state lives in an in-memory `Map` in
one Node process, so it is correct only at exactly one instance. On Azure this
was pinned by the B1 plan; on App Platform it is a slider, and raising it fails
silently — host and guest land on different processes and the guest gets
`room-not-found` for a room that demonstrably exists.

`ValkeyService` already exists (used by `JwtAuthGuard`), so DO Managed Caching
for Valkey is the natural target if scale-out is ever needed.

### `prisma migrate deploy` runs from the app start command
`package.json:11` — **verified**

Every instance races to migrate on boot (Prisma's advisory lock makes this mostly
safe, but an idle recycle should not be a migration event). Worse, a failed
migration short-circuits the `&&` and the app never boots — an outage rather than
a degraded state. Move to a release/pre-deploy step.

### Schema drift between the live database and `schema.prisma`
**re-verified against production today — larger than first recorded**

`prisma migrate diff` still reports:
- `writing_exercises.bullet_points` — a DEFAULT the schema does not declare
- `writing_exercises.created_at` — `TIMESTAMP(3)`
- `modelltests.created_at` — `TIMESTAMP(3)` *(not in the original note)*

Because Prisma plans these alterations by dropping and recreating the six
`modelltest_id` foreign keys, any future `prisma migrate dev` will churn far more
than the drift itself suggests.

---

### Elena: concurrency, the guest budget, and a legacy model

Three things left out of block 22a deliberately, each a configuration change
rather than logic.

**`ELENA_CONCURRENT_MAX` is 2, platform-wide.** Two students in the world can
talk to Elena at once. A class of twenty doing Sprechen together sees eighteen
refusals, which reads as broken rather than busy. Concurrency is not the
budget — `ELENA_GLOBAL_DAILY_MAX` is — so raising it to 10 costs nothing extra.

**Guests and paying students share one daily budget.** A busy demo day can
therefore starve a centre that paid 4 500 a head. Wants its own
`ELENA_GUEST_DAILY_MAX`, around 20 of the 50, so the demo can never take the
last session from somebody who bought it.

**`gemini-3.1-flash-live-preview` is a legacy preview.** Google recommends
moving to Gemini 3.8 Live. The model is already env-configurable, so the
migration is cheap — but the price changes with it, and the whole
33-to-66-FCFA-a-session arithmetic that justifies a 300 FCFA credit has to be
re-run at the new rate. Do it before block 24 prices anything.

### Four high npm audit findings in production dependencies

`npm audit --omit=dev` reports four high-severity advisories — `deepmerge-ts`,
`fast-uri`, `multer`, `mysql2` — and one moderate (`qs`). All transitive, none
introduced by recent work: the count is identical on a clean tree.

`mysql2` is the interesting one, since nothing here uses MySQL; it is worth
finding out which package drags it in before deciding whether to patch or drop
it. Do this before the first paying centre, alongside the other deploy items.

### `npm run lint` reports 1116 problems, so it gates nothing

950 errors and 166 warnings across `src` and `test`, unchanged whether or not
the working tree has changes. A lint step nobody can read is a lint step nobody
runs, and new code passing cleanly is currently invisible in the noise.

Worth one pass with `--fix`, then a decision about the rules that remain: either
they are worth obeying and the violations get fixed, or they are not and they
come out of the config.

## 6 — Consistency and housekeeping

### `modelltest` param convention differs across three modules
**verified**

| Module | Declaration | Missing param | Malformed param |
|---|---|---|---|
| Lesen | raw string, explicit parse | defaults to 1 | 400 |
| Writing | raw string, explicit parse | 400 | 400 |
| Sprachbausteine | `DefaultValuePipe` + `ParseIntPipe` | defaults to 1 | **200, exam 1** |

Pick one and document it before more skills gain the parameter. Fixing the
Sprachbausteine bug above resolves the malformed column; the missing-param
column is a genuine product choice.

### Select content by foreign key, never by `content_revision`
Every exercise is identified twice — by `modelltest_id` and by a
`content_revision` string that also encodes the exam. They agree today only
because migration 007 wired the FKs by matching those strings. Convention, no
migration.

### Confirm Sprechen intentionally has no per-exam content
Three examiner prompt files, no Modelltest relation. Probably correct — the
speaking exam is a live conversation, not a fixed question set. Worth putting on
record so it is a decision rather than something discovered when a student asks
why Modelltest 2 has no Sprechen.

### `modelltest` is optional on some skills and required on others
Lesen and Sprachbausteine default a missing `modelltest` to 1;
`GET /api/writing/exercise` returns 400 without it, and `/api/speaking/teils`
silently serves Modelltest 1. Carried over from the old api-contract draft,
and still true. Unify before more skills take the parameter — see the Sprechen
entry below.

### `submitTeil2` is a stub
`lesen.service.ts:195` returns `{ score: 0 }` regardless of input.

### Stale Azure paths in `.claude/settings.json`
The old `azurewebsites.net` URLs are gone, but ~10 permission entries still carry
absolute paths from a previous folder location
(`…\SPRACHPRÜFUNG\SPRACHPRÜFUNG_AZURE\telC_backend_azure`). Dead entries that
never match. Cosmetic.

### Azure references in historical docs
Base-URL examples in `docs/contracts/schreiben-api.md`,
`docs/contracts/sprechen-room-ice-servers.md`, `docs/archive/plan-2026.md`,
`ideas/auth-system-overhaul.md`. The operational ones are done;
`docs/architecture/sprechen-room.md`'s remaining mentions are deliberate
Azure-vs-App-Platform comparisons.

### Repo is still named `telC_backend_azure`
GitHub (`NKWILI/telC_backend_azure`) and the local folder. Renaming breaks clones
and remotes for anyone else, so it needs coordinating.

---

## The CEFR level is not checked on writing, speaking, vocab or grammar

Phase 1b of the content level gate. Scheduled, not done.

`PrepPassGuard` carries two checks: the CEFR level, and — without Prep Pass
— the weekly-paper limit. It runs on `modelltests`, `lesen`, `listening` and
`sprachbausteine`.

**Its absence on `writing` and `speaking-catalog` is deliberate for Prep
Pass** and must stay: Schreiben and Sprechen topic GETs are on Start for all
Modelltests, by product decision of 2026-10-22, recorded in
[domains/offres-lerniqo.md](domains/offres-lerniqo.md) and originally decided
in `superpowers/plans/2026-10-06-tranche6-prep-pass-gate.md`. Do not add the
guard to those endpoints.

**The level check is a separate rule and is missing.** The two are
orthogonal — level decides *which* content, Prep Pass decides *how many*
Modelltests. `superpowers/specs/2026-10-18-content-level-gate-option-a-design.md`
puts it out of Phase 1 and into Phase 1b:

> Brancher le même check niveau sur : writing, speaking catalog, vocab,
> grammar (chemins qui bypassent Prep Pass aujourd’hui).

Phase 1b was due "avant ou avec le contenu". B2 content shipped on
2026-10-21, so it is now overdue. Measured on 2026-10-22 with a B1 student:

```
GET /api/writing/exercise?modelltest=7   -> 200   a B2 paper
GET /api/speaking/teils?modelltest=7     -> 200
GET /api/reading/exercise?modelltest=7   -> 403 LEVEL_MISMATCH
```

Scope when it is built: `writing`, `speaking-catalog`, `vocab`, `grammar`.
Note `GET /api/writing/exercise/:id` takes a uuid, and
`extractModelltestNumber` reads a paper *number* from the query, body or
`:number` param — so a guard alone cannot cover that route; it has to resolve
the exercise to its Modelltest first.

### Corrected on 2026-10-22

An earlier version of this entry called the missing guard a Prep Pass
paywall hole. That was wrong — Tranche 6 excluded those two endpoints on
purpose, six days before the level gate was designed. Only the level half is
a gap.

---

## Sprechen serves the wrong paper, today

`speaking_repository_impl.dart:50` sends no `modelltest` query parameter.
`speaking-catalog.controller.ts:60` and `speaking.service.ts:15` both default a
missing value to Modelltest 1. Measured: a student whose weekly paper is 6
gets Modelltest 1's Teile, 200, no error. A B2 student gets B1 content.

Adding `PrepPassGuard` does not fix this — the guard finds no number, returns
null and allows the request, and the controller substitutes 1 afterwards. The
default has to go, and `modelltest` become required, which needs the app to
send it first.

## LEVEL_MISMATCH and LEVEL_REQUIRED render as "Please login again"

Frontend. Neither code appears in the Flutter codebase, so both fall through
the 403 catch-all in `dio_exception_mapper.dart:311` to `authUnauthorized`.
Unreachable from the app today because it never sends a wrong number, but
reachable by URL, and it becomes reachable the moment the guards land.

`PREP_PASS_REQUIRED` is mapped, but as a red error snackbar reading "contact
your school" — no description of what Prep Pass unlocks, no CTA. It is an
upsell surface rendered as a failure.

## The student's CEFR level is not exposed to the app

`POST /api/auth/login` returns `student: { id, firstName, lastName, email,
emailVerified }` — no `level`. The only endpoint carrying it is
`GET /api/progress/me`. The Flutter app has no server level concept at all;
`targetLevelProvider` is a local settings preference.

This blocks the frontend from handling `LEVEL_REQUIRED` ("complete your
profile") or from filtering by level at all. Add `level` to the login and
refresh payloads, or add a `GET /api/auth/me`.

## The app unlocks a screen for Prep Pass, not the paper pool

🔵 Product decision, not a bug to fix blind.

The app gates Prep Pass client-side: `isPrepPassInactive`
(`student_entitlements_rules.dart:12`) decides whether `exams_page.dart:333`
renders the catalogue or an empty state. The module APIs are never called when
inactive — which is why no user reaches a locked paper through the UI.

But when it IS active, every catalogue row still loads
`activeTrainingModelltestNumberProvider`. `kExamsCatalogueModelltestIds =
[1, 2]` only relabels in-memory rows (`exam_catalog_mapper.dart:89`). So a
paying Prep Pass holder sees the same weekly paper under two labels, not the
other papers of their level.

Prep Pass is sold as the Modelltest pool for Lesen, Hören and Sprachbausteine
(1 000 FCFA / 30 days — see [domains/offres-lerniqo.md](domains/offres-lerniqo.md)).
A holder should reach the other papers of their level in those three modules.
Today the screen unlocks and still serves the weekly paper, so the backend
rule and the app do not agree. Frontend side; the backend serves the pool
correctly.

---

# Post-launch product work

Decided, not implemented. Moved here from `things-to-do-after.md` so there is
one backlog rather than two. French as written — these are product briefs.

## Coach date d’examen → tâche du jour

**Status:** todo (après launch)  
**Priority:** P1  
**Area:** progress / student home + center dashboard

### Goal

L’élève saisit une date d’examen ; Lerniqo propose **une tâche par jour** pondérée vers la skill faible (&lt; 45 %, réutilise `WEAK_SKILL_BELOW`). Countdown jusqu’à l’examen. Le centre voit qui est prêt / qui a une date.

### Why

Différenciateur centres / rétention (inspir. Prepilingo, Papagei). Readiness + alertes `weak_skill` existent déjà ; il manque plan journalier et countdown.

### Work required

1. Persister `examDate` côté élève (et exposition centre).
2. Générer 1 tâche/jour orientée skill faible.
3. UI élève : countdown + tâche du jour.
4. UI centre : dates + readiness liées.

---

## Revue d’erreurs + spaced repetition

**Status:** todo (après launch)  
**Priority:** P2  
**Area:** Prep Pass — Lesen / Hören / Sprachbausteine (items discrets)

### Goal

Après un submit, stocker les **erreurs** (item + explication) et les ramener dans une file de révision (ex. 1 / 3 / 7 jours) jusqu’à maîtrise.

### Why

Augmente la valeur Prep Pass sans nouveau contenu Modelltest. Items Richtig/Falsch, Zuordnung, MC du format telc se prêtent bien à la revisit (inspir. Papagei / PassDeutsch).

### Work required

1. Modèle « error bank » lié aux attempts.
2. API : erreurs à revoir + marquer comme révisé / réussi.
3. UI après submit + écran « À revoir ».
4. Scheduling espacé (1 / 3 / 7 jours).
