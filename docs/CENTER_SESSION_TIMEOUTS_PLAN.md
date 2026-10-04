# Implementation Plan: Center session timeouts

Source of truth: `docs/CENTER_SESSION_TIMEOUTS_SPEC.md`  
Follow-up tracker: `docs/things-to-do-after.md` (Harden center session timeouts)

## Overview

Add center-only idle (30m) and absolute (12h) session limits enforced on refresh
and `CenterAuthGuard`, using existing `CenterDeviceSession.created_at` /
`last_used_at`. Students stay on 15m / 7d with no admin clocks.

## Architecture Decisions

- **Session row is the clock**, not a shorter shared `JWT_REFRESH_TOKEN_EXPIRY`.
- **One policy helper** shared by refresh and guard (no duplicated TTL math).
- **Revoke on expiry** so access tokens die on the next guard check (Valkey +
  `revoked_at`, same spirit as logout).
- **Touch `last_used_at` on successful guard** so idle = no API activity.
- **No Prisma migration** — columns already exist.
- **Students out of scope** for this PR.

## Dependency graph

```
Env + TTL parse
      │
center-session-policy (assert + revoke helper)
      │
      ├── center-auth.service refresh
      └── CenterAuthGuard
            │
      CenterExceptionFilter message
            │
      tests + .env.example
```

## Task List

### Phase 1: Policy foundation

#### Task 1: Config + TTL parser
**Description:** Read `CENTER_SESSION_IDLE_TTL` / `CENTER_SESSION_ABSOLUTE_TTL`
with defaults `30m` / `12h`. Small parser for `Nm` / `Nh` (and optionally `Nd`).

**Acceptance criteria:**
- [ ] Defaults apply when env unset
- [ ] Invalid env fails loudly at boot or first use (prefer boot / module init)
- [ ] `.env.example` updated

**Verification:** unit tests for parser; `npm run build`

**Files:** `src/modules/centers/center-session-policy.ts` (or config helper),
`.env.example`

**Scope:** Small

---

#### Task 2: `assertCenterSessionWithinTtl` + revoke helper
**Description:** Pure check against `created_at` / `last_used_at` / `revoked_at`;
throw `CENTER_SESSION_EXPIRED`. Helper to set `revoked_at` + Valkey revoke
consistent with logout.

**Acceptance criteria:**
- [ ] Idle breach throws
- [ ] Absolute breach throws
- [ ] Fresh session passes
- [ ] Already revoked → `CENTER_SESSION_REVOKED` (or expired — pick one and test it)

**Verification:** `npm test -- --testPathPatterns=center-session-policy`

**Files:** `src/modules/centers/center-session-policy.ts`,
`test/center-session-policy.spec.ts`

**Scope:** Small  
**Depends:** Task 1

---

### Checkpoint: Foundation
- [ ] Policy tests green
- [ ] Spec success criteria for clocks understood by reviewer

---

### Phase 2: Wire enforcement

#### Task 3: Refresh path
**Description:** In `CenterAuthService.refresh`, after session load / ownership
checks, run policy; on fail revoke and throw; on success keep rotate and ensure
`last_used_at` updates (existing rotate may already set it — verify).

**Acceptance criteria:**
- [ ] Idle/absolute expired session cannot refresh
- [ ] Active session still refreshes
- [ ] Expired session row ends with `revoked_at` set

**Verification:** extend `test/center-auth*.spec.ts`

**Files:** `src/modules/centers/center-auth.service.ts`, related specs

**Scope:** Medium  
**Depends:** Task 2

---

#### Task 4: `CenterAuthGuard`
**Description:** After existing session-active checks, load `created_at` /
`last_used_at` (expand select), run policy, revoke on fail, bump `last_used_at`
on success.

**Acceptance criteria:**
- [ ] Expired → 401 `CENTER_SESSION_EXPIRED`
- [ ] Active → request proceeds and `last_used_at` moves forward
- [ ] DB outage behaviour stays 503 (do not turn timeout logic into false 401
      when session cannot be read)

**Verification:** guard unit tests

**Files:** `src/modules/centers/guards/center-auth.guard.ts`, guard spec

**Scope:** Medium  
**Depends:** Task 2

---

#### Task 5: Exception filter message
**Description:** Add human-readable mapping for `CENTER_SESSION_EXPIRED`.

**Acceptance criteria:**
- [ ] Filter returns clear “log in again” style message

**Verification:** existing filter test pattern or snapshot of message map

**Files:** `src/modules/centers/center-exception.filter.ts`

**Scope:** XS  
**Depends:** Task 3 or 4 (code introduced)

---

### Checkpoint: Core
- [ ] Refresh + guard tests green
- [ ] Student auth tests still pass (smoke or full suite slice)
- [ ] eslint clean on touched files (baseline)

---

### Phase 3: Closeout

#### Task 6: Docs + tracker
**Description:** Check success criteria in the SPEC; update
`things-to-do-after.md` status for this item; note front follow-up for `sprach`.

**Acceptance criteria:**
- [ ] SPEC checklist updated
- [ ] Tracker reflects shipped / front remaining

**Files:** `docs/CENTER_SESSION_TIMEOUTS_SPEC.md`,
`docs/things-to-do-after.md`

**Scope:** XS  
**Depends:** Tasks 3–5

---

### Checkpoint: Complete
- [ ] All SPEC success criteria met for backend
- [ ] PR opened to `dev` (no direct push)
- [ ] Azure env optional (defaults work without it)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Touching `last_used_at` every request loads DB | Med | Start simple; throttle later if needed |
| Cache says “not revoked” while absolute expired | High | Always evaluate TTL against DB timestamps when session is loaded |
| Accidental student coupling | High | No imports from student auth refresh; tests assert center-only |
| Front ignores new code | Med | Document `CENTER_SESSION_EXPIRED`; reuse same clear-storage path as revoked |

## Parallelization

- Task 1–2 sequential.
- Tasks 3 and 4 can proceed in parallel after Task 2 (same helper).
- Task 5 anytime after the code string exists.
- Task 6 last.

## Front follow-up (not this backend PR)

- `sprach`: on `CENTER_SESSION_EXPIRED` / failed center refresh → clear
  localStorage → login screen.

## Open Questions

- None; defaults locked at 30m / 12h unless product changes them before coding.
