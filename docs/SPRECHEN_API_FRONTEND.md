# Sprechen (Speaking) Module — API for Frontend

**Backend base URL:** `https://api.lerniqo.tech`
**WebSocket namespace:** `https://api.lerniqo.tech/speaking-room` (Socket.IO)
**Content-Type:** `application/json`

Verified against production and a local build on 2026-08-28.

> The old `telc-speaking-api-*.azurewebsites.net` host used by the Hören and
> Schreiben docs is **dead**. Use `api.lerniqo.tech`.

---

## 0. What ships where

| Feature | Branch | Status |
|---|---|---|
| Rooms, topics, WebRTC signalling | `main` | live |
| Elena live sessions | `main` | live (merged in `2f5ebae`) |
| Lobby, partner matching, reporting | `feature/speaking-lobby` | **not merged yet** |

---

## 1. Authentication

The demo has **no login screen**. The app mints an anonymous token on first load
and uses it for everything below.

**POST** `/api/auth/guest` — no body

```json
{ "accessToken": "eyJ...", "isGuest": true, "expiresIn": 7200 }
```

Send it as `Authorization: Bearer <accessToken>` on every authenticated call.
It lasts 2 hours; mint a new one on 401. Rate-limited to 10 per IP per hour.

| Endpoint | Auth |
|---|---|
| `POST /api/speaking/rooms` | none |
| `GET /api/speaking/rooms/:roomId` | none |
| `GET /api/speaking/rooms/ice-servers` | **required** (guest token is fine) |
| `POST /api/speaking/live-token` | **required** (guest token is fine) |
| `POST /api/speaking/live-session/end` | **required** |
| `POST /api/speaking/evaluate` | **required** |
| `GET /api/speaking/teils` | **required** |
| WebSocket `/speaking-room` | none |

---

## 2. Practising with a human

### 2.1 Create a room (the host)

**POST** `/api/speaking/rooms` — body `{ "level": "B1" }` (optional, defaults to B1)

```json
{
  "roomId": "6fe4827f-...",
  "hostToken": "9c2a...",
  "expiresAt": "2026-08-28T18:00:00.000Z",
  "topic": { "id": "...", "level": "B1", "title": "Urlaub im eigenen Land", "...": "..." }
}
```

**Never put `hostToken` in a shareable URL.** Share only `roomId`. The share link
the app already builds — `/speaking-peer/join?roomId=<roomId>` — is correct.

Rate-limited to 10 rooms per IP per minute. Rooms expire after 2 hours.

### 2.2 Read a room (the guest arriving from a link)

**GET** `/api/speaking/rooms/:roomId`

```json
{
  "roomId": "...", "status": "waiting", "hasHost": true, "hasGuest": false,
  "expiresAt": "...", "topic": { "...": "..." }
}
```

404 means the room expired or ended. There is no `level` at the top level — it
lives inside `topic`.

### 2.3 ICE servers — required before any call

**GET** `/api/speaking/rooms/ice-servers` (needs the guest token)

Returns STUN **and** TURN with short-lived credentials. Pass the whole
`iceServers` array to `RTCPeerConnection`. Skipping TURN means calls fail behind
mobile carrier NAT, which is most of your users.

### 2.4 Signalling — Socket.IO namespace `/speaking-room`

Connect to `https://api.lerniqo.tech/speaking-room`.

**Client → server**

| Event | Payload |
|---|---|
| `join-room` | `{ roomId, displayName, hostToken? }` — send `hostToken` only if you created the room |
| `offer` | `{ roomId, offer }` — host only |
| `answer` | `{ roomId, answer }` — guest only |
| `ice-candidate` | `{ roomId, candidate }` |
| `shuffle-topic` | `{ roomId }` — host only |
| `leave-room` | *(no payload — the room is derived from your socket)* |

**Server → client**

| Event | Meaning |
|---|---|
| `guest-joined` `{ displayName }` | someone joined; host should send the offer now |
| `offer` / `answer` / `ice-candidate` | relayed signalling |
| `topic-changed` `{ topic }` | both peers must render this |
| `partner-left` | the guest left; the room stays open |
| `host-disconnected` | host dropped; 30-second grace period is running |
| `host-reconnected` | they came back |
| `room-ended` | over — leave the screen |
| `room-not-found` | bad or expired roomId |
| `room-full` | a guest is already there |
| `already-in-room` | you tried to join a second room on one socket |
| `unauthorized` | you sent an offer/answer for a role you do not hold |
| `no-guest-ready` | offer sent before a guest arrived |
| `server-shutting-down` | backend is restarting |

**Order that works:** `join-room` → wait for `guest-joined` (host) → host sends
`offer` → guest replies `answer` → both trickle `ice-candidate`.

---

## 3. Practising with Elena (the AI examiner)

The browser talks to **Google directly**. No audio passes through this backend.

### 3.1 Get a token

**POST** `/api/speaking/live-token`

```json
{ "teilNumber": 2, "modelltest": 1 }
```

