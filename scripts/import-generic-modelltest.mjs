/**
 * Turn a generic-model (A1/A2) Modelltest source file into an idempotent
 * seed migration for exam_sections / exam_items / exam_item_options.
 *
 * A third importer, not an extension of `generate-modelltest-seed.mjs` or
 * `import-modelltest-v2.mjs` — those two write to B1's 18 shared tables and
 * must stay untouched (the first is byte-tested against committed
 * migrations). A1/A2 task types (KURZANTWORT, FORMULAR_AUSFUELLEN) have no
 * table there and no analogue, which is why the generic model exists at
 * all (docs/architecture/multi-level.md Part 3).
 *
 * Usage:
 *   node scripts/import-generic-modelltest.mjs <source.json> <out.sql> --number N
 *
 * `--number` is the Modelltest's global number, its address in the API and
 * every URL — separate from the source file's own `modelltest.number`,
 * which is the paper's own number within its level (telc calls this one
 * "A2 Übungstest 1"). Same split as `import-modelltest-v2.mjs`.
 *
 * Rules, same five as the B2 importer, plus a sixth this one adds:
 *
 *   1. Every content revision is derived from (level, paper, skill, teil),
 *      and checked against a file-supplied revision rather than trusted.
 *   2. `level` and the paper number are read from the file, never inferred
 *      from its name.
 *   3. No repair block.
 *   4. Inserts are idempotent: this Modelltest's exam_sections rows are
 *      deleted by content_revision before re-insert, and child rows
 *      (exam_items, exam_item_options) cascade with them — a re-run is the
 *      same as a first run.
 *   5. Nothing here names a level or a paper.
 *   6. Every section is Zod-validated (generic-modelltest-schemas.mjs)
 *      before any SQL is written. A bad fixture fails loudly, not halfway
 *      through a migration.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  validateFormatAndAssets,
  validateSection,
} from './generic-modelltest-schemas.mjs';

const args = process.argv.slice(2);
const flagIndex = args.indexOf('--number');
if (flagIndex === -1 || !args[flagIndex + 1]) {
  throw new Error(
    'Usage: node scripts/import-generic-modelltest.mjs <source.json> <out.sql> --number <globalNumber>',
  );
}
const globalNumber = Number(args[flagIndex + 1]);
const [sourcePath, outputPath] = args.filter(
  (arg, index) => index !== flagIndex && index !== flagIndex + 1,
);
if (!sourcePath || !outputPath) {
  throw new Error(
    'Usage: node scripts/import-generic-modelltest.mjs <source.json> <out.sql> --number <globalNumber>',
  );
}
if (!Number.isInteger(globalNumber) || globalNumber < 1) {
  throw new Error('--number must be a positive integer');
}

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const { level, number: paperNumber, title, examOnly } = source.modelltest;

if (!['A1', 'A2'].includes(level)) {
  throw new Error(
    `This importer is for A1/A2 only (generic model). ${level} belongs in ` +
      `import-modelltest-v2.mjs, which writes to B1's shared tables.`,
  );
}
if (!Number.isInteger(paperNumber) || paperNumber < 1) {
  throw new Error('modelltest.number must be a positive integer');
}

const q = (value) =>
  value === null || value === undefined
    ? 'NULL'
    : `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${q(JSON.stringify(value))}::jsonb`;

/** Rule 1: derived, and checked against the file rather than taken from it. */
const revisionFor = (skill, teil) =>
  `${level.toLowerCase()}-modelltest-${paperNumber}-${skill.toLowerCase()}-teil-${teil}-v1`;

const checkRevision = (sectionId, derived, declared) => {
  if (declared && declared !== derived) {
    throw new Error(
      `${sectionId}: content revision mismatch — file says ${declared}, ` +
        `derived is ${derived}. Fix one of them rather than letting a ` +
        `revision describe the wrong paper.`,
    );
  }
};

