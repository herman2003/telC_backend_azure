# Plan: Schreiben A/B/C/D

**Decisions locked:** JSON `telc_rating`; wire `telcRating`; auto-cap I from `points_addressed`.

## Tasks
1. Pure helpers + unit tests (`writing-telc-rating.ts`)
2. Prisma `telc_rating Json?` + migration
3. Prompt + parse + score recompute in `writing-correction.service.ts`
4. Gateway + REST attempt DTO fields
5. Flutter prompt doc
6. Code review before human PR check
