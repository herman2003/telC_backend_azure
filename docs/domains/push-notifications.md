# Spec: Push notifications for Lerniqo Flutter clients

**Written:** 2026-10-18  
**Status:** ready for implementation planning  
**Audience:** backend developer, Flutter developer, QA, product owner  
**Backend:** NestJS 11, Prisma, PostgreSQL  
**Clients:** Flutter Android, Flutter Web, Flutter Windows, Flutter macOS,
Flutter Linux; iPhone and iPad use the Web App

---

## 1. Purpose

Build a notification system that helps learners return to useful work without
spamming them. It must support Lerniqo's product promise:

> One activation code for browser, computer and phone. Progress follows the
> learner everywhere.

The notification inbox, learning state, review schedule and preferences belong
to the **learner account**. Push endpoints belong to individual app/browser
installations. A learner may therefore use Android, Web and desktop without
receiving the same engagement reminder on every device.

This specification defines:

- the backend notification architecture;
- the Flutter/backend API contract;
- supported behaviour per platform;
- all notification types and their rules;
- vocabulary and grammar spaced repetition;
- prioritisation, quiet hours, deduplication and cross-device suppression;
- security, privacy, observability, tests and rollout criteria.

This is the source of truth for notification behaviour. An implementation plan
may divide the work into smaller phases, but must not silently weaken these
rules.

---

## 2. Product outcomes

The system should increase meaningful learning actions, not merely notification
opens. The primary success events are:

1. a due vocabulary or grammar review is completed;
2. a learner starts the recommended session of the day;
3. an unfinished grammar activity is resumed and completed;
4. a learner returns after inactivity and completes an activity;
5. a learner notices a time-sensitive exam or account event.

The system must avoid:

- multiple engagement pushes on the same day;
- one push per vocabulary word or grammar question;
- notifying every device owned by the learner;
- sending a reminder after the learner completed the task elsewhere;
- exposing grades, failure status, corrections or private feedback on a lock
  screen;
- sending learning reminders when the learner cannot access the relevant
  content;
- relying on a running API process for scheduled-job durability.

---

## 3. Current backend baseline

The backend already provides:

- an account-scoped inbox at `GET /api/me/notifications`;
- `POST /api/me/notifications/:notificationId/read`;
- `POST /api/me/notifications/read` to mark all notifications read;
- transactional creation through `NotificationsService.notifyMany`;
- `EXAM_PUBLISHED` and `EXAM_RESULT_RELEASED` notification kinds;
- stable `deviceId` values in authenticated device sessions;
- completed activity data in `StudentActivity`;
- progress alerts and a deterministic session-of-the-day recommendation;
- grammar topic progress and grammar exercise attempts;
- vocabulary status (`learning` or `known`);
- exam opening, closing, publication and cancellation times;
- a WebSocket `correction_ready` event for completed writing corrections.

The backend does **not** currently have:

- a Firebase Admin or Web Push delivery provider;
- a push-endpoint registry;
- server-side notification preferences;
- a durable notification queue or scheduler;
- delivery attempts, retries, expiry or invalid-token cleanup;
- spaced-repetition scheduling data;
- notification deduplication keys;
- notification events outside exam publication/result release.

The current inbox should be extended, not replaced.

---

## 4. Non-negotiable product rules

### 4.1 Account state versus device state

- A `Notification` belongs to one student account.
- Read/opened/handled state is shared by all devices.
- Spaced-repetition state and due dates are shared by all devices.
- Notification category preferences and quiet hours are account-wide.
- OS notification permission and provider address are installation-specific.
- Completing an activity on any device suppresses stale reminders everywhere.

### 4.2 Delivery volume

- At most **one engagement push per learner per local calendar day**.
- Transactional notifications do not consume the engagement allowance.
- Several due review cards produce one aggregated `REVIEW_DUE` notification.
- A failed attempt to deliver is not permission to send a different engagement
  message on the same day.
- In-app inbox creation does not count as a push. Several useful inbox items may
  exist even when only one receives remote delivery.

### 4.3 Quiet hours

- Default quiet hours are **21:00 through 08:00** in the learner's IANA
  timezone.
- Engagement pushes must always respect quiet hours.
- Ordinary transactional pushes created during quiet hours remain visible in
  the inbox immediately but wait until quiet hours end for remote delivery.
- `EXAM_STARTING_SOON` may bypass quiet hours only when the exam opens within
  30 minutes. This exception is necessary because delaying it would make the
  message useless.
- Operating-system Focus or Do Not Disturb remains authoritative.
- If no valid timezone is known, use `Europe/Berlin` temporarily and record a
  metric so the missing timezone can be corrected. Do not calculate local days
  with a fixed UTC offset.

### 4.4 Privacy

- Push titles and bodies must not include an exam score, pass/fail result,
  writing correction, teacher comment, or other sensitive learning detail.
- Push data may contain opaque IDs and routing facts required to open the app.
- Full details are loaded from the authenticated API after the learner opens
  the app.
