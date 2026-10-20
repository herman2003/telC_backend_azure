# Firebase push — first implementation slice

## Scope and source

Source: the user-supplied “Spec Push notifications for Lerniqo Flutter clients”
(2026-10-18). This slice implements delivery of the two existing transactional
notification kinds: EXAM_PUBLISHED and EXAM_RESULT_RELEASED. It preserves the
account inbox, account read state, quiet hours, session ownership, and one chosen
installation per dispatch. No grades or private learning details enter the push.

User decisions: use the Lerniqo Team account and production Firebase project
`lerniqo-68411`; backend branch starts at dev, frontend at develop. Without a paid
Apple Developer account, native iOS/macOS delivery stays off. iPhone/iPad can use
the installed Web App. Firebase registration alone is not a working APNs setup.

Firebase FCM transports Android and supported Web Push browsers in this slice.
The frontend checks support at runtime. Native Apple configuration is generated,
but delivery is gated until APNs and signed push capabilities are supplied.
Windows/Linux keep their account inbox; no closed-native-app push is claimed.

## Ordered plan and implementation

1. Add push endpoint, preferences and dispatch tables with an additive migration.
2. Use a PostgreSQL notification INSERT trigger as the transactional outbox:
   existing createMany writers participate without a separate network call.
3. Add JWT/device-scoped endpoint registration and preferences, encrypted provider
   addresses, rate limits, and session-revocation invalidation.
4. Start a worker inside the Nest process. Poll every 15 seconds; claim DB rows
   using SKIP LOCKED and leases. Restart/deploy never erases pending work.
5. Apply quiet hours, read-state, cancelled-exam, endpoint/session eligibility,
   expiry and retry checks. Provider-configuration errors do not delete endpoints.
6. Add FCM notification payloads with generic localized copy and opaque routing
   ids, collapse tags, and a hard expiry. Database notifications remain facts.
7. Configure FlutterFire by platform/environment. Add explicit installation opt-in,
   token refresh, logout cleanup, account-wide preferences, foreground banner,
   background OS display and typed inbox opening after authentication.
8. Verify migration/outbox/concurrency/recovery against isolated PostgreSQL;
   verify quiet hours over DST; test Flutter click queues and secret redaction.
9. Deploy backend without its service-account path, then configure the mounted
   credential file for an internal Android/Web cohort. Expand after real-device
   verification. A valid file activates real sends automatically.

## Endpoints

All require a registered learner JWT. A guest or center token cannot register.
Ownership comes from authenticated studentId/deviceId/sessionId, never request
body. Validation rejects unknown fields, including a caller-supplied owner id.

- PUT /api/me/push-endpoint — transport FCM; platform ANDROID/WEB/IOS_WEB/IOS/MACOS;
  fcmToken, firebaseProjectId, locale (de/fr/en), IANA timezone, appVersion,
  permission GRANTED, backgroundCapable true. Returns id/platform/permission only.
- DELETE /api/me/push-endpoint — invalidate current installation.
- GET /api/me/push-status — non-secret sender readiness.
- GET /api/me/notification-preferences
- PUT /api/me/notification-preferences — transactionalEnabled, timezone,
  quietStart/quietEnd (HH:mm). Defaults 21:00–08:00; equal times disable quiet hours.
- Existing inbox GET and read endpoints remain unchanged and subscription-free.

## Deployment configuration

Only three new environment variables are used, matching AfroSchool Admin:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=/run/secrets/firebase-service-account.json
FIREBASE_PROJECT_ID=lerniqo-68411
PUSH_DEBUG_LOGS=false
```

Mount the private JSON in the backend secret store/filesystem, outside Git and
Flutter. Grant only Firebase Cloud Messaging sending permissions. The project
in that JSON must match FIREBASE_PROJECT_ID. The path refers to a file available
inside the running container/server, not a file on the developer's laptop.

Apply migrations through the existing `prisma migrate deploy` deployment workflow.
The API automatically initializes Firebase and starts the worker when the file
and project are valid. This enables real sends, with no additional enable flag,
dry-run setting or separate worker command. An absent path disables delivery;
missing/invalid credentials leave the inbox/API running and log only a generic
configuration error. GET /api/me/push-status reports non-secret readiness.
Remove the path and restart/redeploy to stop delivery without deleting queued
notifications. Logs of completed dispatch IDs are opt-in via PUSH_DEBUG_LOGS=true;
errors never include credential contents or provider tokens. Logging does not
control whether notifications are delivered.

Android and Web delivery are supported. Native Apple remains disabled in code
until APNs/signing is implemented. The Web destination is https://app.lerniqo.tech.
The backend's existing TOKEN_HMAC_SECRET is reused through HKDF with separate,
push-specific encryption and lookup contexts. No extra encryption variable or
plaintext token storage is introduced. The existing secret must have at least
32 characters. These are the only three *new* variables; existing backend settings
(database, auth secrets, etc.) remain required.

Existing notifications are not backfilled. Pending work waits until an eligible
installation is available (up to its 14-day expiry). Explicit read, disabled
account preferences or cancelled exam suppress the relevant pending dispatch.
Temporary retries retain the original chosen installation, including after a
worker restart, to avoid alerting a newly active second device after an uncertain
provider acknowledgement. Permanent token failures invalidate only that endpoint;
retry then selects the next eligible device. Temporary failures use 1m, 5m, 15m, 1h delays, bounded by
expiry and five attempts. Logs use ids/error classes, never provider tokens.

Rotation of TOKEN_HMAC_SECRET also changes the derived push keys. Before rotating,
re-encrypt endpoints and recompute lookup hashes, or invalidate old endpoints and
require re-registration. Registrations from the initial, undeployed implementation
using PUSH_TOKEN_ENCRYPTION_KEY likewise need re-registration. Avoid capturing
request bodies in APM for endpoint registration. Restrict access to delivery metadata and define retention before
broad rollout; a retention purge job is a follow-up.

## Follow-up slices (not claimed as implemented here)

- Full notification catalogue, domain-event dedupe keys, learning reminders,
  daily engagement caps, activity suppression and spaced repetition/FSRS.
- Native Apple APNs key, signing/capabilities and device smoke tests.
- Native Windows WNS / Linux background agent.
- Operational dashboards, long-term delivery retention and production sign-off.
- Explicit preferred-device selection UI (current choice is most recently active,
  with deterministic ordering and no fan-out).

## Manual acceptance

Use an internal account and a real Android device. Enable device notifications
from Settings, publish an exam, close the app, then inspect the OS notification.
Tap it: bootstrap/login must finish before inbox navigation. Repeat for Web over
HTTPS with the tab closed. On iPhone/iPad install to Home Screen first; a standard
browser tab is not the same test. Verify permission denial, token rotation,
logout, cross-account switching, OS permission withdrawal, and a second device.

Force-stop, browser exit, OS battery restrictions, Focus/DND and an offline device
can defer or prevent delivery. Do not promise unconditional immediate arrival.

## Automated verification

50 tests pass across the existing inbox and new push suites. Nine exercise the
actual SQL migration and worker against an isolated local PostgreSQL schema,
including transactional rollback, concurrent claims, lease recovery, restart,
sticky retries, read suppression, expiry, cancellation and session revocation.
TypeScript compilation and targeted ESLint pass. No production migration or
actual Firebase send was performed.
