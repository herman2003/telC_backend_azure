# How to set up a TURN server (start to finish)

A practical runbook for the Sprechen Room. **Preferred path: Cloudflare
Realtime TURN** (managed). Self-hosted coturn on a DigitalOcean droplet remains
documented below as rollback.

---

## 0. The mental model (read this first)

A video/voice call in the browser uses **WebRTC**, which has two separate layers:

1. **Signaling** — the two browsers exchange "offer / answer / ICE candidates"
   through your backend (Socket.IO). Your server is just a messenger here.
2. **Media** — the actual audio/video flows **directly browser-to-browser**,
   not through your backend.

For the media to connect, each browser must find a network path to the other.
That's where **STUN** and **TURN** come in:

| | STUN | TURN |
|---|---|---|
| Job | "What's my public IP?" (helps punch through simple NAT) | **Relays** the media when a direct path is impossible |
| Cost | Free | Relayed GB (Cloudflare) or your VM bandwidth (coturn) |
| Enough when | Home Wi-Fi, friendly NAT | 4G, corporate, strict NAT, different networks |

**Symptom that you need TURN:** in the browser the connection goes
`iceConnectionState: checking → disconnected` and `connectionState: failed`.
Signaling looks perfect in your backend logs, but the call never connects.
That means: no relay path. **You need a TURN server.**

---

## 1. Preferred: Cloudflare Realtime TURN

No VM. Global anycast. First **1,000 GB/month** free, then **$0.05/GB** egress.
STUN at `stun.cloudflare.com` is free and unlimited.
Docs: https://developers.cloudflare.com/realtime/turn/

### 1a. Dashboard

1. Cloudflare Dashboard → **Realtime** → **TURN Server**.
2. Add the Realtime subscription if prompted ($0 due now; overage only).
3. **Create** a TURN key (e.g. `lerniqo-speaking`).
4. Copy **Turn Token ID** and **API Token** once — keep them server-side only.

Smoke-test (expect HTTP 201):

```bash
curl -i https://rtc.live.cloudflare.com/v1/turn/keys/$TURN_KEY_ID/credentials/generate-ice-servers \
  -H "Authorization: Bearer $TURN_KEY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ttl": 3600}'
```

### 1b. Backend env

```
TURN_ENABLED=true
TURN_PROVIDER=cloudflare
CLOUDFLARE_TURN_KEY_ID=<Turn Token ID>
CLOUDFLARE_TURN_API_TOKEN=<API Token>
TURN_CREDENTIAL_TTL_SECONDS=3600
```

You do **not** need `TURN_URLS` / `TURN_STATIC_AUTH_SECRET` for Cloudflare.
`GET /api/speaking/rooms/ice-servers` calls Cloudflare’s generate-ice-servers
API and returns the same response shape the Flutter client already uses.

Rollback to the droplet: set `TURN_PROVIDER=coturn` and restore the coturn env
vars below. Tear down the DO droplet only after room calls look good for a week.

---

## 2. Alternative: self-hosted coturn (rollback)

You need a VM with a **public IP** and open UDP ports. A managed app host
(DigitalOcean App Platform, Azure App Service) can't do this — no raw UDP.

We previously used a **DigitalOcean droplet** because:
- The GitHub Student Pack gives **$200 credit/year** → effectively free for a while.
- coturn needs almost no CPU/RAM; the **$6/mo** plan (1 GB, 1 TB transfer) is plenty.

---

## 2a. Create the droplet

DigitalOcean → Create → Droplet:
- **Image:** Ubuntu 24.04 LTS
- **Plan:** Basic → **Regular** → **$6/mo** (1 vCPU / 1 GB / 1 TB transfer)
- **Region:** near your users (we used Frankfurt / FRA1)
- **Auth:** add your SSH public key (see "SSH key" box below)
- Create → note the **public IP** (ours was `64.226.72.102`)

### SSH key (one time, on your laptop)
```bash
# generates a key pair; public key is what you paste into DigitalOcean
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N "" -C "turn"
cat ~/.ssh/id_ed25519.pub      # ← paste this line into DO's "SSH Key content"
```
The **private** key stays on your machine. Later, `ssh root@<IP>` just works.

---

## 2b. Install coturn

```bash
ssh root@<DROPLET_IP>
apt update && apt install -y coturn openssl
```
(coturn is a standard Ubuntu package — no Docker needed. It runs as a systemd
service that auto-starts on boot.)

---

## 2c. Configure coturn