```json
{
  "sessionId": "f2c1a0e4-...",
  "token": "auth_tokens/...",
  "model": "gemini-3.1-flash-live-preview",
  "expiresInSeconds": 600,
  "teilNumber": 2,
  "topic": { "title": "...", "description": "...", "points": ["..."] }
}
```

### 3.2 Connect — four rules that will cost you a day each if missed

1. **Use `apiVersion: 'v1alpha'`.** Ephemeral tokens do not exist on `v1beta`;
   the socket opens and then closes with no setup, which looks like a bad token.
2. **Connect within 60 seconds** of minting, and the token works **once**.
3. **Ask for the microphone BEFORE calling `/live-token`,** and create/resume the
   `AudioContext` inside the tap handler. Browsers only allow audio to start
   from a user gesture; awaiting a network call first spends it and you get
   silence with no error.
4. **Pass `model` back verbatim.** Do not hardcode it — it moves.

```js
const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });
const session = await ai.live.connect({ model, callbacks: { ... } });
```

Audio format: send **16 kHz mono PCM16, base64**, as
`{ audio: { data, mimeType: 'audio/pcm;rate=16000' } }`. Gemini returns **24 kHz
PCM** — schedule chunks on a running cursor (`nextTime = max(nextTime, ctx.currentTime)`)
or you get gaps.

Keep every scheduled `AudioBufferSourceNode` in a Set. On
`serverContent.interrupted`, stop them all, clear the Set, **and reset the
cursor to `ctx.currentTime`** — miss that last part and Elena goes silent for
seconds after every interruption.

Transcripts arrive from Gemini itself via `inputTranscription` /
`outputTranscription`. You do **not** need browser speech recognition any more.

### 3.3 Free the slot when the conversation ends

**POST** `/api/speaking/live-session/end` — `{ "sessionId": "..." }` → `204`

Not optional. Only 2 sessions can run at once; without this call the slot is
held for the full 10 minutes and blocks everyone else. Send it on hang-up, on
navigating away, and on `beforeunload`.

### 3.4 Caps and their messages

429 with a `messageKey`. Each should offer the human room as the alternative.

| messageKey | Meaning |
|---|---|
| `elenaDailyLimit` | 2 sessions per IP per day used up |
| `elenaBusyToday` | global daily budget reached |
| `elenaBusyNow` | 2 sessions already running |

### 3.5 Grade the transcript

**POST** `/api/speaking/evaluate` — `{ "teilNumber": 2, "transcript": "..." }`

Returns `evaluationText` (German, meant to be spoken via TTS), `scores`
(grammar, vocabulary, coherence, overall, 0–100), `corrections[]`
(original / corrected / explanation / error_type), `strengths`,
`areas_for_improvement`.

If the connection drops mid-session, **still send what you have.** Partial
feedback beats losing five minutes of the student's work.

---

## 4. Finding a partner (branch `feature/speaking-lobby`)

Same socket, same namespace. No second connection.

**Client → server**

| Event | Payload |
|---|---|
| `find-partner` | `{ displayName, level? }` |
| `cancel-search` | *(none)* |
| `report-partner` | `{ reason? }` — the room is derived from your socket |

`displayName` must be a first name: **1–30 characters, no digits.** A name with
digits is silently rejected and you are not queued — validate it in the UI first.

**Server → client**

| Event | Meaning |
|---|---|
| `waiting` `{ count }` | queued, nobody available yet |
| `waiting-count` `{ count }` | the count changed |
| `partner-found` `{ roomId, hostToken?, displayName }` | matched — `hostToken` present means **you are the host** |
| `search-cancelled` | you left the queue |
| `already-searching` | you sent `find-partner` twice |
| `already-in-room` | you are already in a call |
| `lobby-full` | queue at capacity |
| `partner-reported` | a report ended this call — leave the screen |

**On `partner-found`, run the normal room flow:** emit `join-room` with that
`roomId`, including `hostToken` if you received one. Everything from §2.4 then
applies unchanged.

### Two things about the waiting screen

**`count` is almost always 0, and that is correct.** Pairing happens the moment a
second person arrives, so the queue holds at most one person. Show
*"Recherche d'un partenaire…"* — **not** *"0 personnes en attente"*, which reads
as broken.

**Offer Elena after 45 seconds, without leaving the queue.** The timer is yours;
the backend does not know about it. Keep the socket queued while the offer is on
screen so a human match can still arrive, and only `cancel-search` if the student
actually accepts Elena.

### Reporting

Show a report control during every matched call. On `partner-reported`, end the
call and return to the lobby. The pair will not be matched again for the rest of
the session.

---

## 5. Quick checklist

- [ ] Mint a guest token on load; re-mint on 401
- [ ] Fetch `ice-servers` **before** creating the peer connection
- [ ] Never put `hostToken` in a URL
- [ ] Elena: mic permission → AudioContext → **then** `/live-token`
- [ ] Elena: `apiVersion: 'v1alpha'`, connect within 60 s
- [ ] Elena: always `POST /live-session/end`, including on unload
- [ ] Lobby: validate the name (no digits) before emitting
- [ ] Lobby: spinner, not a zero count
