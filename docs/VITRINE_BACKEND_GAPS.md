# Vitrine — endpoints ajoutés (branche `feature/vitrine-backend-gaps`)

*Ce document a été créé avec Cursor (IA).*

## 1. `POST /api/center-auth/resend-verification`

Body : `{ "email": "…" }`  
Réponse 200 : `{ "message": "verification email sent" }` (toujours, anti-énumération).  
Cooldown interne 2 min (même logique que register sur compte non vérifié).  
Rate limit : email + IP (namespace `resend-verification`).

## 2. `POST /api/auth/validate-activation-code`

Body : `{ "code": "LQ-XXXX-XXXX" }` (casse / tirets / espaces tolérés).  
Réponse 200 : `{ "ok": true, "centerName": "…" }`  
Erreurs métier : `CODE_INVALID`, `CODE_ALREADY_USED`, `CODE_EXPIRED`, `CODE_DEACTIVATED`, `CODE_SUSPENDED`, `CENTER_NOT_ACTIVE`.  
**Ne consomme pas** le code — le redeem authentifié reste `POST /api/auth/redeem-code`.

## 3. `GET /api/vitrine/downloads`

Réponse : `{ "platforms": [ { id, url, version, sizeLabel, minVersion }, … ] }`  
IDs : `web` | `windows` | `macos` | `linux` | `android`.  
`url: null` = pas encore publié. Config via `DOWNLOAD_URL_*` / `DOWNLOAD_VERSION_*` / etc. (voir `.env.example`).

## 4. E-mails transactionnels centre (gabarits maquettes)

Shell HTML aligné vitrine (`#0061A4`, CTA pill, footer lerniqo.tech). Envois :

| Maquette | Déclencheur |
|---|---|
| Email-Confirmation | `register` / `resend-verification` |
| Email-CodeMotDePasse | `forgot-password` (TTL réel : 10 min) |
| Email-MotDePasseModifie | après `reset-password` / `change-password` |
| Email-NouveauCentre | après register réussi → `SUPPORT_EMAIL` |
| Email-CodeActive | après `redeem-code` → owners du centre |

## 5. `POST /api/vitrine/demo-requests`

Body : `{ fullName, email, whatsapp, centerName, studentBand, slotStart (ISO), message?, locale? }`  
Valide le créneau (Berlin, lun–sam, 7–12 / 16–20, :00/:30, J+1…J+56).  
Envoie **Email-DemoClient** au demandeur + **Email-DemoEquipe** à `SUPPORT_EMAIL` / `DEMO_EMAIL_TEAM`.  
CTA visio : `DEMO_MEET_URL` (sinon page `/demo`). Rate limit IP + e-mail.

## Hors scope de cette branche

- Inscription centre en 2 temps strict (compte sans `centerName`) — voir demande existante côté sprach.
- Création automatique d’événement Google Calendar (lien Meet via `DEMO_MEET_URL` pour l’instant).
