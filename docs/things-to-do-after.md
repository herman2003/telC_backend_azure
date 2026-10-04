# Things to do after

Open follow-ups that are decided but not yet implemented.

---

## Align Hören training and exam payload structure

**Status:** todo  
**Area:** `src/modules/listening` (entraînement) vs exam block content / audio play

### Goal

Training mode and exam mode must expose the **same structure** for a Hören Teil
(same field names and meaning), so the Flutter client can share one model and
one playback flow instead of two shapes.

### Why

Today the paths diverge:

| Concern | Exam mode | Training (`GET /api/listening/exercise`) |
|--------|-----------|------------------------------------------|
| Play limit | `playsAllowed` from `exam_plays_allowed` | not returned |
| Audio access | `audioId` + `POST .../audio/{id}/play` → `playsRemaining` | direct `audio_url` / `bundled_audio_asset` |
| Enforcement | server (`exam_audio_plays`) | none |

Exam is the reference shape. Training must catch up.

### Work required

1. Change the **entraînement Hören** exercise endpoint so its response matches
   the exam Teil structure (at least `audioId`, `playsAllowed`, questions /
   image / revision fields as exam serves them — no bare replayable URL that
   bypasses the count).
2. Wire training playback to a counted play path (or an equivalent that keeps
   the same contract), so `playsAllowed` / remaining plays mean the same in
   both modes.
3. Update frontend docs (`docs/listening_horen_rest.md`,
   `docs/HOREN_API_FRONTEND.md`) once the contract is unified.
4. Add / adjust tests so training and exam payloads stay in lockstep.

### Notes

- Source of truth for the allowance stays `listening_exercises.exam_plays_allowed`.
- Hiding a play button on the client is not enough; the server must own the count
  in both modes if the structures are truly the same.

---

## Harden center session timeouts (idle + absolute)

**Status:** todo  
**Area:** `src/modules/auth/token.service.ts`, `src/modules/centers/center-auth.service.ts`,
`CenterDeviceSession` / guards; Azure env; front `sprach` center auth storage / refresh

### Goal

Center managers should be treated like **admin** sessions, not like student /
consumer sessions. A manager who left yesterday must **not** still be logged in
today without re-authenticating. Students keep the current longer refresh
policy.

### Why

Today centers and students share the same TTLs:

| Token | Role | Current |
|-------|------|---------|
| Access | `Authorization: Bearer` | **15m** (`JWT_ACCESS_TOKEN_EXPIRY`) |
| Refresh | `POST /api/center-auth/refresh` | **7d** (`JWT_REFRESH_TOKEN_EXPIRY`) |

There is **no** idle timeout and **no** absolute session max. `last_used_at` is
only used for LRU eviction at 3 sessions, not for inactivity logout.

Real chain in prod:

1. Login → access + refresh stored in front **localStorage**.
2. Browser / machine closed → tokens remain.
3. Next day → access expired → front auto-calls refresh → new pair with a
   **full 7d** refresh again (sliding session).
4. Result: stay logged in indefinitely if the user returns within 7 days.
   Continuous activity is not required.

Changing the shared Azure `JWT_REFRESH_TOKEN_EXPIRY` alone is **not** the fix —
it would also shorten student sessions.

Industry pattern for admin dashboards (OWASP / Okta Admin–style):

| Clock | Meaning | Typical |
|-------|---------|---------|
| Idle | no activity → logout | **15–30 min** |
| Absolute | max time since login | **4–12 h** |

### Work required

1. **Do not** only lower the shared `JWT_REFRESH_TOKEN_EXPIRY` in Azure.
2. Add **center-only** env (e.g. `JWT_CENTER_REFRESH_TOKEN_EXPIRY`, and if needed
   idle / absolute vars) so students stay on **15m / 7d**.
3. Implement backend policy for centers (recommended defaults):
   - **Idle: 30 minutes** — revoke if `now - last_used_at` exceeds idle TTL
     (refresh and/or protected routes); update `last_used_at` on real activity.
   - **Absolute: 8–12 hours** — force re-login even if the refresh JWT is still
     valid (check against session `created_at`).
4. Keep access at **15m**; enforce revoke / expiry on refresh + `CenterAuthGuard`
   (backend is source of truth).
5. Front (`sprach`): clear center localStorage on `401` /
   `CENTER_SESSION_REVOKED` / invalid refresh; do not rely on a client-only idle
   timer.
6. Document the new env vars (`.env.example`) and deploy them in Azure after
   the code ships.

### Notes

- Recommended product call: **centers = 30m idle + 12h absolute; students unchanged**.
- Idle alone without absolute still allows a long day of continuous use; absolute
  alone (short refresh) already fixes “still in tomorrow” — both together match
  admin best practice.
- A front-only idle timer is not enough; session validity must be enforced server-side.

---

## Front: show and download exam Schreiben on center marking UI

**Status:** todo  
**Area:** `sprach` center exam marking / results (backend already ships the text)

### Goal

On the marking screen, show `schreibenSubmission.text` from
`GET /api/centers/me/exam-attempts/:attemptId/result` and offer a download
(`.txt`). Export rows already include `schreibenText` for CSV.

### Why

Backend contract is live (see `docs/EXAM_SCHREIBEN_CENTER_VISIBILITY_SPEC.md`).
Without the UI, 1,000 XAF managers still cannot read the letter they must mark.

### Work required

1. Render the letter beside the points form (MANUAL and AI).
2. Download filename:
   `{sessionDate}_{lastName}_{firstName}_{studentIdShort}_schreiben.txt`.
3. Keep AI `suggestions` as a separate panel; never prefill marks.
4. Use `schreibenText` from export for bulk CSV if needed.

### Notes

- Full text always; do not truncate.
- Student released result does not include the letter payload.
