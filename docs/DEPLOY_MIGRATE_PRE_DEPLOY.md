# Migrations as PRE_DEPLOY (not on app start)

## Why

`npm start` / `start:prod` must only start Nest. Running `prisma migrate deploy`
on every boot turns a failed migration into an outage and races instances on
recycle. DigitalOcean cancels a deployment when a **PRE_DEPLOY** job fails —
that leaves the previous version serving.

## Repo scripts

| Script | Role |
|--------|------|
| `npm run db:migrate:deploy` | `prisma migrate deploy` (release / PRE_DEPLOY only) |
| `npm run start:prod` | `node -r newrelic dist/main.js` (no migrate) |

Env for migrate: **`DIRECT_URL`** = Neon host **without** `-pooler`.
Runtime still uses pooled **`DATABASE_URL`**.

## DigitalOcean App Platform (console)

1. Open the app → component that runs the Nest API.
2. Add a **Pre-Deploy Job** (or Job component run before deploy):
   - **Run command:** `npm run db:migrate:deploy`
   - Same build artifact / image as the web service
   - Env: `DIRECT_URL` (required), plus whatever Prisma needs from the image
3. Web service **Run command:** `npm run start:prod`  
   (must **not** include `migrate deploy`)
4. Deploy once on a quiet window; confirm:
   - PRE_DEPLOY logs show migrate success
   - App boots; `GET /health` → 200
5. Optional drill: point PRE_DEPLOY at a bad `DIRECT_URL` in a **staging**
   app and confirm the deploy is cancelled and the previous revision stays up.

## VPS / Docker later

Same split: one-shot `npm run db:migrate:deploy` in the release script, then
`docker compose up` with `start:prod` only. Do not bake migrate into the
long-running container CMD.
