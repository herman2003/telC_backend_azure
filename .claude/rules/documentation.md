# Documentation rules

Applies to every Markdown file in this repository.

The problem these rules exist for: agents produced 181 Markdown files, many of
them plans for work already shipped, several contradicting each other. The cost
is not disk space — it is that nobody can tell which document is true.

---

## Where things live

| Directory | Holds | Does not hold |
|---|---|---|
| `docs/architecture/` | system-wide design, boundaries, data flow | one feature's rules |
| `docs/adr/` | decisions with long-term consequences, and why | routine choices |
| `docs/domains/` | business rules per domain, approved behaviour | implementation plans |
| `docs/contracts/` | interfaces clients depend on | internal module APIs |
| `docs/guides/` | how to do a task: setup, branching, runbooks | behaviour specs |
| `docs/operations/` | deploy, smoke tests, recovery | development guides |
| `docs/archive/` | superseded documents, kept for history | anything current |
| `docs/ideas/` | proposals not decided on | approved work |
| `docs/superpowers/` | **tool-managed** — do not move or reorganise | hand-written docs |
| `docs/plans/active/` | implementation plans for work in progress | finished work |

`docs/glossary.md` is the single source for domain vocabulary.
`docs/README.md` is the index. Both are authoritative.

## Before creating any Markdown file

1. Read `docs/README.md`.
2. `grep -ril "<topic>" docs/` — more than one match means the topic already has
   a home.
3. Decide whether an existing document should be updated instead.
4. If you still need a new file, it must have: a reader, a reason no existing
   document can hold it, and a line in `docs/README.md`.

An unindexed permanent document is worse than no document — it will be found
later, believed, and be wrong.

## Never create

- `*-v2.md`, `*-final.md`, `*-fixed.md`, `*-new.md`
- `IMPLEMENTATION_COMPLETE.md`, `SUMMARY.md`, `REPORT.md`
- a document describing work you just finished
- a document describing a documentation change

Report finished work in the conversation. Write a file only when the user asks
for one, or when the knowledge outlives the task.

## Plans versus specifications

A **plan** is temporary. It lists work to do, lives in `docs/plans/active/` (or
wherever the skill that created it puts it), and is deleted or archived when
the work ships — after anything durable in it moves into the permanent
documents.

A **specification** is permanent. It describes behaviour that is approved or
implemented, and lives in `docs/domains/` or `docs/contracts/`.

Never treat a plan as evidence that something works. Read the code.

## ADRs

Write one when a decision constrains future work: a data model, a boundary, who
owns a concept, a protocol. Not for a refactor or a library bump.

Shape: context, decision, alternatives considered, consequences, status.
Number sequentially, never reuse a number, never rewrite an accepted ADR — add
a new one and mark the old `superseded by NNNN`.

## Keeping documents true

Change documented behaviour and the documentation changes in the same commit.

Do not restate what the code already defines:

| Source of truth | Not documentation |
|---|---|
| `prisma/schema.prisma` + migrations | table and column lists |
| controllers, DTOs, Swagger at `/api-docs` | endpoint and payload lists |
| `docs/domains/` | what the rules mean and why |
| `docs/adr/` | why the design is this way |

Link to the file and line that implements a rule where it helps.

## Status

Put a status line at the top of a document only where it changes how it is
read:

```
**Status:** draft | approved | superseded by <link> | archived
```

Track whether something is *implemented* separately from whether the document
is *approved* — they are different questions and conflating them is how plans
get mistaken for specs.

## Language

Engineering documentation in English: architecture, ADRs, contracts, specs,
guides. Commercial and customer-facing documents stay in the language of their
audience, which here is French.

Where a French translation of a technical contract exists, one version is
authoritative and the other links to it. Do not maintain two full copies.