- The client renders translated copy. The database stores facts, not complete
  human-language sentences.

### 4.5 Access

- The inbox remains available even if a subscription or centre access lapses.
- Transactional messages about an already-purchased exam/result remain visible.
- Engagement reminders for inaccessible learning content must be suppressed.
- A deep link must never bypass the existing subscription, entitlement, CEFR
  level or exam-participant checks.

---

## 5. Supported platforms

| Lerniqo client                 | V1 remote delivery                     | Required client work                                                                             | V1 fallback              |
| ------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------ |
| Android native                 | FCM                                    | `firebase_messaging`, permission flow, token refresh, foreground/background handlers, deep links | Account inbox            |
| Web App on Chrome/Edge/Firefox | standards-based Web Push               | service worker, Push API subscription, notification click routing                                | Account inbox while open |
| iPhone/iPad Web App            | standards-based Web Push               | install-to-Home-Screen guidance; ask permission only after a learner action                      | Account inbox while open |
| Windows native                 | Not required for V1 when app is closed | synchronize inbox; foreground/local system notification                                          | Account inbox            |
| Linux native                   | Not required for V1 when app is closed | synchronize inbox; foreground/local system notification                                          | Account inbox            |
| macOS native                   | Not required for V1 when app is closed | synchronize inbox; foreground/local system notification                                          | Account inbox            |

Notes:

- iPhone/iPad are not a native Lerniqo target in this release. They use the
  Web App. Web Push on iOS/iPadOS requires a Home Screen web app and a permission
  request made after direct user interaction.
- Closed-app Windows, Linux and macOS push requires platform-specific native
  work and is a later phase. Do not describe it as supported in V1.
- Provider support must be hidden behind a backend transport interface. The
  notification rule engine must not know whether the endpoint uses FCM or Web
  Push.

---

## 6. Architecture decision

### 6.1 Required flow

```text
Domain event or scheduled learning decision
                  |
                  v
       policy and suppression checks
                  |
                  v
   account Notification + durable dispatch row
        (same database transaction)
                  |
                  v
        background dispatch worker
                  |
                  v
       choose one eligible endpoint
                  |
          +-------+-------+
          |               |
          v               v
         FCM          Web Push
          |               |
          +-------+-------+
                  v
      Flutter opens a typed deep link
                  |
                  v
 account read/open state and domain completion
```

### 6.2 Durable database queue

Use PostgreSQL as the durable source for notification dispatch work.

Reasoning:

- a notification must be committed atomically with the event it announces;
- the repository already uses Prisma/PostgreSQL transactions;
- Valkey is currently optional and degrades to instance-local behaviour;
- a process restart must not lose a scheduled or pending push;
- multiple API replicas must not send the same job concurrently.

The worker may run as a separate Nest process or as a scheduler inside the
application, but the **work must live in the database**. A worker must claim
rows atomically, for example with a status transition guarded by a conditional
update or PostgreSQL row locking. An in-memory `setTimeout`, `setInterval`,
`p-limit` queue or JavaScript array is not an acceptable source of truth.

### 6.3 Transactional outbox invariant

When a domain event and its notification must agree, write both in the same
database transaction. Examples:

- publish exam + create `EXAM_PUBLISHED` notification;
- release result + create `EXAM_RESULT_RELEASED` notification;
- complete writing correction + create `WRITING_CORRECTION_READY`;
- grant entitlement + create `ENTITLEMENT_GRANTED`.

The transaction must not call FCM or Web Push. Network delivery happens after
commit through the durable worker.

---

## 7. Data model requirements

Names may be adjusted to repository conventions, but the following concepts and
constraints are required.

### 7.1 `PushEndpoint`

One row represents one push-capable app/browser installation.

Required fields:

| Field                | Meaning                                                                      |
| -------------------- | ---------------------------------------------------------------------------- |
| `id`                 | server UUID                                                                  |
| `student_id`         | owning learner                                                               |
| `device_id`          | stable Flutter/browser installation ID already used by auth                  |
| `transport`          | `FCM` or `WEB_PUSH`                                                          |
| `platform`           | `ANDROID`, `WEB`, `IOS_WEB`, `WINDOWS`, `MACOS`, `LINUX`                     |
| `target_ciphertext`  | encrypted FCM target or Web Push subscription                                |
| `target_hash`        | non-reversible value used for equality/uniqueness without logging the target |
| `locale`             | client locale such as `de`, `fr`, `en`                                       |
| `timezone`           | IANA timezone such as `Europe/Berlin`                                        |
| `app_version`        | diagnostics and compatibility                                                |
| `permission`         | `GRANTED`, `DENIED`, `PROMPT`, `UNSUPPORTED`                                 |
| `background_capable` | whether closed/background remote delivery is supported                       |
| `preferred`          | explicit preferred endpoint, at most one per learner                         |
| `last_active_at`     | last confirmed app activity for endpoint selection                           |
| `invalidated_at`     | permanent provider failure, logout or revocation                             |
| timestamps           | created and updated times                                                    |

Constraints:

- unique `(student_id, device_id, transport)`;
- a provider target must never be returned by a read API;
- an upsert replaces a rotated target and clears an earlier invalidation;
- logout or device-session revocation disables the matching endpoint;
- permanent provider errors invalidate the endpoint instead of retrying it;
- account deletion cascades to endpoints.

Do not put push targets directly on `DeviceSession`. Authentication sessions and
provider registrations have different rotation and expiry lifecycles.

### 7.2 `NotificationPreference`

One row per student, with safe defaults when no row exists.

Required settings:

- `push_enabled`;
- `exam_enabled`;
- `review_enabled`;
- `grammar_enabled`;
- `vocabulary_enabled`;
- `daily_learning_enabled`;
- `progress_enabled`;
- `quiet_start_local`, default `21:00`;
- `quiet_end_local`, default `08:00`;
- `timezone`;
- optional `preferred_endpoint_id`.

Transactional items are always written to the inbox. Preferences decide remote
delivery, not whether important account history exists.

### 7.3 Extend `Notification`

Keep the existing `student_id`, `kind`, `payload`, `created_at` and `read_at`.
Add or represent:

- `category`: `TRANSACTIONAL`, `REVIEW`, `LEARNING`, `PROGRESS`;
- `dedupe_key`;
- `deep_link` or a typed action from which the server/client derives it;
- `scheduled_for`;
- `expires_at`;
- `opened_at`;
- `handled_at`;
- `cancelled_at` and optional cancellation reason;
- payload schema version.

Use a unique constraint on `(student_id, dedupe_key)`. A retry of a domain
operation must return/use the existing notification, not create another one.

`read_at`, `opened_at` and `handled_at` are different:

- **read:** learner saw the inbox item;
- **opened:** learner followed the notification/deep link;
- **handled:** the relevant domain action was completed or became unnecessary.

Domain services set `handled_at`; the client must not be allowed to claim that a
review or exam was completed by calling a generic notification endpoint.

### 7.4 Durable dispatch and attempts

Persist enough state to support:

- scheduled time;
- pending, claimed, sent, suppressed, cancelled and failed states;
- attempt count and next retry time;
- selected endpoint;
- provider message ID;
- normalized error code;
- sent time;
- suppression/cancellation reason;
- a history of attempted endpoints if fallback occurs.

The exact split between `NotificationDispatch` and `NotificationDeliveryAttempt`
is an implementation choice. It must still be possible to answer:

1. Was an account notification created?
2. Was remote delivery allowed?
3. Which endpoint was selected?
4. What did the provider return?
5. Was the target invalidated?
6. Why was a message suppressed or cancelled?

### 7.5 Spaced-repetition tables

Use a generic card so vocabulary and grammar share one scheduling engine.

`ReviewCard` requires:

- `student_id`;
- `content_type`: `VOCAB_ENTRY` or `GRAMMAR_TOPIC`;
- `content_id`;
- `state` required by the chosen FSRS implementation;
- `due_at`;
- `stability` and `difficulty`;
- repetitions and lapses;
- last review time;
- suspended/deleted time;
- unique `(student_id, content_type, content_id)`.

`ReviewLog` is append-only and requires:

- card and student IDs;
- rating: `AGAIN`, `HARD`, `GOOD`, `EASY`;
- review timestamp;
- previous and resulting schedule values;
- client request id for idempotency;
- optional response correctness facts, but no translated notification copy.

---

## 8. API contract

All routes require a learner JWT. Ownership comes from the JWT, never from a
client-supplied `studentId`.

### 8.1 Register or refresh the current endpoint

`PUT /api/me/push-endpoint`

The backend derives the authenticated `deviceId` from the access token.

FCM example:

```json
{
  "transport": "FCM",
  "platform": "ANDROID",
  "fcmToken": "provider-secret-value",
  "locale": "de",
  "timezone": "Europe/Berlin",
  "appVersion": "1.0.0",
  "permission": "GRANTED",
  "backgroundCapable": true
}
```

Web Push example:

```json
{
  "transport": "WEB_PUSH",
  "platform": "IOS_WEB",
  "subscription": {
    "endpoint": "https://push-provider.example/...",
    "expirationTime": null,
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "locale": "fr",
  "timezone": "Africa/Douala",
  "appVersion": "1.0.0-web",
  "permission": "GRANTED",
  "backgroundCapable": true
}
```

Rules:

- validate allowed platforms and the transport-specific union strictly;
- limit target and subscription sizes;
- upsert by current student/device/transport;
- never log the token, subscription endpoint or key material;
- rate-limit repeated registration attempts;
- update `last_active_at`, locale and timezone;
- return endpoint metadata, never the stored provider target.

### 8.2 Disable the current endpoint

`DELETE /api/me/push-endpoint`

- Disable endpoints belonging to the current authenticated installation.
- Idempotent: a second call succeeds without leaking whether a target existed.
- Flutter calls it before logout when possible.
- Server-side logout/session revocation must also disable it; correctness cannot
  depend on a well-behaved client.

