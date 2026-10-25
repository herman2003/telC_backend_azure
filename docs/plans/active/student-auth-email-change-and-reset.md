# Implementation Plan: Student email change + reset hardening

## Overview

Close the two High account-takeover paths from the security audit: (1) profile
email change without proof of the new inbox, (2) student password reset with a
6-digit code unbound to email and spray-friendly IP limits. Align student reset
with the center `email + code` pattern. Medium findings (guest rooms, Swagger,
writing UUID, login timing, Valkey) are explicitly out of scope.

**Approved design** (conversation, 2026-10-25): pending_email + password gate;
extend verify to swap; reset requires email; defaults 5/15min IP + per-email;
keep 6-digit code and field name `token`.

## Architecture decisions

1. **`pending_email` on `Student`** — old `email` / `email_verified` stay until
   confirm; reuse `email_verification_token` / `expires` for the change link.
2. **Uniqueness** — reject if the new address collides with another student's
   `email` or `pending_email` (generic error, no enumeration).
3. **Confirm** — extend `verifyEmail` / `verifyEmailPublic`: when
   `pending_email` is set and token is valid, swap then clear pending + token.
4. **Reset** — `findFirst({ email, password_reset_token: hash })`; require
   `email` on DTO (breaking). Keep body field `token` (6 digits).
5. **Rate limits** — default reset max **5** / 15 min; enforce both IP and
   normalized-email buckets in one `enforceDistributed` call.
6. **Migration** — only via `scripts/apply-migration.mjs` + `.env.test`; never
   bare `prisma migrate` / never production host.

## Task list

### Phase 1: Foundation (schema + DTO contracts)

#### Task 1: Add `pending_email` to Student

**Description:** Prisma field + migration applied with the test-db script.
Nullable string; unique index (partial uniqueness if the codebase already uses
that pattern; otherwise unique where not null as Prisma allows).

**Acceptance criteria:**
- [ ] `Student.pending_email String?` in `schema.prisma`
- [ ] Migration applied on test DB via `scripts/apply-migration.mjs`
- [ ] Generated client includes the field

**Verification:**
- [ ] Script exit code 0 against `.env.test`
- [ ] `npx tsc --noEmit` still clean after generate (or after later tasks)

**Dependencies:** None

