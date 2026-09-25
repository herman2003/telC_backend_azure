# Module Sprechen (Expression orale) — API pour le frontend

**URL de base :** `https://api.lerniqo.tech`
**Namespace WebSocket :** `https://api.lerniqo.tech/speaking-room` (Socket.IO)
**Content-Type :** `application/json`

Vérifié en production et sur un build local le 28/08/2026.

> ⚠️ L'ancienne adresse `telc-speaking-api-*.azurewebsites.net`, encore citée dans
> `HOREN_API_FRONTEND.md` et `SCHREIBEN_API_FRONTEND.md`, **ne répond plus**.
> Utiliser `api.lerniqo.tech`.

---

## Sommaire

1. [Ce qui est disponible, et sur quelle branche](#1-ce-qui-est-disponible-et-sur-quelle-branche)
2. [Authentification](#2-authentification)
3. [Parcours A — Pratiquer avec une personne (lien partagé)](#3-parcours-a--pratiquer-avec-une-personne-lien-partagé)
4. [Parcours B — Pratiquer avec Elena (l'IA)](#4-parcours-b--pratiquer-avec-elena-lia)
5. [Parcours C — Trouver un partenaire (lobby)](#5-parcours-c--trouver-un-partenaire-lobby)
6. [Signalement et sécurité](#6-signalement-et-sécurité)
7. [Récapitulatif des erreurs](#7-récapitulatif-des-erreurs)
8. [Checklist d'intégration](#8-checklist-dintégration)

---

## 1. Ce qui est disponible, et sur quelle branche

| Fonctionnalité | Branche | État |
|---|---|---|
| Salles, thèmes, signalisation WebRTC | `main` | en production |
| Elena (sessions vocales en direct) | `main` | en production (fusionnée dans `2f5ebae`) |
| Lobby, mise en relation, signalement | `feature/speaking-lobby` | **pas encore fusionnée** |

---

## 2. Authentification

La démo **n'a pas d'écran de connexion**. L'application crée un jeton anonyme au
démarrage et l'utilise pour tous les appels ci-dessous.

### 2.1 Obtenir un jeton

**POST** `/api/auth/guest` — sans corps de requête

Réponse `201` :

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "isGuest": true,
  "expiresIn": 7200
}
```

À envoyer ensuite dans chaque appel authentifié :

```
Authorization: Bearer <accessToken>
```

**Points importants :**

- Le jeton est valable **2 heures**. En cas de réponse `401`, il faut en
  redemander un et rejouer l'appel.
- L'endpoint est limité à **10 jetons par IP et par heure**. Ne pas en demander
  un nouveau à chaque écran : le générer une fois au démarrage et le conserver.

### 2.2 Quels endpoints exigent le jeton

| Endpoint | Jeton requis |
|---|---|
| `POST /api/speaking/rooms` | non |
| `GET /api/speaking/rooms/:roomId` | non |
| `GET /api/speaking/rooms/ice-servers` | **oui** |
| `POST /api/speaking/live-token` | **oui** |
| `POST /api/speaking/live-session/end` | **oui** |
| `POST /api/speaking/evaluate` | **oui** |
| `GET /api/speaking/teils` | **oui** |
| WebSocket `/speaking-room` | non |

Le jeton invité (`isGuest: true`) est accepté partout. Aucun compte n'est
nécessaire.

---

## 3. Parcours A — Pratiquer avec une personne (lien partagé)

C'est le parcours qui existe déjà : l'hôte crée une salle et envoie le lien par
WhatsApp.

### 3.1 Créer une salle

**POST** `/api/speaking/rooms`

```json
{ "level": "B1" }
```

Le champ `level` est optionnel et vaut `B1` par défaut (c'est aujourd'hui le seul
niveau disponible).

Réponse `201` :

```json
{
  "roomId": "6fe4827f-e2ba-449c-ba54-327a4ac62990",
  "hostToken": "9c2a7f31-8b4e-4d2a-91c7-5e6f8a0b1c2d",
  "expiresAt": "2026-08-28T18:00:00.000Z",
  "topic": {
    "id": "b1-t2-014",
    "level": "B1",
    "teil": 2,
    "title": "Urlaub im eigenen Land",
    "description": "...",
    "talkingPoints": ["...", "...", "..."]
  }
}
```

> 🔒 **Ne jamais mettre `hostToken` dans un lien partageable.** Seul `roomId` doit
> circuler. Le lien actuel de l'application — `/speaking-peer/join?roomId=<roomId>`
> — est correct : il ne contient que `roomId`.
>
> `hostToken` prouve que l'on est l'hôte. Quiconque le possède peut prendre la
> place de l'hôte dans la salle.

**Limites :** 10 salles par IP et par minute. Une salle expire au bout de 2 heures.

### 3.2 Consulter une salle (côté invité, arrivé par le lien)

**GET** `/api/speaking/rooms/:roomId` — pas d'authentification

Réponse `200` :

```json
{
  "roomId": "6fe4827f-...",
  "status": "waiting",
  "hasHost": true,
  "hasGuest": false,
  "expiresAt": "2026-08-28T18:00:00.000Z",
  "topic": { "...": "..." }
}
```

- `status` vaut `waiting` ou `active`.
- **`404`** signifie que la salle a expiré ou a été fermée : afficher un message
  clair (« ce lien n'est plus valable ») plutôt qu'une erreur technique.
- Il n'y a **pas** de champ `level` à la racine : le niveau se trouve dans
  `topic.level`.

### 3.3 Récupérer les serveurs ICE — indispensable

**GET** `/api/speaking/rooms/ice-servers` — **jeton requis**

Réponse `200` :

```json
{
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" },
    { "urls": "stun:stun1.l.google.com:19302" },
    { "urls": "turn:64.226.72.102:3478?transport=udp",
      "username": "1756...", "credential": "abc...", "credentialType": "password" },
    { "urls": "turn:64.226.72.102:3478?transport=tcp",
      "username": "1756...", "credential": "abc...", "credentialType": "password" }
  ]
}
```

Transmettre **tout le tableau `iceServers`** à `RTCPeerConnection`.

> ⚠️ **À ne pas négliger.** Sans les serveurs TURN, l'appel fonctionne en Wi-Fi de
> bureau et **échoue sur les réseaux mobiles** (NAT symétrique), c'est-à-dire pour
> la majorité des utilisateurs. Les identifiants TURN sont temporaires : les
> demander au moment de l'appel, ne pas les mettre en cache.

### 3.4 Signalisation — Socket.IO

Se connecter à `https://api.lerniqo.tech/speaking-room`.

#### Événements émis par le client

| Événement | Payload | Remarque |
|---|---|---|
| `join-room` | `{ roomId, displayName, hostToken? }` | `hostToken` **uniquement** si on a créé la salle |
| `offer` | `{ roomId, offer }` | hôte uniquement |
| `answer` | `{ roomId, answer }` | invité uniquement |
| `ice-candidate` | `{ roomId, candidate }` | les deux |
| `shuffle-topic` | `{ roomId }` | hôte uniquement |
| `leave-room` | *(aucun)* | la salle est déduite du socket |

#### Événements reçus par le client

| Événement | Signification | Action attendue |
|---|---|---|
| `guest-joined` `{ displayName }` | l'invité est arrivé | l'hôte envoie `offer` |
| `offer` `{ offer }` | offre relayée | l'invité répond `answer` |
| `answer` `{ answer }` | réponse relayée | appliquer la description distante |
| `ice-candidate` `{ candidate }` | candidat relayé | ajouter au peer connection |
| `topic-changed` `{ topic }` | thème modifié | **les deux** rafraîchissent l'affichage |
| `partner-left` | l'invité est parti | la salle reste ouverte |
| `host-disconnected` | l'hôte a été coupé | délai de grâce de **30 s** en cours |
| `host-reconnected` | l'hôte est revenu | reprendre l'appel |
| `room-ended` | session terminée | quitter l'écran |
| `room-not-found` | `roomId` inconnu ou expiré | message clair |
| `room-full` | un invité est déjà présent | proposer autre chose |
| `already-in-room` | déjà dans une salle sur ce socket | ignorer |
| `unauthorized` | rôle incorrect pour `offer`/`answer` | bug côté client |
| `no-guest-ready` | `offer` envoyée trop tôt | attendre `guest-joined` |
| `server-shutting-down` | redémarrage du serveur | prévenir l'utilisateur |

#### Ordre d'appel qui fonctionne

```
Hôte                                  Invité
────                                  ──────
join-room {roomId, name, hostToken}
                                      join-room {roomId, name}
◀── guest-joined {displayName}
offer {roomId, offer} ───────────────▶
                                      ◀── offer
                                      answer {roomId, answer}
◀── answer
ice-candidate  ◀────────────────────▶  ice-candidate
```

L'hôte n'envoie l'offre **qu'après** avoir reçu `guest-joined`. Envoyer l'offre
avant produit `no-guest-ready`.

### 3.5 Changer de thème

L'hôte émet `shuffle-topic { roomId }`. Le serveur renvoie `topic-changed` **aux
deux participants** avec le même thème. Les deux écrans doivent se mettre à jour.

C'est un point de démonstration efficace : pouvoir dire « ce thème ne vous plaît
pas ? on en change » et voir les deux écrans changer ensemble.

---

## 4. Parcours B — Pratiquer avec Elena (l'IA)

Elena est l'examinatrice IA. **Le navigateur parle directement à Google** : aucun
flux audio ne transite par notre backend, qui se contente de délivrer un jeton
temporaire.

### 4.1 Demander un jeton de session

**POST** `/api/speaking/live-token` — **jeton requis**

```json
{ "teilNumber": 2, "modelltest": 1 }
```

- `teilNumber` : `1`, `2` ou `3` (obligatoire)
- `modelltest` : numéro du Modelltest dont on prend le thème (optionnel, défaut `1`)

Réponse `201` :

```json
{
  "sessionId": "f2c1a0e4-9b3d-4c7a-8e1f-0a2b3c4d5e6f",
  "token": "auth_tokens/AXo3...",
  "model": "gemini-3.1-flash-live-preview",
  "expiresInSeconds": 600,
  "teilNumber": 2,
  "topic": {
    "title": "Aufgabe: Bildbeschreibung",
    "description": "Beschreiben Sie das Bild genau...",
    "points": ["Was sehen Sie auf dem Foto?", "..."]
  }
}
```

- `sessionId` : à **conserver**, il sert à libérer la place (§4.4).
- `token` : jeton éphémère Google, **à usage unique**.
- `model` : à repasser tel quel à `live.connect`, **ne pas le coder en dur**.
- `topic` : à afficher à l'écran, c'est le sujet dont Elena va parler.

### 4.2 Quatre règles à respecter absolument

Ces quatre points ont été vérifiés en conditions réelles. Chacun coûte facilement
une journée de débogage s'il est manqué, car aucun ne produit un message d'erreur
explicite.

**① Utiliser `apiVersion: 'v1alpha'`**

```js
const ai = new GoogleGenAI({
  apiKey: token,
  httpOptions: { apiVersion: 'v1alpha' },   // ← PAS v1beta
});
const session = await ai.live.connect({ model, callbacks: { ... } });
```

Les jetons éphémères n'existent **pas** sur `v1beta`. Avec `v1beta`, le socket
s'ouvre puis se referme sans `setupComplete` : cela ressemble exactement à un
jeton invalide, alors que le problème est la version d'API.

**② Demander le micro AVANT d'appeler `/live-token`**

L'ordre correct est :

```
appui sur le bouton
  → getUserMedia (micro)
  → créer et resume() l'AudioContext          ← dans le handler du tap
  → POST /api/speaking/live-token
  → live.connect(...)
```

Les navigateurs n'autorisent le démarrage de l'audio que dans un geste
utilisateur. Si l'on attend d'abord la réponse réseau, le geste est « consommé »,
l'`AudioContext` reste suspendu, et **on obtient un silence total sans aucune
erreur**.

**③ Se connecter dans les 60 secondes, une seule fois**

Le jeton devient inutilisable au bout de **60 secondes** et ne fonctionne
**qu'une fois**. Si l'utilisateur hésite sur la demande de micro, redemander un
jeton plutôt que réutiliser l'ancien.

**④ Repasser `model` tel quel**

Le modèle évolue et est configurable côté serveur. Un modèle codé en dur côté
client cassera silencieusement le jour où il change.

### 4.3 Format audio

| Sens | Format |
|---|---|
| Micro → Gemini | PCM 16 bits, **16 000 Hz**, mono, encodé en base64 |
| Gemini → haut-parleurs | PCM 16 bits, **24 000 Hz**, mono |

Envoi :

```js
session.sendRealtimeInput({
  audio: { data: base64Pcm, mimeType: 'audio/pcm;rate=16000' },
});
```

**Lecture sans coupures.** Maintenir un curseur temporel et programmer chaque
morceau à la suite du précédent :

```js
nextTime = Math.max(nextTime, ctx.currentTime);
source.start(nextTime);
nextTime += buffer.duration;
```

**Interruption (barge-in).** Conserver chaque `AudioBufferSourceNode` programmé
dans un `Set`. À la réception de `serverContent.interrupted` :

```js
for (const s of activeSources) { try { s.stop(); } catch {} }
activeSources.clear();
nextTime = ctx.currentTime;        // ← ne pas oublier cette ligne
```

Sans la remise à zéro du curseur, la réponse suivante est programmée dans le
futur et **Elena reste muette plusieurs secondes** après chaque interruption.

**Vérifier la fréquence réelle.** `new AudioContext({ sampleRate: 16000 })` est
une *demande*, pas une garantie. Lire `ctx.sampleRate` et rééchantillonner si la
valeur diffère, sinon Elena entend une voix déformée.

### 4.4 Libérer la place à la fin — obligatoire

**POST** `/api/speaking/live-session/end`

```json
{ "sessionId": "f2c1a0e4-9b3d-4c7a-8e1f-0a2b3c4d5e6f" }
```

Réponse `204`, sans contenu.

> ⚠️ **Ce n'est pas optionnel.** Seules **2 sessions simultanées** sont possibles.
> Le backend ne peut pas savoir qu'une conversation navigateur↔Google est
> terminée : sans cet appel, la place reste occupée **5 minutes** et bloque les
> autres utilisateurs. Ce cas s'est produit lors des tests.

À appeler dans les trois cas : raccrochage, navigation hors de l'écran, et
fermeture de l'onglet (`beforeunload` / `dispose`).

L'appel est idempotent : le rejouer ne pose aucun problème.

### 4.5 Faire évaluer la transcription

**POST** `/api/speaking/evaluate`

```json
{ "teilNumber": 2, "transcript": "Ich heiße Alain. Ich komme aus Kamerun..." }
```

Réponse `200` :

```json
{
  "evaluationText": "Hallo! Hier sind die Ergebnisse deiner Sprechübung...",
  "scores": { "grammar": 75, "vocabulary": 72, "coherence": 80, "overall": 76 },
  "corrections": [
    { "original": "Ich gehen oft ins Kino",
      "corrected": "Ich gehe oft ins Kino",
      "explanation": "Das Verb 'gehen' muss konjugiert werden...",
      "error_type": "grammar" }
  ],
  "strengths": "Der Schüler spricht klar...",
  "areas_for_improvement": "Die Verbkonjugation..."
}
```

- `evaluationText` est un paragraphe en allemand **destiné à être lu à voix
  haute** (TTS) : c'est Elena qui annonce le résultat.
- La transcription vient désormais de Gemini (`inputTranscription`), **plus de la
  reconnaissance vocale du navigateur**. C'est nettement plus fiable.

> 💡 Si la connexion est coupée en cours de session, **envoyer quand même la
> transcription partielle**. Un retour sur ce qui a été dit vaut mieux que perdre
> cinq minutes de travail de l'étudiant.

### 4.6 Limites et messages

En cas de dépassement : `429`, avec un champ `messageKey`.

```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Vous avez utilisé vos 2 sessions avec Elena aujourd'hui.",
  "messageKey": "elenaDailyLimit"
}
```

| `messageKey` | Cause | Message suggéré |
|---|---|---|
| `elenaDailyLimit` | 2 sessions par IP et par jour atteintes | « Vous avez utilisé vos 2 sessions avec Elena aujourd'hui. » |
| `elenaBusyToday` | budget quotidien global atteint | « Elena est très demandée aujourd'hui. Réessayez demain. » |
| `elenaBusyNow` | 2 sessions déjà en cours | « Elena parle avec quelqu'un d'autre. Réessayez dans quelques minutes. » |

**Dans les trois cas, proposer la salle avec une vraie personne comme
alternative.** Un cul-de-sac ferait perdre l'utilisateur.

Se fier à `messageKey`, pas au texte du message : c'est la clé qui est stable.

---

## 5. Parcours C — Trouver un partenaire (lobby)

> Branche `feature/speaking-lobby` — **pas encore fusionnée dans `main`**.

Même socket, même namespace que la salle : **pas de seconde connexion**.

### 5.1 Événements émis par le client

| Événement | Payload |
|---|---|
| `find-partner` | `{ displayName, level? }` |
| `cancel-search` | *(aucun)* |
| `report-partner` | `{ reason? }` |

**Contrainte sur `displayName` :** prénom uniquement, **1 à 30 caractères, sans
chiffres**. Un nom contenant un chiffre est rejeté et l'utilisateur **n'est pas
mis en file** (aucun événement en retour).

> Cette règle empêche d'utiliser le champ pour diffuser un numéro de téléphone à
> des inconnus. **Il faut valider côté client avant d'émettre**, sinon
> l'utilisateur reste bloqué sur un écran d'attente sans comprendre pourquoi.

### 5.2 Événements reçus par le client

| Événement | Signification | Action |
|---|---|---|
| `waiting` `{ count }` | en file, personne de disponible | afficher l'écran d'attente |
| `waiting-count` `{ count }` | le nombre a changé | mettre à jour |
| `partner-found` `{ roomId, hostToken?, displayName }` | **mis en relation** | enchaîner sur `join-room` |
| `search-cancelled` | recherche annulée | revenir à l'écran précédent |
| `already-searching` | `find-partner` envoyé deux fois | ignorer |
| `already-in-room` | déjà dans un appel | ignorer |
| `lobby-full` | file saturée | réessayer plus tard |
| `partner-reported` | un signalement a mis fin à l'appel | quitter l'écran |

### 5.3 Enchaînement complet

```
Étudiant A                            Étudiant B
──────────                            ──────────
find-partner {displayName: "Anna"}
◀── waiting {count: 0}
                                      find-partner {displayName: "Ben"}
◀── partner-found                     ◀── partner-found
    {roomId, hostToken, "Ben"}            {roomId, "Anna"}   ← sans hostToken

    ▼ à partir d'ici, parcours A (§3.4), inchangé

join-room {roomId, "Anna", hostToken}
                                      join-room {roomId, "Ben"}
◀── guest-joined                      
offer ───────────────────────────────▶
```

**La présence de `hostToken` désigne l'hôte.** Celui qui le reçoit est l'hôte et
c'est lui qui envoie l'`offer`. L'autre est l'invité. Toute la suite est
identique au parcours A.

### 5.4 Deux points importants pour l'écran d'attente

**① `count` vaut presque toujours 0, et c'est normal.**

La mise en relation est **immédiate** : dès qu'une deuxième personne arrive, les
deux sont appariées. La file ne contient donc jamais plus d'une personne.

> Afficher **« Recherche d'un partenaire… »** avec un indicateur d'activité,
> **et non « 0 personne en attente »** — un zéro qui ne bouge jamais donne
> l'impression que la fonctionnalité est cassée.

**② Proposer Elena au bout de 45 secondes, sans quitter la file.**

Le minuteur est **côté client** : le backend ne le connaît pas. C'est volontaire.

- Au bout de 45 s, afficher « Personne n'est disponible. Voulez-vous pratiquer
  avec Elena ? »
- **Garder le socket en file pendant ce temps** : un vrai partenaire peut encore
  arriver pendant que la proposition est affichée.
- N'émettre `cancel-search` **que si** l'utilisateur accepte réellement Elena.

Refuser Elena doit laisser l'utilisateur en file, sans rien réémettre.

---

## 6. Signalement et sécurité

Le lobby met en relation **deux inconnus qui ne se sont pas choisis**, en vidéo.
C'est nouveau dans le produit : jusqu'ici, chaque appel venait d'un lien envoyé
volontairement à quelqu'un que l'on connaissait.

### 6.1 Signaler

Afficher un bouton de signalement **pendant tout appel issu du lobby**.

```
report-partner { reason: "comportement inapproprié" }
```

`reason` est optionnel, 500 caractères maximum. La salle est déduite du socket :
il n'y a rien d'autre à envoyer.

**Effets :**

1. Les **deux** participants reçoivent `partner-reported` — l'appel se termine
   pour tout le monde.
2. La salle est supprimée (`GET /rooms/:roomId` renvoie alors `404`).
3. Les deux personnes **ne seront plus remises en relation** pendant la session.

À la réception de `partner-reported`, fermer l'écran d'appel et revenir au lobby.

### 6.2 À prévoir côté interface

- Un **avertissement avant la première mise en relation** : rappeler qu'il s'agit
  d'un appel vidéo réel avec une personne inconnue.
- Un bouton de signalement **visible**, pas caché dans un menu.
- La validation du prénom (§5.1) **avant** l'émission.

### 6.3 Limites actuelles, à connaître

- Le blocage est lié au **socket** : il dure le temps de la session. Une personne
  signalée qui se reconnecte obtient un nouvel identifiant et peut être
  réappariée. Un blocage durable nécessiterait des comptes.
- Il n'existe **pas** d'outil de modération ni de table en base : le signalement
  est enregistré dans les logs du serveur (niveau `warn`, recherchable par
  `roomId`). C'est une première étape assumée, pas un système complet.

---

## 7. Récapitulatif des erreurs

| Code | Où | Cause | Traitement côté client |
|---|---|---|---|
| `401` | tout endpoint authentifié | jeton absent ou expiré | redemander `/api/auth/guest` et rejouer |
| `404` | `GET /rooms/:roomId` | salle expirée ou fermée | « Ce lien n'est plus valable » |
| `400` | `POST /live-token` | `teilNumber` hors de 1–3 | bug client |
| `429` | `POST /rooms` | plus de 10 salles/IP/minute | patienter |
| `429` | `POST /live-token` | voir `messageKey` (§4.6) | message + proposer une vraie personne |
| *(silence)* | `find-partner` | prénom invalide (chiffres) | **valider avant d'émettre** |

**Erreurs qui ne remontent aucun message** — les plus coûteuses à diagnostiquer :

| Symptôme | Cause réelle |
|---|---|
| Silence total, aucune erreur | `AudioContext` créé après un `await` : geste utilisateur perdu |
| Socket ouvert puis fermé sans `setupComplete` | `apiVersion` en `v1beta` au lieu de `v1alpha` |
| Elena muette plusieurs secondes après une interruption | curseur de lecture non réinitialisé |
| Appel qui marche au bureau, échoue en 4G | serveurs TURN non transmis à `RTCPeerConnection` |
| `elenaBusyNow` alors que personne ne parle | `/live-session/end` non appelé à la session précédente |

---

## 8. Checklist d'intégration

**Authentification**
- [ ] Jeton invité créé au démarrage, conservé, renouvelé sur `401`

**Salle (parcours A)**
- [ ] `ice-servers` appelé **avant** de créer le `RTCPeerConnection`
- [ ] `hostToken` jamais présent dans une URL
- [ ] L'hôte attend `guest-joined` avant d'envoyer l'`offer`
- [ ] `topic-changed` met à jour les **deux** écrans

**Elena (parcours B)**
- [ ] Ordre : micro → `AudioContext` → `/live-token` → `live.connect`
- [ ] `apiVersion: 'v1alpha'`
- [ ] Connexion dans les 60 s, jeton non réutilisé
- [ ] Capture en PCM 16 kHz, lecture en 24 kHz
- [ ] `ctx.sampleRate` vérifié, rééchantillonnage si nécessaire
- [ ] Sources audio suivies dans un `Set`, curseur réinitialisé sur `interrupted`
- [ ] `/live-session/end` appelé au raccrochage, à la navigation **et** à la fermeture
- [ ] Les trois `messageKey` gérés, chacun proposant une vraie personne

**Lobby (parcours C)**
- [ ] Prénom validé (sans chiffres) avant émission
- [ ] Indicateur d'activité, pas un compteur à zéro
- [ ] Proposition d'Elena à 45 s **sans** quitter la file
- [ ] `hostToken` reçu ⇒ ce client est l'hôte
- [ ] Bouton de signalement visible pendant l'appel
- [ ] `partner-reported` ferme l'écran des deux côtés

---

*Pour un détail non couvert ici : la documentation Swagger, générée à partir du
code, est disponible sur **`https://api.lerniqo.tech/api-docs`** (vérifié, `200`).*