### 8.3 Preferences

`GET /api/me/notification-preferences`

`PATCH /api/me/notification-preferences`

The PATCH is partial and validates:

- real IANA timezone;
- valid `HH:mm` local quiet times;
- preferred endpoint ownership;
- booleans only, without string coercion surprises.

The Flutter settings switch that was previously local-only must read and write
this server resource. Device OS permission is shown separately so the UI does
not claim notifications are enabled when the OS denied them.

### 8.4 Inbox

Keep the existing endpoints and extend list items with:

- `category`;
- typed `deepLink`/action;
- `scheduledFor` and `expiresAt` where useful;
- `openedAt` and `handledAt`;
- payload schema version.

Add:

`POST /api/me/notifications/:notificationId/opened`

- account-scoped and idempotent;
- also marks the item read;
- records how the app was opened, if supplied from a closed enum such as
  `PUSH`, `INBOX`, `BANNER`;
- does not mark the underlying task completed.

### 8.5 Reviews

`GET /api/me/reviews/due?limit=20`

Returns due cards ordered by due time, together with the minimum content facts
needed to render the session.

`POST /api/me/reviews/:cardId/rating`

```json
{
  "rating": "GOOD",
  "requestId": "client-generated-uuid",
  "reviewedAt": "2026-10-18T09:30:00.000Z"
}
```

Rules:

- `requestId` makes offline retries idempotent;
- server time is authoritative if `reviewedAt` is implausible;
- the backend computes and stores the next due date;
- a rating updates the card and writes a log in one transaction;
- completing the final due card handles/cancels today's `REVIEW_DUE` item;
- a rating received from any device immediately affects all devices.

---

## 9. Spaced-repetition behaviour

Use FSRS with a default desired retention of **90%**.

### 9.1 Card granularity

- One vocabulary entry equals one review card.
- One grammar topic equals one review card.
- Do not create a notification/card for every grammar exercise.
- Exercise correctness and lesson progress provide evidence for the topic card.

### 9.2 Ratings

| Rating  | Learner meaning                             |
| ------- | ------------------------------------------- |
| `AGAIN` | I did not remember it / my answer was wrong |
| `HARD`  | I remembered with substantial effort        |
| `GOOD`  | I remembered correctly with normal effort   |
| `EASY`  | I remembered immediately and confidently    |

The Flutter UI must use these four meanings consistently for vocabulary and
grammar. The server owns interval calculation; clients must not invent their
own due dates.

### 9.3 Creating cards

- Create/activate a vocabulary card when an entry enters `learning`.
- A vocabulary entry marked `known` remains reviewable unless the learner
  explicitly suspends it; “known” is not permanent memory.
- Create/activate a grammar card after lesson completion or the first practice
  attempt for that topic.
- Suspend a card if its content is removed or becomes inaccessible.
- Re-activate without losing history when access returns.

### 9.4 Existing data migration

Do not make every existing vocabulary item due at once.

- Backfill existing `learning` entries across the next seven local days using a
  deterministic student/content hash.
- Backfill existing `known` entries across the next fourteen local days.
- Create grammar cards only for topics with existing progress/attempts and
  stagger them across seven days.
- Make the migration idempotent and report counts.

### 9.5 Review push aggregation

`REVIEW_DUE` payload contains counts, not individual answers or word meanings:

```json
{
  "totalDue": 12,
  "vocabularyDue": 9,
  "grammarDue": 3,
  "oldestDueAt": "2026-10-17T08:00:00.000Z"
}
```

One review notification is eligible per local day. Completing reviews on Web
must cancel an unsent Android dispatch and vice versa.

---

## 10. Notification catalogue

### 10.1 Transactional notifications

Transactional notifications do not consume the one-per-day engagement limit.
They still respect category preferences and quiet hours unless explicitly
stated.

| Kind                       | Trigger                                             | Dedupe key                                         | Push expiry        | Deep link / suppression                                                                                           |
| -------------------------- | --------------------------------------------------- | -------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `EXAM_PUBLISHED`           | centre publishes an exam with this learner admitted | `exam-published:{sessionId}`                       | exam close time    | exam detail; cancel push if session cancelled or learner removed                                                  |
| `EXAM_STARTING_SOON`       | 24 hours and 30 minutes before opening              | `exam-start:{sessionId}:{offsetMinutes}`           | exam opening time  | exam detail; suppress if cancelled, removed, already started/completed; 30-minute reminder may bypass quiet hours |
| `EXAM_RESULT_RELEASED`     | result or corrected re-release becomes visible      | `exam-result:{sessionId}:{releaseVersion}`         | 30 days            | result screen; payload and lock screen must not reveal score/pass/fail                                            |
| `WRITING_CORRECTION_READY` | asynchronous correction commits successfully        | `writing-ready:{attemptId}`                        | 14 days            | writing result; suppress if attempt erased; do not include correction/score in push copy                          |
| `ENTITLEMENT_GRANTED`      | usable learning entitlement becomes active          | `entitlement-granted:{entitlementId}`              | 30 days            | entitlement/content home                                                                                          |
| `ENTITLEMENT_EXPIRING`     | configured threshold before expiry                  | `entitlement-expiring:{entitlementId}:{threshold}` | entitlement expiry | account/access screen; do not send after renewal                                                                  |
| `ACCESS_RESTORED`          | previously blocked learning access becomes usable   | `access-restored:{accessVersion}`                  | 14 days            | home/recommended session                                                                                          |

