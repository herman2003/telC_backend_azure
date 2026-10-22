# Checklist : quitter DigitalOcean App Platform → VPS + Docker

**Décision :** VPS = API Nest + Redis. **Garder** Neon (Postgres) + Cloudflare R2 (audio). Logos restent en Neon.

---

## A. Avant (repo)

- [ ] `Dockerfile` multi-stage (build Nest + runtime Node)
- [ ] `docker-compose.yml` : `api` + `redis`
- [ ] Healthcheck → `GET /health`
- [ ] Entrypoint : `prisma migrate deploy` puis `node dist/main.js` (1 instance)
- [ ] Doc / `.env.example` : `VALKEY_URL=redis://redis:6379` pour Compose
- [ ] CI verte sur `main`

## B. VPS

- [ ] Ubuntu LTS, SSH keys, user non-root
- [ ] Firewall : `22`, `80`, `443` seulement
- [ ] Docker Engine + Compose plugin
- [ ] Dossier app (ex. `/opt/lerniqo`) + `.env` **hors git**
- [ ] Copier secrets depuis App Platform (JWT, Gemini, Resend, Stripe/Fapshi, Neon, R2, New Relic…)
- [ ] `DATABASE_URL` / `DIRECT_URL` = **Neon** (inchangé)
- [ ] `VALKEY_URL` = Redis Docker interne
- [ ] `ALLOWED_ORIGINS` = app + vitrine (HTTPS)
- [ ] Reverse proxy (Caddy/Nginx) + TLS
- [ ] WebSocket upgrade (`/writing`, `/speaking-room`)

## C. Deploy parallèle (DO encore live)

- [ ] `docker compose up -d --build`
- [ ] Logs : listen + host Neon
- [ ] Smoke : `/health`, login, Schreiben, Sprechen evaluate, Hören play (R2)
- [ ] Webhooks Stripe/Fapshi prêts avec **nouvelle** URL API (pas encore cutover)

## D. Cutover

- [ ] Baisser TTL DNS
- [ ] Pointer `api.*` → IP VPS
- [ ] Mettre à jour webhooks paiement → nouveau domaine
- [ ] Surveiller 30–60 min (logs / New Relic)
- [ ] App Platform en veille 48 h (rollback DNS possible)
- [ ] Éteindre / supprimer App Platform

## E. Après

- [ ] Process deploy : pull/`compose up` sur merge `main`
- [ ] Alerte down sur `/health`
- [ ] Neon PITR / backups OK (rien à changer)
- [ ] R2 inchangé

## Hors scope v1 (plus tard si besoin)

- [ ] Postgres sur le VPS
- [ ] Audio sur disque VPS / MinIO (quitter R2)
- [ ] Multi-instances API (rooms Sprechen in-memory)
