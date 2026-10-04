# Spec: Center session timeouts (idle + absolute)

## Objective

Center managers are **admin** users of a paid school dashboard. Their sessions
must expire on inactivity and must not survive overnight via sliding refresh.
Students keep today’s longer consumer session policy.

**Users**
- Primary: center manager (`CenterAuthGuard` / `center-auth`)
- Explicitly out of scope: students (`JwtAuthGuard` / student refresh)

**Success**
- After **30 minutes** without center API activity, the next refresh or
  protected call fails and the session is revoked.
- After **12 hours** since session creation, the session fails even if the
  manager was active the whole time.
- Students still use `JWT_ACCESS_TOKEN_EXPIRY` (15m) and
  `JWT_REFRESH_TOKEN_EXPIRY` (7d) with no idle/absolute admin clocks.
- Frontend can detect expiry via a stable error code and clear localStorage.

## Tech Stack

- NestJS center auth: `center-auth.service.ts`, `CenterAuthGuard`
- Session row: `CenterDeviceSession` (`created_at`, `last_used_at`, `revoked_at`)
- Tokens: `TokenService` center pair helpers (access still ~15m)
- Errors: `CenterExceptionFilter` + `UnauthorizedException` codes
- Config: env vars in `.env.example` / Azure App Settings

## Commands

```
Build:     npm run build
Unit:      npm test -- --testPathPatterns=center-session
           npm test -- --testPathPatterns=center-auth
Lint (touched files):
           npx eslint "src/modules/centers/**/*.ts" "test/center*.ts"
Dev:       npm run start:dev
```

## Project Structure

```
src/modules/centers/
  center-session-policy.ts          NEW — parse TTL + assert alive
  center-auth.service.ts            refresh: check + revoke on fail
  guards/center-auth.guard.ts       check + touch last_used_at
  center-exception.filter.ts        message for new error code(s)
.env.example                        document CENTER_SESSION_* vars
test/
  center-session-policy.spec.ts     NEW
  center-auth*.spec.ts              extend refresh cases
  center-auth.guard.spec.ts         extend if present / add
docs/
  CENTER_SESSION_TIMEOUTS_SPEC.md   this file
  CENTER_SESSION_TIMEOUTS_PLAN.md   implementation plan + tasks
  things-to-do-after.md             link / mark done when shipped
```

## Code Style

Follow existing center auth comments (why, not what). Prefer one shared
policy function used by both refresh and guard so the clocks cannot drift.

Example shape:

```typescript
export function assertCenterSessionWithinTtl(
  session: { created_at: Date; last_used_at: Date; revoked_at: Date | null },
  now: Date,
  policy: { idleMs: number; absoluteMs: number },
): void {
  if (session.revoked_at) {
    throw new UnauthorizedException('CENTER_SESSION_REVOKED');
  }
  if (now.getTime() - session.created_at.getTime() > policy.absoluteMs) {
    throw new UnauthorizedException('CENTER_SESSION_EXPIRED');
  }
  if (now.getTime() - session.last_used_at.getTime() > policy.idleMs) {
    throw new UnauthorizedException('CENTER_SESSION_EXPIRED');
  }
}
```

On failure, persist `revoked_at` (and Valkey revoke if that path already exists
for logout) so access tokens stop working on the next guard check.

## Testing Strategy

| Level | Focus |
|-------|--------|
| Unit — policy | idle breach, absolute breach, both OK, already revoked |
| Unit — refresh | expired session cannot rotate; active session can; student helpers unused |
| Unit — guard | expired → 401; active → allows and updates `last_used_at` |
| Regression | student token paths not wired to this policy |

No schema migration required (`created_at` / `last_used_at` already exist).

## Boundaries

**Always**
- Enforce timeouts on the **server** (refresh + `CenterAuthGuard`).
- Scope checks to `CenterDeviceSession` only.
- Revoke the session when idle/absolute fails (not a soft warning).
- Keep student `JWT_*` env vars meaning what they mean today.
- Add unit tests before considering the feature done.

**Ask first**
- Changing defaults away from 30m / 12h.
- Shortening center refresh JWT expiry separately from session TTLs.
- Throttling `last_used_at` writes (every request vs every N minutes).

**Never**
- Lower global `JWT_REFRESH_TOKEN_EXPIRY` to “fix” centers (hurts students).
- Implement idle only in the Next.js dashboard.
- Apply this policy to student `device_sessions`.

## Product decisions (locked)

| Knob | Value | Applies to |
|------|-------|------------|
| Access JWT | 15m (existing) | Centers and students |
| Student refresh | 7d sliding (existing) | Students only |
| Center idle | **30 minutes** since `last_used_at` | Centers only |
| Center absolute | **12 hours** since `created_at` | Centers only |
| Students idle/absolute | **None** | — |

## Behaviour

### Login / verify email
Unchanged: create `CenterDeviceSession` with `created_at` and `last_used_at = now`.

### Protected center API (`CenterAuthGuard`)
1. Verify center access JWT (existing).
2. Load session; refuse if missing/revoked (existing + Valkey).
3. **NEW:** run idle + absolute checks; on fail revoke + `CENTER_SESSION_EXPIRED`.
4. **NEW:** update `last_used_at = now` on success (activity).

### Refresh (`POST /api/center-auth/refresh`)
1. Verify center refresh JWT (existing).
2. Load non-revoked session (existing).
3. **NEW:** idle + absolute; on fail revoke + `CENTER_SESSION_EXPIRED`.
4. Rotate refresh hash (existing); bump `last_used_at`.

### Students
No code path changes. No new env required for students.

### Error contract

| Code | HTTP | When |
|------|------|------|
| `CENTER_SESSION_EXPIRED` | 401 | Idle or absolute exceeded (new) |
| `CENTER_SESSION_REVOKED` | 401 | Already revoked / logout (existing) |
| `INVALID_CENTER_REFRESH_TOKEN` | 401 | Bad/replayed refresh (existing) |

Front (`sprach`): on these 401s during refresh or API, clear center tokens and
send the manager to login. Front-only timers are optional UX, not authority.

## Config

```
# Center admin sessions only (defaults if unset)
CENTER_SESSION_IDLE_TTL=30m
CENTER_SESSION_ABSOLUTE_TTL=12h

# Unchanged — students (and JWT lifetime strings for both access tokens)
JWT_ACCESS_TOKEN_EXPIRY=15m
JWT_REFRESH_TOKEN_EXPIRY=7d
```

TTL parsing should accept the same style as existing JWT expiry strings
(`30m`, `12h`) via a small local parser or a shared helper — not by changing
student token issuance.

## Success Criteria

- [x] Idle > 30m → refresh and guard return 401 `CENTER_SESSION_EXPIRED` and session is revoked
- [x] Absolute > 12h → same, even if `last_used_at` is fresh
- [x] Active center session still refreshes and calls APIs normally
- [x] Student auth/refresh behaviour unchanged
- [x] `.env.example` documents the two new vars
- [x] Unit tests cover policy, refresh, and guard paths
- [x] Filter maps `CENTER_SESSION_EXPIRED` to a clear message

## Open Questions

- None blocking. Optional later: shorter center refresh JWT as defence in depth
  once session TTLs are live.