For a legitimate exam result re-release, increment/use a release version. The
learner should be told again because the result changed.

### 10.2 Engagement notifications

All rows below compete for the single daily engagement slot.

| Priority | Kind                     | Eligibility                                                   | Dedupe key                               | Deep link                        |
| -------: | ------------------------ | ------------------------------------------------------------- | ---------------------------------------- | -------------------------------- |
|        1 | `REVIEW_DUE`             | at least one accessible card is due                           | `review-due:{localDate}`                 | aggregated review session        |
|        2 | `GRAMMAR_CONTINUE`       | topic started but unfinished, unchanged for at least 24 hours | `grammar-continue:{topicId}:{localDate}` | exact grammar topic/exercise     |
|        3 | `VOCAB_WEEK_READY`       | current weekly pack is available and not opened/studied       | `vocab-week:{isoYearWeek}`               | weekly vocabulary pack           |
|        4 | `GRAMMAR_DAILY_READY`    | today's grammar item is accessible and incomplete             | `grammar-daily:{localDate}`              | grammar of the day               |
|        5 | `DAILY_SESSION_REMINDER` | no higher candidate; recommended session remains incomplete   | `daily-session:{localDate}`              | typed session-of-day destination |
|        6 | `RETURN_TO_LEARNING`     | no completed activity for 7, 14 or 30 days                    | `return-learning:{inactivityStage}`      | home/recommended session         |
|        7 | `WEEKLY_PROGRESS`        | weekly summary is meaningful and no higher candidate that day | `weekly-progress:{isoYearWeek}`          | progress dashboard               |

`HABIT_MILESTONE` is created as an inbox/in-app celebration when a milestone is
earned. Do not send a redundant remote push while the learner is already using
the app. Remote delivery is allowed only for milestones completed
asynchronously.

### 10.3 Re-engagement stages

- First `RETURN_TO_LEARNING`: after 7 full days without completed activity.
- Second: after 14 full days.
- Third: after 30 full days.
- Send no additional inactivity pushes until new completed activity resets the
  sequence.
- Opening the app without completing work does not reset learning inactivity,
  but may delay the next reminder by 24 hours to avoid immediate repetition.

### 10.4 Weekly progress eligibility

Send only when:

- the learner completed at least two activities during the measured week; and
- there is a useful fact such as sessions completed, reviews completed or a
  readiness change.

Do not send a negative or shaming message. Never put detailed scores on the
lock screen.

---

## 11. Daily selection algorithm

Run selection in the learner's local timezone near their configured/default
reminder time.

For each learner:

1. Stop if global push or all engagement categories are disabled.
2. Stop if current local time is inside quiet hours.
3. Stop if an engagement dispatch was already created for the local date.
4. Stop if no valid push-capable endpoint exists. Inbox content may still be
   created where independently useful.
5. Stop if learning access is blocked for every candidate.
6. Load candidates using current account state.
7. Remove candidates already completed, handled, expired or inaccessible.
8. Pick the highest-priority remaining candidate from section 10.2.
9. Create one account notification and one durable dispatch atomically.
10. Re-check suppression conditions immediately before provider send.

Use a unique daily key/constraint so two workers cannot both allocate the daily
engagement slot.

The existing session-of-day algorithm remains authoritative for the
`DAILY_SESSION_REMINDER`; notification code must not implement a competing
recommendation algorithm.

---

## 12. Endpoint selection and cross-device behaviour

### 12.1 Eligible endpoints

An endpoint is eligible only when:

- it belongs to the student;
- it is not invalidated;
- permission is `GRANTED`;
- it reports background capability for remote push;
- its matching device session has not been revoked, unless product explicitly
  supports logged-out public notifications later;
- it was active recently enough to be credible (default: 90 days).

### 12.2 Selection order

1. Explicit preferred eligible endpoint.
2. Most recently active eligible endpoint.
3. Deterministic tie-breaker by endpoint ID.

Send to **one endpoint**, not all endpoints.

If delivery fails permanently because that endpoint is invalid/unregistered:

1. invalidate it;
2. select the next eligible endpoint;
3. retry the same notification once through that endpoint;
4. never fan out to multiple endpoints simultaneously.

Temporary provider errors retry the same endpoint with backoff.

### 12.3 Foreground suppression

If the learner is actively using Lerniqo on any device:

- still create the account inbox item where appropriate;
- prefer an in-app banner over a remote push for non-urgent engagement;
- do not send a second remote alert for an action just completed in that
  foreground session.

Presence is an optimisation, not a correctness dependency. If presence is
unknown, the daily cap and domain suppression rules still prevent spam.