**Files likely touched:**
- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_student_pending_email/migration.sql`

**Estimated scope:** S

#### Task 2: DTO updates (profile + reset)

**Description:** Profile DTO: optional `currentPassword` when email changes
(validate presence in service if preferred). Reset DTO: required `email`
(+ NormalizeEmail if students use it elsewhere). Document Swagger text.

**Acceptance criteria:**
- [ ] `ProfileUpdateDto` accepts `currentPassword` (optional at DTO level;
      required by service when `email` is present)
- [ ] `ResetPasswordRequestDto` requires `email`
- [ ] `StudentResponseDto` / profile response includes `pendingEmail: string | null`

**Verification:**
- [ ] Unit/DTO validation tests or existing pipe behaviour covered in later
      service tests

**Dependencies:** None (can parallel Task 1)

**Files likely touched:**
- `src/modules/auth/dto/profile-update.dto.ts`
- `src/modules/auth/dto/reset-password-request.dto.ts`
- `src/modules/auth/dto/*student*response*` (or inline controller mapping)

**Estimated scope:** S

### Checkpoint: Foundation
- [ ] Migration on test DB OK
- [ ] DTOs compile

### Phase 2: Vertical slice — password reset

#### Task 3: Bind reset to email + tighten rate limits

**Description:** `resetPassword` looks up by email + token hash. Controller
passes IP and email into rate limit. Defaults: max attempts 5; add per-email
bucket. Wrong pair → existing `RESET_TOKEN_INVALID`.

**Acceptance criteria:**
- [ ] Lookup requires matching email
- [ ] Default `RATE_LIMIT_RESET_PASSWORD_MAX_ATTEMPTS` fallback is `5`
- [ ] Per-email key enforced alongside IP
- [ ] Session revoke + new session behaviour unchanged on success

**Verification:**
- [ ] `npx jest test/auth.service.spec.ts` (and rate-limit unit if present)
      exit 0 with new cases

**Dependencies:** Task 2

**Files likely touched:**
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/auth.controller.ts`
- `src/shared/services/rate-limit.service.ts`
- `test/auth.service.spec.ts`
- `test/auth.e2e-spec.ts` (mock signatures if needed)

**Estimated scope:** M

### Checkpoint: Reset
- [ ] Reset without email → 400
- [ ] Correct email+code → session; wrong email+code → invalid
- [ ] Human: no Medium-item drive-by changes

### Phase 3: Vertical slice — pending email change

#### Task 4: `updateStudentProfile` pending-email flow

**Description:** On email change: verify `currentPassword` with bcrypt; set
`pending_email` + verification token; send verification email to **new**
address; leave `email` / `email_verified` unchanged. Profile response exposes
`pendingEmail`. Non-email fields unchanged. Require password only when email
field is present and differs.

**Acceptance criteria:**
- [ ] Missing/wrong password → clear errors
- [ ] Collision with another email/pending → generic failure
- [ ] Mail sent to pending address only
- [ ] Old email still used for login/forgot-password until confirm

**Verification:**
- [ ] New cases in `test/auth.service.spec.ts` exit 0

**Dependencies:** Task 1, Task 2

**Files likely touched:**
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/auth.controller.ts`
- `src/modules/auth/email.service.ts` (reuse `sendVerificationEmail` or thin
  “confirm email change” copy)
- `test/auth.service.spec.ts`

**Estimated scope:** M

#### Task 5: Verify paths apply pending swap

**Description:** `verifyEmail` and `verifyEmailPublic`: if `pending_email` set
and token valid → assign `email`, clear pending + token, set
`email_verified: true`. Register-verify path (no pending) unchanged.

**Acceptance criteria:**
- [ ] Pending + valid token → email swapped, pending null
- [ ] No pending → existing flip `email_verified` only
- [ ] Expired/invalid → existing errors

**Verification:**
- [ ] Spec cases for both verify entry points exit 0

**Dependencies:** Task 4

**Files likely touched:**
- `src/modules/auth/auth.service.ts`
- `test/auth.service.spec.ts`

**Estimated scope:** S

### Checkpoint: Email change
- [ ] Full flow: patch → mail mock → verify → email updated
- [ ] Stolen-session attacker cannot finalize without inbox of new address

### Phase 4: HTTP + gates + docs touch

#### Task 6: Bruno student auth scenarios

**Description:** Extend the collection that covers student auth (prefer
`bruno/Student Activation/` or add a small Student Auth folder only if none
fits). Scenarios: reset with email success; reset missing email 400; profile
email change returns `pendingEmail`; verify clears pending.

**Acceptance criteria:**
- [ ] Requests + assertions for the four behaviours above
- [ ] Safe env only (`local.bru` / test DB)

**Verification:**
- [ ] Run from Bruno app against `npm run start:testdb` if available; else
      report **blocked** with reason (no silent skip)

**Dependencies:** Tasks 3–5

**Files likely touched:**
- `bruno/Student Activation/*.bru` (or adjacent student auth collection)

**Estimated scope:** M

#### Task 7: Five gates + PR prep note

**Description:** Run all CI gates; fix only failures caused by this work.
Branch from `dev`; do not push to `dev`/`main`.

**Acceptance criteria:**
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run build` exit 0
- [ ] `npx jest` exit 0
- [ ] `npm run test:integration` exit 0
- [ ] `npm run test:e2e` exit 0
- [ ] After integration: `node scripts/seed-b2-bruno-fixture.mjs` if suites wiped
      fixture data

**Verification:** Read each gate by **exit code**, not grepped output.

**Dependencies:** Tasks 1–6

**Files likely touched:** only fixes required by failures

**Estimated scope:** S–M

### Checkpoint: Complete
- [ ] Design behaviours implemented
- [ ] Gates green
- [ ] Bruno run or explicitly blocked
- [ ] Ready for fresh-context code review, then PR (human merge)

## Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Flutter/vitrine still call reset without `email` | High (prod 400s) | Breaking change called out in PR; coordinate client; Bruno documents new body |
| Unique on `pending_email` + nulls | Med | Follow existing Prisma unique-null patterns in this schema |
| Reusing verification token while unverified register pending | Low | Change flow only for verified users changing email; register path has no `pending_email` |
| Accidental `prisma migrate` on `.env` | Critical | Only `scripts/apply-migration.mjs`; refuse wandering-hall |

## Open questions

None — design approved 2026-10-25. Client lockstep for reset `email` is an
ops/coordination note, not a product undecided.

## Out of scope

Guest `GuestBlockGuard` on rooms, Swagger gating, writing UUID guest check,
student login dummy bcrypt, Valkey fail-closed auth limits.
