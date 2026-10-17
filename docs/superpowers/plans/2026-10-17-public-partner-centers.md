# Plan: GET /api/public/partner-centers

## Goal
Public list of centers with logos for the marketing vitrine partners section.

## Assumptions
- Path exactly `GET /api/public/partner-centers` (frontend contract).
- No auth; no PII (no email, phone, street).
- Include only centers with non-empty `logo_url`.
- Payload: `{ centers: [{ id, name, logoUrl, city }] }`.
- `city` = catalog display name for `city_id`, else `city_other`, else `null`.
- Cap 50, ordered by name ascending.
- IP rate limit: 60 requests / 15 minutes (`checkPartnerCentersLimit`) so scrapers cannot hammer Prisma; invisible for a normal landing page load.

## Tasks
1. Pure city label helper + unit tests.
2. Service (Prisma query) + unit tests with mock.
3. Controller + Swagger under `api/public`.
4. Wire into `VitrineModule` (marketing surface).
5. Code review; PR → `dev`.
6. IP throttle on `GET partner-centers` + unit tests on `RateLimitService`.

## Out of scope
- R2 upload (Next.js).
- Filtering by subscription status (any center with a logo qualifies).
- HTTP/CDN cache for the strip.