---

## 13. Payload and deep-link contract

### 13.1 Versioned envelope

Provider data should use a small, versioned envelope:

```json
{
  "schemaVersion": "1",
  "notificationId": "uuid",
  "kind": "REVIEW_DUE",
  "action": "OPEN_REVIEW_QUEUE"
}
```

The provider payload should not be the source of truth. After opening, Flutter
fetches the authenticated notification/domain resource.

### 13.2 Typed actions

Use a closed action set, for example:

- `OPEN_NOTIFICATION_INBOX`
- `OPEN_EXAM_SESSION`
- `OPEN_EXAM_RESULT`
- `OPEN_WRITING_ATTEMPT`
- `OPEN_REVIEW_QUEUE`
- `OPEN_VOCAB_WEEK`
- `OPEN_GRAMMAR_TOPIC`
- `OPEN_GRAMMAR_DAILY`
- `OPEN_SESSION_OF_DAY`
- `OPEN_PROGRESS`
- `OPEN_ACCESS`

Do not accept an arbitrary client-provided URL. Backend and Flutter map typed
actions to known routes. Unknown schema versions/actions open the notification
inbox safely.

### 13.3 Localisation

- Backend stores `kind` plus structured facts.
- Flutter owns user-facing strings for `de`, `fr` and `en`.
- Copy may be changed without migrating database rows.
- Missing translation falls back to the application's established fallback
  locale and records a client diagnostic.
- Keep title/body short enough for a lock screen; do not rely on the full body
  being visible.

---

## 14. Flutter client requirements

### 14.1 Common requirements

Every Flutter surface must:

- keep using the stable installation `deviceId` used by authentication;
- load the server notification preferences after login;
- synchronize the account inbox;
- mark notifications opened/read idempotently;
- map typed actions to guarded routes;
- refresh the target when the provider rotates it;
- report locale, IANA timezone, app version, permission and capability;
- disable the endpoint on logout when possible;
- tolerate duplicate provider delivery by deduplicating on `notificationId`;
- never calculate a spaced-repetition due date locally;
- support offline review submission with an idempotent `requestId`.

### 14.2 Permission UX

- Do not request notification permission on first launch.
- Explain the benefit first, such as due review and exam reminders.
- Request permission after an explicit learner action.
- If denied, keep the inbox usable and show how to enable permission in OS or
  browser settings.
- The in-app preference must not claim remote push is active when OS permission
  is denied.

### 14.3 Android

- Configure Firebase Messaging and notification channels.
- Subscribe to token refresh and upsert it immediately.
- Implement terminated, background and foreground message handling.
- Use normal priority for ordinary learning reminders.
- Reserve high priority for truly time-sensitive exam reminders; do not use it
  to improve marketing/engagement delivery.

### 14.4 Web and iPhone/iPad

- Register a production service worker.
- Use a standards-based Web Push subscription.
- Handle notification clicks and focus/reuse an existing Lerniqo tab when
  possible.
- On iPhone/iPad, show installation guidance before offering push permission;
  push is unavailable until the Web App is added to the Home Screen.
- Permission must follow a direct tap/click.

### 14.5 Desktop

- Windows, Linux and macOS must show the synchronized account inbox.
- They may show a local system notification while the process is running.
- They must report `backgroundCapable: false` until closed-app delivery is
  actually implemented and verified.
- Do not keep an invisible always-running helper merely to simulate push in V1.

---

## 15. Worker behaviour and retries

Before every send, the worker re-checks:

- dispatch not already sent/cancelled/expired;
- notification not handled/cancelled;
- category and global preferences still enabled;
- current quiet-hours rule;
- relevant domain item still exists and is accessible;
- learner has not completed the action on another device;
- selected endpoint remains eligible.

Suggested retry schedule for temporary provider failures:

1. 1 minute;
2. 5 minutes;
3. 15 minutes;
4. 1 hour;
5. then fail, or stop earlier when the message expires.

Rules:

- never retry beyond `expires_at`;
- use provider guidance such as `Retry-After` when available;
- permanent invalid-target errors immediately invalidate the endpoint;
- authentication/configuration failures alert operators and must not invalidate
  every learner endpoint;
- a worker crash after provider acceptance may create at-least-once delivery.
  Flutter therefore deduplicates by notification ID;
- claim leases must expire so another worker can recover abandoned work.

Suggested expiries:

- exam starting reminder: exam opening time;
- daily engagement: end of that local day or start of quiet hours, whichever
  comes first;
- review reminder: end of local day;
- grammar/vocabulary daily content: end of local day/week as appropriate;
- result/correction ready: 14–30 days;
- entitlement expiry: entitlement expiry time.

---

## 16. Security and privacy requirements

- Treat FCM targets and Web Push subscriptions as secrets.
- Encrypt provider targets at rest where application-level encryption is
  available; keep encryption keys outside the database.
- Redact provider targets and Web Push key material from logs, exceptions,
  traces and analytics.
