# Elena: four changes for the app

For the Flutter team. Backend side is on `dev`; nothing here is waiting on us.

Start (4 500 FCFA/élève/mois) promises each student a Sprechen IA Light session
that lasts at most 5 minutes, closes itself when nobody is speaking, and never
runs twice at once. The backend now keeps the parts it can. **Two of the four
rules only the app can keep** — the app connects straight to Google and no
audio passes through our servers, so we cannot hear silence.

---

## 1. Sessions are now 5 minutes, not 10

`expiresInSeconds` in the `POST /api/speaking/live-token` response is now
**300**. Google enforces it; the connection will end whether or not the UI is
ready.

Read the number from the response rather than hardcoding it, show the time
remaining, and warn at about 30 seconds left so the end is not a surprise
mid-sentence.

## 2. End the session after 30 seconds of silence at the start ⬅ new

If no speech is detected in the first **30 seconds**, close the session and
call `POST /api/speaking/live-session/end`.

This is in the offer, and a student who opens Elena and walks away otherwise
burns a session and holds a slot for the full five minutes.

## 3. End the session after 60 seconds of silence mid-conversation ⬅ new

Same, once the conversation has started: **60 seconds** with no speech from the
student ends it.

Distinguish silence from a dropped connection where you can. A lost network is
not a student who stopped talking, and the two deserve different messages.

## 4. Always call `/live-session/end` ⬅ the important one

```
POST /api/speaking/live-session/end
{ "sessionId": "<the one live-token returned>" }
```

Every path, not just the happy one: hang-up, back-navigation, app backgrounded
past your timeout, crash-recovery on next launch, the two auto-closes above,
and the 5-minute expiry.

**This matters more than it used to.** A student may now hold only **one** live
session at a time. If the app does not report the end, that student is blocked
from starting another until the slot lapses — up to 5 minutes, and it will look
like a bug in your code, not ours. The call is idempotent and always returns
204, so calling it twice, or for a session already gone, is free.

---

## The new refusal

`POST /api/speaking/live-token` can now return **429** with:

```json
{ "messageKey": "elenaSessionAlreadyOpen" }
```

| | |
|---|---|
| means | **this** student already has Elena open |
| suggested copy | « Vous avez déjà une session ouverte avec Elena. Terminez-la avant d'en commencer une autre. » |
| what the UI should offer | ending the other session — **not** the human room, and **not** "try again later" |
| cost to the student | none. This refusal does not spend one of their sessions |

Do not fold it into `elenaBusyNow`. That one means somebody *else* is talking,
and sending a student away to wait for a slot they are holding themselves is
the worst possible message.

The other keys are unchanged: `elenaDailyLimit`, `elenaBusyToday`,
`elenaBusyNow`.

---

## Would help us, if it is cheap

We log how long each session actually ran, because every cost estimate for
Elena currently assumes a full 5 minutes and nobody knows whether that is true.
We measure it from our side — mint to `/end` — which is only as accurate as
rule 4 above.

If the Live SDK exposes Google's usage metadata (token counts) at the end of a
session, sending it with `/live-session/end` would replace our estimate with
the real number. **Optional**, and only if the SDK hands it to you; do not build
anything to derive it.

---

## Not changing

- The 2-sessions-per-day cap for **guests**, keyed by IP.
- The flow itself: mint a token, connect to Google directly, grade the
  transcript with `POST /api/speaking/evaluate`.
- The human Sprechen room, which is still the alternative to offer on
  `elenaDailyLimit`, `elenaBusyToday` and `elenaBusyNow`.

Full API reference: `docs/contracts/sprechen-api.md`, French version
`docs/contracts/sprechen-api-fr.md` — both updated with the new key.