// ─── Validate every section before writing a line of SQL ──────────────────
const rawSections = [
  ...(source.sections.HOEREN ?? []),
  ...(source.sections.LESEN ?? []),
  ...(source.sections.SCHREIBEN ?? []),
  ...(source.sections.SPRECHEN ?? []),
];
if (rawSections.length === 0) {
  throw new Error('No sections found in source.sections');
}

const sections = rawSections.map((raw) => {
  const section = validateSection(raw);
  const derived = revisionFor(section.fertigkeit, section.teil);
  checkRevision(section.sectionId, derived, section.contentRevision);
  return { ...section, contentRevision: derived };
});

const duplicateRevisions = sections
  .map((s) => s.contentRevision)
  .filter((rev, i, all) => all.indexOf(rev) !== i);
if (duplicateRevisions.length > 0) {
  throw new Error(`Duplicate content revisions: ${duplicateRevisions.join(', ')}`);
}

// format.hoerenDelivery / format.gradeBands and the assets manifest — both
// optional, both validated before any SQL is written, same as sections.
const { format, assets } = validateFormatAndAssets(source);

/**
 * Items vs. material, per aufgabentyp. `items` becomes exam_items rows
 * (with exam_item_options for the types that have per-item options);
 * everything else stays in exam_sections.material, since it is never
 * queried into — only rendered or compared at scoring time.
 */
function splitContent(aufgabentyp, content) {
  switch (aufgabentyp) {
    case 'EINZELAUSWAHL':
      return {
        material: { stimulus: content.stimulus ?? null },
        items: content.items.map((item) => ({
          itemNumber: item.number,
          prompt: item.prompt,
          solution: { key: item.solution.key },
          options: item.options.map((o) => ({
            key: o.key,
            content: o.text,
            isCorrect: o.key === item.solution.key,
          })),
        })),
      };
    case 'RICHTIG_FALSCH':
      return {
        material: {
          stimulus: content.stimulus ?? null,
          ...(content.texts ? { texts: content.texts } : {}),
        },
        items: content.items.map((item) => ({
          itemNumber: item.number,
          prompt: item.statement,
          solution: { value: item.solution.value },
          options: [],
        })),
      };
    case 'ZUORDNUNG':
      return {
        material: {
          leftLabel: content.leftLabel,
          rightLabel: content.rightLabel,
          allowNoMatch: content.allowNoMatch,
          noMatchKey: content.noMatchKey ?? null,
          choices: content.choices,
        },
        items: content.items.map((item) => ({
          itemNumber: item.number,
          prompt: item.prompt,
          solution: { choiceKey: item.solution.choiceKey },
          options: [],
        })),
      };
    case 'KURZANTWORT':
      return {
        material: {},
        items: content.items.map((item) => ({
          itemNumber: item.number,
          prompt: item.prompt,
          solution: {
            acceptedAnswers: item.solution.acceptedAnswers,
            normalization: item.normalization,
          },
          options: [],
        })),
      };
    case 'FORMULAR_AUSFUELLEN':
      return {
        material: {
          scenario: content.scenario ?? null,
          sourceDocuments: content.sourceDocuments ?? [],
        },
        items: content.fields.map((field) => ({
          itemNumber: field.number,
          prompt: field.label,
          solution: {
            acceptedAnswers: field.solution.acceptedAnswers,
            normalization: field.normalization,
          },
          // A CHOICE field's choices are what the candidate picks from. The
          // mark still comes from acceptedAnswers, like any other field.
          options: (field.choices ?? []).map((choice) => ({
            key: choice,
            content: choice,
            isCorrect: field.solution.acceptedAnswers.includes(choice),
          })),
        })),
      };
    case 'TEXT_SCHREIBEN':
    case 'SICH_VORSTELLEN':
    case 'FRAGEN_UND_ANTWORTEN':
    case 'BITTEN_UND_REAGIEREN':
    case 'ALLTAGSGESPRAECH':
    case 'ETWAS_AUSHANDELN':
      return { material: content, items: [] };
    default:
      throw new Error(`splitContent: no mapping for ${aufgabentyp}`);
  }
}