- Never return another endpoint's existence or metadata across accounts.
- Strictly validate all endpoint registration DTOs and payload size.
- Rate-limit endpoint upserts and preference writes.
- Derive student/device ownership from verified authentication claims.
- Disable endpoints on logout, session revocation and account deletion.
- Do not include access tokens, refresh tokens, email addresses, phone numbers,
  answers, scores or feedback in push payloads.
- Do not let notification deep links weaken existing authorization.
- Record preference changes for support diagnostics without storing sensitive
  provider targets in the audit event.
- Define retention for sent delivery attempts and purge old operational data.
  Account notifications may follow the product's inbox retention separately.

---

## 17. Observability

Emit structured metrics/events for:

- notification candidates evaluated;
- account notifications created;
- suppression by reason;
- dispatch jobs pending/claimed/sent/expired/failed;
- retry count and age of oldest pending job;
- endpoints registered, denied and invalidated;
- provider error class;
- notification opened;
- target action completed after notification;
- daily engagement cap prevented duplicate;
- missing/invalid timezone;
- review cards due and completed.

Useful suppression reasons include:

- `PREFERENCE_DISABLED`
- `QUIET_HOURS`
- `DAILY_CAP_REACHED`
- `NO_ELIGIBLE_ENDPOINT`
- `ALREADY_COMPLETED`
- `CONTENT_INACCESSIBLE`
- `EXPIRED`
- `EXAM_CANCELLED`
- `FOREGROUND_ACTIVE`

Alerts should cover:

- oldest pending dispatch beyond its expected latency;
- sudden provider failure rate increase;
- provider authentication failure;
- scheduler/worker heartbeat missing;
- rapid endpoint invalidation spike.

Product reporting should prioritize completion after a notification over raw
open rate. A high open rate with no completed learning is not success.

---

## 18. Testing requirements

### 18.1 Unit tests

Cover at minimum:

- candidate priority order;
- one engagement push per local date;
- quiet hours across ordinary days and DST transitions;
- 30-minute exam reminder quiet-hours exception;
- all suppression conditions;
- endpoint selection and deterministic fallback;
- permanent versus temporary provider errors;
- dedupe-key generation;
- expiry and retry policy;
- notification payload validation by kind;
- FSRS transitions for all four ratings;
- review aggregation counts;
- re-engagement stages at 7, 14 and 30 days.

### 18.2 Integration tests

Cover at minimum:

- domain event and notification commit/rollback together;
- two workers cannot claim/send the same dispatch;
- retry survives application restart;
- notification creation retry does not duplicate;
- endpoint registration is scoped to the authenticated student/device;
- logout and device revocation disable matching endpoints;
- activity on Web suppresses an unsent Android reminder;
- exam cancellation removes pending reminders;
- result release payload contains no result details;
- writing correction produces inbox + dispatch exactly once;
- preference update affects all devices;
- existing inbox endpoints remain backward compatible;
- review rating offline retry is idempotent.

### 18.3 Flutter tests

Cover at minimum:

- permission granted, denied and unsupported flows;
- token/subscription rotation;
- foreground, background and terminated Android handling;
- Web service-worker receipt and click;
- unknown action/schema version falls back to inbox;
- deep link waits for authentication/bootstrap before navigation;
- duplicate provider delivery appears once;
- logout disables endpoint and clears local sensitive state;
- server preference and OS permission are represented separately;
- offline review rating retries once without duplicating history.

### 18.4 Manual device matrix

Verify with real devices/browsers:

- Android 12 and Android 13+ permission behaviour;
- Chrome and Edge Web;
- Firefox Web;
- Safari iPhone/iPad Home Screen Web App;
- denied permission followed by enabling it in settings;
- two devices on the same account;
- completion on one device before a scheduled send to another;
- Windows/macOS/Linux inbox fallback.

Provider consoles alone are not acceptance tests. Test through the backend
worker and production-shaped client builds.

---

## 19. Rollout

Use independent feature flags/kill switches for:

- provider delivery globally;
- transactional push;
- engagement push;
- spaced-repetition scheduling;
- each new notification kind;
- Android and Web delivery separately.

Recommended release order:

1. Schema, typed contracts and inbox compatibility.
2. Endpoint/preference APIs with no sends.
3. Worker and provider adapters in dry-run mode.
4. Internal Android devices: transactional exam and writing events.
5. Small Android cohort.
6. Web Push and iPhone/iPad Home Screen verification.
7. Spaced-repetition API without reminders.
8. `REVIEW_DUE` for a small cohort.
9. Remaining engagement selector candidates.
10. Broader rollout after delivery, opt-out and learning-completion metrics are
    healthy.

When push is disabled or unavailable, the account inbox must continue working.
The kill switch must stop new provider sends without deleting notification or
review data.

---

## 20. Developer deliverables

### Backend

