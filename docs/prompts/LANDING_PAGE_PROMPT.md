# Landing page — the five products, and one live number

**For:** the coding agent or developer working in the Lerniqo landing site.
**Backend state:** branch `dev` of `telC_backend_azure`, 2026-09-26.
**Source of truth for prices:** `docs/OFFRES_LERNIQO.md` in the backend repo.

The offer is now five products, not one. The site should say so, and it should
take one number from the API rather than hard-coding it.

---

## 1. The offer

One subscription, four add-ons. Every add-on requires an active **Start** — it
is the door, and worth saying plainly so nobody buys an add-on expecting it to
work on its own.

| | Price | One line |
|---|---|---|
| **Lerniqo Start** | **4 500 FCFA / élève / mois** | apprendre — la plateforme, les cours, le suivi, et Sprechen IA Light |
| **Prep Pass** | **3 000 FCFA / élève / 60 jours**, paiement unique | s'entraîner — 20+ exercices par compétence, refaisables |
| **Exam Day** | **1 000 FCFA / candidat / examen**, à l'usage | se tester — un vrai examen blanc telc, chronométré et corrigé |
| **AI Assisted Learning** | **2 000 FCFA / élève / mois** | être accompagné — l'IA explique, guide et corrige pendant l'apprentissage |
| **AI Speaking** | **300 FCFA / crédit** (1 crédit = 1 session de 5 min) | pratiquer l'oral davantage avec l'IA |

The positioning line the founder uses, and the clearest thing on the page:

> **Start = apprendre · Prep Pass = s'entraîner · Exam Day = se tester ·
> AI Assisted Learning = être accompagné · AI Speaking = pratiquer l'oral**

**Who pays:** the centre, always. There is no student checkout and there will
not be one — students hold what their school buys for them. Any copy inviting
a student to buy is wrong.

---

## 2. Sprechen IA Light, included in Start

The detail that sells Start, and the one most likely to go stale on the site:

- **5 sessions IA par mois**, per student
- **5 minutes maximum** per session
- closes itself after 30 s without speech at the start, and on prolonged
  inactivity
- one session at a time

If the page quotes "2 par jour" anywhere, that is the old number and it is
wrong.

---

## 3. Take the allowance from the API, not from a constant

One public endpoint, no authentication:

```http
GET /api/plans
→ { minSeats: 10,
    plans: [ { id: "start",
               monthlyPricePerSeatXaf: 4500,
               aiSpeaking: { limit: 5, window: "per_month" } } ] }
```

Render the Start price and the AI allowance from this. It exists so the site
stops holding its own copy of numbers the backend enforces — a page promising
something the product does not do is worse than a page that loads a moment
later.

**It changed on 2026-09-25**: `window` was `per_24h` with `limit: 2`, and is
now `per_month` with `limit: 5`. Anything matching the old string will stop
recognising it.

The add-ons are **not** in this response. They are not plans — a centre buys
them on top of Start — so their prices stay in the table above until the
backend exposes a catalogue for them.

`minSeats: 10` is the real minimum for a paid centre; if the page quotes a
different figure, take it from here too.

---

## 4. Two things not to imply

- **Lerniqo does not certify.** Exam Day is a mock exam: the machine marks
  Lesen, Hören and Sprachbausteine, and a human at the centre marks Schreiben
  and Sprechen. Nothing on the page should read as an official telc result.
- **The AI does not replace the trainer.** On the AI tier of Exam Day it
  writes a suggestion the examiner reads before typing their own mark. Copy
  that says "corrigé par l'IA" would be selling something we deliberately do
  not do.

---

## How to check your work

Point the site at a backend running `dev`, load the pricing section, and
confirm the Start price and "5 sessions par mois" come from `GET /api/plans`
rather than from the bundle — change the constant in the backend, reload, and
the page should follow.