// ─── Build the migration ───────────────────────────────────────────────────
const sql = [];

sql.push(`-- ${title}
--
-- Generated by scripts/import-generic-modelltest.mjs from
-- ${path.basename(sourcePath)}. Do not hand-edit: regenerate.
--
-- Addressed as Modelltest ${globalNumber}. Inside the source it is ${level}
-- paper ${paperNumber}, which is what the content revisions are built from.
--
-- Re-running replaces only this Modelltest's exam_sections rows (and their
-- exam_items/exam_item_options, which cascade).
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "modelltests"
    WHERE "number" = ${globalNumber} AND "level" <> ${q(level)}
  ) THEN
    RAISE EXCEPTION
      'Modelltest % already exists at another level; refusing to overwrite it with ${level} content',
      ${globalNumber};
  END IF;
END $$;

INSERT INTO "modelltests" ("number", "title", "exam_only", "level", "format", "assets")
VALUES (${globalNumber}, ${q(title)}, ${examOnly === true}, ${q(level)}, ${format ? json(format) : 'NULL'}, ${assets ? json(assets) : 'NULL'})
ON CONFLICT ("number") DO UPDATE SET
  "title" = EXCLUDED."title",
  "exam_only" = EXCLUDED."exam_only",
  "level" = EXCLUDED."level",
  "format" = EXCLUDED."format",
  "assets" = EXCLUDED."assets";

DELETE FROM "exam_sections"
WHERE "content_revision" IN (${sections.map((s) => q(s.contentRevision)).join(', ')});
`);

for (const section of sections) {
  const { material, items } = splitContent(section.aufgabentyp, section.content);
  const sectionId = crypto.randomUUID();
  const sectionMaterial = {
    ...material,
    ...(section.media ? { media: section.media } : {}),
  };

  sql.push(`
-- ${section.sectionId} (${section.aufgabentyp})
INSERT INTO "exam_sections"
  ("id", "modelltest_id", "skill", "teil", "aufgabentyp", "label", "instruction",
   "max_points", "scoring_mode", "material", "content_revision", "choice_group_id", "sort_order")
VALUES (
  ${q(sectionId)},
  (SELECT "id" FROM "modelltests" WHERE "number" = ${globalNumber}),
  ${q(section.fertigkeit)}, ${section.teil}, ${q(section.aufgabentyp)},
  ${q(section.label)}, ${q(section.instructions.join(' '))},
  ${section.scoring.maxPoints}, ${q(section.scoring.mode)}, ${json(sectionMaterial)},
  ${q(section.contentRevision)}, NULL, ${section.position}
);`);

  for (const item of items) {
    const itemId = crypto.randomUUID();
    sql.push(`INSERT INTO "exam_items" ("id", "section_id", "item_number", "prompt", "solution", "sort_order")
VALUES (${q(itemId)}, ${q(sectionId)}, ${item.itemNumber}, ${q(item.prompt)}, ${json(item.solution)}, ${item.itemNumber});`);

    for (const [index, option] of item.options.entries()) {
      sql.push(`INSERT INTO "exam_item_options" ("item_id", "key", "content", "is_correct", "sort_order")
VALUES (${q(itemId)}, ${q(option.key)}, ${q(option.content)}, ${option.isCorrect}, ${index + 1});`);
    }
  }
}

sql.push(`
COMMIT;
`);

const output = sql.join('\n');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output, 'utf8');

process.stdout.write(
  `${level} paper ${paperNumber} -> Modelltest ${globalNumber}: ` +
    `${sections.length} sections, ${sections.reduce((n, s) => n + splitContent(s.aufgabentyp, s.content).items.length, 0)} items, ` +
    `${output.split('\n').length} lines\n`,
);