- additive Prisma migration(s);
- push endpoint and preference APIs with Swagger DTOs;
- typed notification-kind payload map with runtime validation;
- durable dispatch worker and provider interface;
- FCM adapter and standards Web Push adapter;
- notification rule/suppression service;
- domain-event integrations;
- spaced-repetition service and endpoints;
- retry, invalid-target cleanup and retention job;
- structured metrics/logging without secrets;
- unit and integration tests;
- documented environment variables and key rotation procedure.

### Flutter

- shared notification repository and settings state;
- Android FCM setup and handlers;
- Web service worker and subscription flow;
- Home Screen guidance for iPhone/iPad;
- locale/timezone/capability registration;
- token refresh and logout cleanup;
- localized copy for every notification kind;
- typed deep-link router;
- synchronized inbox/read/open state;
- review queue and four-rating UI;
- offline idempotent review submissions;
- platform tests and release configuration.

### QA/product

- approve `de`, `fr` and `en` copy;
- verify lock-screen privacy;
- validate quiet hours and timezones;
- validate the one-engagement-per-day rule with multiple devices;
- validate each suppression rule;
- sign off Android and Web separately.

---

## 21. Acceptance criteria

### Architecture and reliability

- [ ] Notification/account state is shared across devices.
- [ ] Push targets are stored separately from authentication sessions.
- [ ] Domain event and notification are atomic where required.
- [ ] Pending dispatch survives restart/deployment.
- [ ] Multiple workers cannot intentionally send the same dispatch.
- [ ] Temporary provider failures retry; permanent invalid targets are disabled.
- [ ] No retry occurs after message expiry.

### Rules and safety

- [ ] A learner receives at most one engagement push per local day.
- [ ] Default quiet hours are 21:00–08:00 local.
- [ ] Only the 30-minute exam reminder may bypass quiet hours.
- [ ] Completion on any device cancels stale pending reminders.
- [ ] Only one preferred/best endpoint is targeted at a time.
- [ ] Learning reminders are suppressed when content is inaccessible.
- [ ] No score, pass/fail verdict, correction or private feedback appears in a
      provider payload or lock-screen copy.

### Reviews

- [ ] Vocabulary entries and grammar topics use account-wide FSRS cards.
- [ ] Desired retention defaults to 90%.
- [ ] `AGAIN`, `HARD`, `GOOD`, `EASY` produce server-calculated schedules.
- [ ] Existing progress is staggered during backfill rather than all becoming
      due immediately.
- [ ] One aggregated review reminder represents all due cards.
- [ ] Offline rating retries do not duplicate a review.

### Platforms

- [ ] Android receives and opens FCM messages in foreground/background/closed
      states supported by the OS.
- [ ] Web receives and opens standards-based Web Push messages.
- [ ] iPhone/iPad UI explains Home Screen installation before permission.
- [ ] Windows, macOS and Linux provide the synchronized inbox without claiming
      unsupported closed-app push.
- [ ] Every client falls back safely to the inbox for an unknown action.

### Operations

- [ ] Provider credentials and targets never appear in logs.
- [ ] Metrics explain created, sent, suppressed, expired and failed messages.
- [ ] Operators can disable all provider sends immediately.
- [ ] Notification-focused unit/integration suites and real-device smoke tests
      pass before broad rollout.

---

## 22. Explicitly out of V1

- native iPhone/iPad application;
- closed-app Windows push through WNS;
- closed-app Linux push through a background helper;
- native macOS/APNs delivery;
- machine-learning selection or send-time optimisation;
- notification advertisements or centre-authored broadcast campaigns;
- WhatsApp/SMS/email engagement reminders;
- one notification per vocabulary word or grammar exercise;
- storing translated push sentences in PostgreSQL;
- allowing arbitrary URL deep links.

These may be added later without changing the account-notification model or the
provider transport boundary.

---

## 23. External prerequisites

Before provider delivery can be enabled, the implementation owner needs:

- access to the Lerniqo Firebase project and Android application configuration;
- server credentials for FCM kept in the deployment secret store;
- VAPID keys and an approved Web Push library/provider setup;
- access to the Flutter repository and its Android/Web release configuration;
- confirmation that production runs a durable worker process or permits the
  application to poll the database queue safely;
- final translated copy approved for `de`, `fr` and `en`;
- privacy/retention approval for provider endpoint data and delivery logs.

Missing provider credentials must disable delivery clearly at startup or health
reporting; they must not silently discard dispatch work.

---

## 24. Reference documentation

- Firebase, server environment and credential requirements:
  <https://firebase.google.com/docs/cloud-messaging/server-environment>
- Firebase Messaging in Flutter:
  <https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages>
- Firebase Flutter registration and token refresh:
  <https://firebase.google.com/docs/cloud-messaging/flutter/get-started>
- WebKit, Web Push for Home Screen Web Apps on iPhone/iPad:
  <https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/>

---

## 25. Handoff instruction

The implementation developer should first produce an ordered, thin-slice plan
from this specification. The plan must identify migrations, API changes,
backend worker deployment, Flutter changes, tests and rollout flags. Any change
to the non-negotiable rules in sections 4, 9, 10, 11 or 12 requires product
approval and an update to this document before implementation.