**Generate a shared secret** (you'll also put this in your backend):
```bash
openssl rand -hex 32        # copy the output → THE SECRET
```

**Write `/etc/turnserver.conf`** (replace the secret and public IP):
```conf
listening-port=3478
fingerprint
use-auth-secret
static-auth-secret=PASTE_THE_SECRET
realm=telc.turn
external-ip=64.226.72.102
min-port=49152
max-port=65535
no-cli
no-multicast-peers
```
What these mean:
- `use-auth-secret` + `static-auth-secret` → the **TURN REST API** auth mode.
  Instead of fixed user accounts, clients use *time-limited* credentials computed
  from this shared secret (see §6). This is the key to ephemeral credentials.
- `min-port`/`max-port` → the UDP range coturn uses to relay media.
- `external-ip` → the public IP coturn advertises in relay candidates.
- `realm` → any label; required by coturn.

**Enable + start the service:**
```bash
sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
systemctl enable coturn
systemctl restart coturn
systemctl is-active coturn      # → "active"
```

---

## 2d. Open the firewall

```bash
ufw allow 22/tcp            # SSH (allow FIRST so you don't lock yourself out)
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 49152:65535/udp   # the relay media range
ufw --force enable
ufw status                  # verify
```

---

## 2e. Test the relay (the proof it works)

You test from a real browser, because that exercises your actual network/NAT.

**Compute a temporary credential** (works because of `use-auth-secret`):
```bash
SECRET=PASTE_THE_SECRET
USERNAME=$(( $(date +%s) + 3600 )):test         # "<expiry>:<anyid>"
PASSWORD=$(printf '%s' "$USERNAME" | openssl dgst -binary -sha1 -hmac "$SECRET" | openssl base64)
echo "username: $USERNAME"
echo "password: $PASSWORD"
```

**Then on the Trickle ICE test page**
(https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/):
- URI: `turn:<DROPLET_IP>:3478`
- Username / Password: from above
- Add Server → Gather candidates

✅ **Success = a row with `Type = relay`.** That proves coturn relays. If you only
see `host`/`srflx`, the secret or firewall is wrong.

---

## 2f. Backend integration (coturn env)

The browser must **never** hold the static secret. Instead the backend mints a
short-lived credential per request. This is the *exact same* HMAC formula coturn
validates:

```
username   = "<unixExpiry>:<userId>"          # expiry = now + ttl (e.g. 3600s)
credential = base64( HMAC_SHA1( SECRET, username ) )
```

**Backend config (env vars)** — e.g. in App Platform / `.env.test`:
```
TURN_ENABLED=true
TURN_PROVIDER=coturn
TURN_URLS=turn:64.226.72.102:3478?transport=udp,turn:64.226.72.102:3478?transport=tcp
TURN_STATIC_AUTH_SECRET=<the same secret from §2c>
TURN_CREDENTIAL_TTL_SECONDS=3600
```

**Backend endpoint** — `GET /api/speaking/rooms/ice-servers` (JWT-protected)
returns the WebRTC-ready list:
```json
{
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" },
    { "urls": "turn:64.226.72.102:3478?transport=udp",
      "username": "1781632615:<userId>", "credential": "<hmac>", "credentialType": "password" }
  ],
  "ttlSeconds": 3600
}
```
(Implemented in `src/modules/speaking/room/turn-credentials.service.ts` +
`room.controller.ts`. Returns STUN-only if `TURN_ENABLED!=true`, so it's safe to
deploy before the TURN box exists.)

**Frontend** calls this endpoint right before `new RTCPeerConnection({ iceServers })`,
falls back to plain STUN if it fails, and refreshes before `ttlSeconds`.

---

## 3. Verify end to end

```bash
BASE=https://your-backend
TOKEN=$(curl -s -X POST "$BASE/api/auth/guest" | jq -r .accessToken)   # demo token
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/speaking/rooms/ice-servers" | jq
```
You should see `turn:` entries with `username`/`credential`. Cross-check the
credential matches coturn:
```bash
printf '%s' "<username from response>" | openssl dgst -binary -sha1 -hmac "$SECRET" | openssl base64
# must equal the "credential" in the response
```
Final real test: two devices on **different networks** (Wi-Fi + 4G). The browser
should reach `connectionState: connected` with a `typ relay` candidate.

---

## 4. Maintenance & gotchas

- **Keep coturn patched:** `apt update && apt upgrade -y coturn` occasionally
  (it's security-sensitive; there have been CVEs).
- **The secret lives in two places** (coturn config + backend env) and **must
  match**. Never commit it to git.
- **Credit expires:** the $200 DO credit lasts ~1 year. After that the droplet
  costs ~$6/mo, or destroy it when unused so it doesn't quietly drain credit.
- **Audio-only saves money:** only *relayed* traffic costs bandwidth; audio is
  ~5% of video. Most calls connect directly and never touch TURN.
- **Strict firewalls (UDP+TCP 3478 blocked):** add TLS `turns:` on port 443
  later — needs a domain + a Let's Encrypt cert. Optional hardening.

---

## 5. Coturn quick command reference (copy-paste)

```bash
# on the droplet, fresh Ubuntu:
apt update && apt install -y coturn openssl
SECRET=$(openssl rand -hex 32); echo "SECRET=$SECRET"   # save this
IP=$(curl -s ifconfig.me)

cat > /etc/turnserver.conf <<EOF
listening-port=3478
fingerprint
use-auth-secret
static-auth-secret=$SECRET
realm=telc.turn
external-ip=$IP
min-port=49152
max-port=65535
no-cli
no-multicast-peers
EOF

sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
systemctl enable coturn && systemctl restart coturn

ufw allow 22/tcp && ufw allow 3478/tcp && ufw allow 3478/udp && ufw allow 49152:65535/udp && ufw --force enable

systemctl is-active coturn   # → active
```
Then set `TURN_ENABLED/TURN_URLS/TURN_STATIC_AUTH_SECRET/TURN_CREDENTIAL_TTL_SECONDS`
in your backend and you're done.
```
```
