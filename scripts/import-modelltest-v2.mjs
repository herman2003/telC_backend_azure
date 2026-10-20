/**
 * Turn a v2 Modelltest source file into an idempotent seed migration.
 *
 * A second importer rather than an extension of `generate-modelltest-seed.mjs`.
 * That one produces four committed B1 migrations byte for byte, and a test
 * asserts it still does; editing it to read a different file shape would put
 * B1's content at risk for no gain. The two write to the same tables.
 *
 * Usage:
 *   node scripts/import-modelltest-v2.mjs <source.json> <out.sql> --number N
 *
 * `--number` is the Modelltest's global number — its address in the API and in
 * every URL. The number inside the source file is what telc calls the paper
 * within its own level ("B2 Übungstest 1"), which is what the content
 * revisions are built from. The two are deliberately separate: telc numbers
 * from 1 at every level, while `modelltests.number` is unique across all of
 * them.
 *
 * Five rules keep the next paper free of code:
 *
 *   1. Every content revision is derived from (level, paper, skill, teil).
 *      `listening_exercises.content_revision` and the speaking one are
 *      globally unique, so a fallback that omitted the level would collide
 *      between levels. Where the file carries a revision it is checked against
 *      the derived value rather than trusted, so the two cannot drift.
 *   2. `level` and the paper number are read from the file, never inferred
 *      from its name.
 *   3. No repair block. The B1 generator carries one for a historic incident;
 *      it belongs to that incident and not to this.
 *   4. Inserts are ON CONFLICT, and child rows are deleted by parent first, so
 *      a re-run is the same as a first run.
 *   5. Nothing here names a level or a paper. Modelltest 8 is this script and a
 *      JSON file.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flagIndex = args.indexOf('--number');
if (flagIndex === -1 || !args[flagIndex + 1]) {
  throw new Error(
    'Usage: node scripts/import-modelltest-v2.mjs <source.json> <out.sql> --number <globalNumber>',
  );
}
const globalNumber = Number(args[flagIndex + 1]);
const [sourcePath, outputPath] = args.filter(
  (arg, index) => index !== flagIndex && index !== flagIndex + 1,
);
if (!sourcePath || !outputPath) {
  throw new Error(
    'Usage: node scripts/import-modelltest-v2.mjs <source.json> <out.sql> --number <globalNumber>',
  );
}
if (!Number.isInteger(globalNumber) || globalNumber < 1) {
  throw new Error('--number must be a positive integer');
}

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const { level, number: paperNumber } = source.modelltest;
const sections = source.sections;

if (!['A1', 'A2', 'B1', 'B2'].includes(level)) {
  throw new Error(`Unknown level ${level}`);
}
if (!Number.isInteger(paperNumber) || paperNumber < 1) {
  throw new Error('modelltest.number must be a positive integer');
}

/**
 * telc's own per-part minutes, which the source file does not carry per part:
 * it states the oral as 15 minutes for two candidates with 20 for preparation.
 * The booklet breaks that into roughly five minutes each for the three scored
 * parts. The introduction is not timed, and the three minutes here is a
 * display value rather than a rule.
 *
 * `prep_duration_seconds` stays at the 300 the B1 generator uses. telc's 20
 * minutes covers the whole oral and belongs to exam mode, not to a per-part
 * column a practice screen counts down.
 */
const SPEAKING_MINUTES = { 0: 3, 1: 5, 2: 5, 3: 5 };
const SPEAKING_PREP_SECONDS = 300;

/** Minutes a Lesen or Sprachbausteine Teil is given on its own, for display. */
const READING_BLOCK_MINUTES = 18;

const sql = [];
const q = (value) =>
  value === null || value === undefined
    ? 'NULL'
    : `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${q(JSON.stringify(value))}::jsonb`;
const values = (rows) =>
  rows.map((row) => `    (${row.join(', ')})`).join(',\n');

/** Rule 1: derived, and checked against the file rather than taken from it. */
const revisionFor = (slug) =>
  `${level.toLowerCase()}-modelltest-${paperNumber}-${slug}-v1`;

const revision = (slug, declared) => {
  const derived = revisionFor(slug);
  if (declared && declared !== derived) {
    throw new Error(
      `Content revision mismatch for ${slug}: file says ${declared}, ` +
        `derived is ${derived}. Fix one of them rather than letting a ` +
        `revision describe the wrong paper.`,
    );
  }
  return derived;
};

/**
 * A Hören answer in the notation the column accepts.
 *
 * `listening_questions.correct_answer` is constrained to '+' or '-', which is
 * telc's own marking notation — the booklet states every answer as "+
 * (richtig)" or "- (falsch)". Source files spell the words out, so they are
 * mapped here rather than relaxing a constraint that is keeping the column
 * honest.
 *
 * Anything unrecognised throws. An answer key that silently became '-'
 * because a spelling was not anticipated would mark correct work wrong, and
 * nobody would be able to see why from the data.
 */
const RICHTIG_FALSCH = new Map([
  ['RICHTIG', '+'],
  ['FALSCH', '-'],
  ['richtig', '+'],
  ['falsch', '-'],
  ['+', '+'],
  ['-', '-'],
  ['−', '-'],
  ['true', '+'],
  ['false', '-'],
]);

const hoerenAnswer = (value, where) => {
  const mapped = RICHTIG_FALSCH.get(String(value));
  if (!mapped) {
    throw new Error(
      `${where}: cannot read "${value}" as richtig or falsch. ` +
        `correct_answer accepts only + or -.`,
    );
  }
  return mapped;
};

const assertCount = (label, actual, expected) => {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, found ${actual}`);
  }
};

// The answer key is a second statement of the same facts, so it is checked
// against the items rather than imported. A key that disagrees with its own
// questions is a broken file, not a choice to make at import time.
const checkKey = (label, items, keyed, numberOf, answerOf) => {
  if (!keyed) return;
  for (const item of items) {
    const expected = keyed[String(numberOf(item))];
    const actual = answerOf(item);
    if (expected !== undefined && expected !== actual) {
      throw new Error(
        `${label} ${numberOf(item)}: items say ${actual}, answerKey says ${expected}`,
      );
    }
  }
};

sql.push(`-- ${source.modelltest.title}
--
-- Generated by scripts/import-modelltest-v2.mjs from
-- ${path.basename(sourcePath)}. Do not hand-edit: regenerate.
--
-- Addressed as Modelltest ${globalNumber}, which is its number in the API.
-- Inside the source it is ${level} paper ${paperNumber}, which is what telc
-- calls it and what the content revisions are built from.
--
-- Re-running replaces only this Modelltest's child content.
BEGIN;

DO $$
DECLARE
  mt_id UUID;
  exercise_id UUID;
BEGIN
  -- Refuse to take over a Modelltest that belongs to another level.
  --
  -- The upsert below is ON CONFLICT ("number") DO UPDATE, which is what makes
  -- a re-import a no-op. It also means a mistyped --number would rewrite
  -- another paper's title and level and then replace its content through the
  -- scoped deletes further down: one wrong digit, one transaction, no warning.
  -- The number column is unique across all levels and nothing in the schema
  -- says which level owns which number, so the check has to live here.
  IF EXISTS (
    SELECT 1 FROM "modelltests"
    WHERE "number" = ${globalNumber} AND "level" <> ${q(level)}
  ) THEN
    RAISE EXCEPTION
      'Modelltest % already exists at another level; refusing to overwrite it with ${level} content',
      ${globalNumber};
  END IF;

  INSERT INTO "modelltests" ("number", "title", "exam_only", "level")
  VALUES (${globalNumber}, ${q(source.modelltest.title)}, ${source.modelltest.examOnly === true}, ${q(level)})
  ON CONFLICT ("number") DO UPDATE SET
    "title" = EXCLUDED."title",
    "exam_only" = EXCLUDED."exam_only",
    "level" = EXCLUDED."level"
  RETURNING "id" INTO mt_id;
`);

// ─── Lesen Teil 1 — ZUORDNUNG ───────────────────────────────────────────────
{
  const s = sections.lesenTeil1;
  checkKey(
    'Lesen Teil 1',
    s.texts,
    source.answerKey?.lesenTeil1,
    (t) => t.textNumber,
    (t) => t.correctTitleKey,
  );
  sql.push(`  INSERT INTO "lesen_teil1_exercises"
    ("contentRevision", "label", "instruction", "modelltest_id")
  VALUES (${q(revision('lesen-teil1', s.contentRevision))}, ${q(s.label)}, ${q(s.instruction)}, mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "contentRevision" = EXCLUDED."contentRevision",
    "label" = EXCLUDED."label",
    "instruction" = EXCLUDED."instruction"
  RETURNING "id" INTO exercise_id;

  DELETE FROM "lesen_teil1_texts" WHERE "exerciseId" = exercise_id;
  DELETE FROM "lesen_teil1_titles" WHERE "exerciseId" = exercise_id;
  INSERT INTO "lesen_teil1_titles" ("exerciseId", "content", "sortOrder") VALUES
${values(s.titles.map((item) => ['exercise_id', q(item.content), item.sortOrder]))};
  INSERT INTO "lesen_teil1_texts"
    ("exerciseId", "textNumber", "von", "an", "body", "sortOrder", "correctTitleId") VALUES
${values(
  s.texts.map((item) => {
    const title = s.titles.find((t) => t.key === item.correctTitleKey);
    if (!title) {
      throw new Error(`Missing Lesen Teil 1 title ${item.correctTitleKey}`);
    }
    // `von` and `an` are a B1 email's header. A B2 text carries a heading
    // instead, which belongs above its body rather than in a sender field.
    const body = item.title ? `${item.title}\n\n${item.body}` : item.body;
    return [
      'exercise_id',
      item.textNumber,
      q(''),
      q(''),
      q(body),
      item.sortOrder,
      `(SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = exercise_id AND "sortOrder" = ${title.sortOrder})`,
    ];
  }),
)};
`);
}

// ─── Lesen Teil 2 — EINZELAUSWAHL ───────────────────────────────────────────
{
  const s = sections.lesenTeil2;
  const text = s.readingText ?? {};
  const body = [text.title, text.subtitle, text.body]
    .filter((part) => part)
    .join('\n\n');
  sql.push(`  INSERT INTO "lesen_teil2_exercises"
    ("contentRevision", "label", "instruction", "cautionNote", "topSender",
     "topReceiver", "topBody", "quotedThread", "modelltest_id")
  VALUES (${q(revision('lesen-teil2', s.contentRevision))}, ${q(s.label)}, ${q(s.instruction)},
    '', '', '', ${q(body)}, '', mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "contentRevision" = EXCLUDED."contentRevision", "label" = EXCLUDED."label",
    "instruction" = EXCLUDED."instruction", "cautionNote" = EXCLUDED."cautionNote",
    "topSender" = EXCLUDED."topSender", "topReceiver" = EXCLUDED."topReceiver",
    "topBody" = EXCLUDED."topBody", "quotedThread" = EXCLUDED."quotedThread"
  RETURNING "id" INTO exercise_id;

  DELETE FROM "lesen_teil2_options" WHERE "questionId" IN
    (SELECT "id" FROM "lesen_teil2_questions" WHERE "exerciseId" = exercise_id);
  DELETE FROM "lesen_teil2_questions" WHERE "exerciseId" = exercise_id;
${s.questions
  .map(
    (question) => `  INSERT INTO "lesen_teil2_questions"
    ("exerciseId", "questionNumber", "prompt", "sortOrder")
  VALUES (exercise_id, ${question.questionNumber}, ${q(question.prompt)}, ${question.sortOrder})
  RETURNING "id" INTO exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
${values(question.options.map((o) => ['exercise_id', q(o.content), o.isCorrect === true, o.sortOrder]))};
  SELECT "id" INTO exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;`,
  )
  .join('\n')}
`);
}

// ─── Lesen Teil 3 — ZUORDNUNG with a no-match option ────────────────────────
{
  const s = sections.lesenTeil3;
  sql.push(`  INSERT INTO "lesen_teil3_exercises"
    ("contentRevision", "label", "instruction", "modelltest_id")
  VALUES (${q(revision('lesen-teil3', s.contentRevision))}, ${q(s.label)}, ${q(s.instruction)}, mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "contentRevision" = EXCLUDED."contentRevision", "label" = EXCLUDED."label",
    "instruction" = EXCLUDED."instruction"
  RETURNING "id" INTO exercise_id;

  DELETE FROM "lesen_teil3_situations" WHERE "exerciseId" = exercise_id;
  DELETE FROM "lesen_teil3_announcements" WHERE "exerciseId" = exercise_id;
  INSERT INTO "lesen_teil3_announcements" ("exerciseId", "title", "content", "sortOrder") VALUES
${values(
  s.announcements.map((item) => [
    'exercise_id',
    // `title` is NOT NULL, and some of telc's announcements are untitled
    // press snippets. Empty string rather than a schema change: it is the
    // convention this schema already uses for a text field that does not
    // apply, and the client renders it as no heading.
    q(item.title ?? ''),
    q(item.content),
    item.sortOrder,
  ]),
)};
  INSERT INTO "lesen_teil3_situations"
    ("exerciseId", "situationNumber", "content", "noMatch", "correctAnnouncementId", "sortOrder") VALUES
${values(
  s.situations.map((item) => {
    const announcement = s.announcements.find(
      (a) => a.key === item.correctAnnouncementKey,
    );
    if (!item.noMatch && !announcement) {
      throw new Error(
        `Missing Lesen Teil 3 announcement ${item.correctAnnouncementKey}`,
      );
    }
    return [
      'exercise_id',
      item.situationNumber,
      q(item.content),
      item.noMatch === true,
      item.noMatch
        ? 'NULL'
        : `(SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = exercise_id AND "sortOrder" = ${announcement.sortOrder})`,
      item.sortOrder,
    ];
  }),
)};
`);
}

// ─── Sprachbausteine Teil 1 — LUECKENTEXT_EINZELAUSWAHL ─────────────────────
{
  const s = sections.sprachbausteineTeil1;
  sql.push(`  INSERT INTO "sprachbausteine_exercises"
    ("teil_number", "content_revision", "label", "instruction", "duration_minutes",
     "image_url", "body", "modelltest_id")
  VALUES (1, ${q(revision('sprachbausteine-teil1', s.contentRevision))}, ${q(s.label)},
    ${q(s.instruction)}, ${READING_BLOCK_MINUTES}, '', ${q(s.body)}, mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "teil_number" = EXCLUDED."teil_number", "content_revision" = EXCLUDED."content_revision",
    "label" = EXCLUDED."label", "instruction" = EXCLUDED."instruction",
    "duration_minutes" = EXCLUDED."duration_minutes", "image_url" = EXCLUDED."image_url",
    "body" = EXCLUDED."body"
  RETURNING "id" INTO exercise_id;

  DELETE FROM "sprachbausteine_gap_options" WHERE "gap_id" IN
    (SELECT "id" FROM "sprachbausteine_gaps" WHERE "exercise_id" = exercise_id);
  DELETE FROM "sprachbausteine_gaps" WHERE "exercise_id" = exercise_id;
${s.gaps
  .map(
    (gap) => `  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (exercise_id, ${q(gap.gapKey)}, ${gap.gapNumber}, ${gap.sortOrder})
  RETURNING "id" INTO exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
${values(gap.options.map((o) => ['exercise_id', q(o.content), o.isCorrect === true, o.sortOrder]))};
  SELECT "id" INTO exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;`,
  )
  .join('\n')}
`);
}

// ─── Sprachbausteine Teil 2 — LUECKENTEXT_WORTBANK ──────────────────────────
{
  const s = sections.sprachbausteineTeil2;
  sql.push(`  INSERT INTO "sprachbausteine_teil2_exercises"
    ("contentRevision", "label", "instruction", "durationMinutes", "image_url", "body", "modelltest_id")
  VALUES (${q(revision('sprachbausteine-teil2', s.contentRevision))}, ${q(s.label)}, ${q(s.instruction)},
    ${READING_BLOCK_MINUTES}, '', ${q(s.body)}, mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "contentRevision" = EXCLUDED."contentRevision", "label" = EXCLUDED."label",
    "instruction" = EXCLUDED."instruction", "durationMinutes" = EXCLUDED."durationMinutes",
    "image_url" = EXCLUDED."image_url", "body" = EXCLUDED."body"
  RETURNING "id" INTO exercise_id;

  DELETE FROM "sprachbausteine_teil2_gaps" WHERE "exerciseId" = exercise_id;
  DELETE FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = exercise_id;
  INSERT INTO "sprachbausteine_teil2_words" ("exerciseId", "letter", "content", "sortOrder") VALUES
${values(s.words.map((w) => ['exercise_id', q(w.key), q(w.content), w.sortOrder]))};
  INSERT INTO "sprachbausteine_teil2_gaps"
    ("exerciseId", "gapKey", "gapNumber", "correctWordId", "sortOrder") VALUES
${values(
  s.gaps.map((gap) => {
    const word = s.words.find((w) => w.key === gap.correctWordKey);
    if (!word) {
      throw new Error(`Missing Sprachbausteine word ${gap.correctWordKey}`);
    }
    return [
      'exercise_id',
      q(gap.gapKey),
      gap.gapNumber,
      `(SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = exercise_id AND "letter" = ${q(word.key)})`,
      gap.sortOrder,
    ];
  }),
)};
`);
}

// ─── Hören ──────────────────────────────────────────────────────────────────
for (const [name, part] of Object.entries(sections.hoeren)) {
  const keyName = `hoeren${name[0].toUpperCase()}${name.slice(1)}`;
  checkKey(
    `Hören ${name}`,
    part.questions,
    source.answerKey?.[keyName],
    (item) => item.questionNumber,
    (item) => item.correctAnswer,
  );

  const media = part.media ?? {};
  if (!media.audioUrl) {
    throw new Error(`Hören ${name} has no media.audioUrl`);
  }
  // Minutes, from the recording's own length. The column is minutes and a
  // recording is seconds, so it rounds up: a 4:50 track is five minutes of a
  // candidate's time, not four.
  const minutes = media.durationSeconds
    ? Math.ceil(media.durationSeconds / 60)
    : 10;

  sql.push(`  INSERT INTO "listening_exercises"
    ("modelltest_id", "part", "title", "subtitle", "instruction", "content_revision",
     "duration_minutes", "audio_url", "bundled_audio_asset", "image_url", "transcript",
     "exam_plays_allowed")
  VALUES (mt_id, ${part.part}, ${q(part.title)}, ${q(part.subtitle)}, ${q(part.instruction)},
    ${q(revision(`hoeren-teil${part.part}`, part.contentRevision))}, ${minutes},
    ${q(media.audioUrl)}, '', ${q(media.imageUrl ?? '')}, ${q(part.transcript)},
    ${media.allowedPlays ?? 1})
  ON CONFLICT ("modelltest_id", "part") DO UPDATE SET
    "title" = EXCLUDED."title", "subtitle" = EXCLUDED."subtitle",
    "instruction" = EXCLUDED."instruction", "content_revision" = EXCLUDED."content_revision",
    "duration_minutes" = EXCLUDED."duration_minutes", "audio_url" = EXCLUDED."audio_url",
    "bundled_audio_asset" = EXCLUDED."bundled_audio_asset", "image_url" = EXCLUDED."image_url",
    "transcript" = EXCLUDED."transcript",
    "exam_plays_allowed" = EXCLUDED."exam_plays_allowed"
  RETURNING "id" INTO exercise_id;
  DELETE FROM "listening_questions" WHERE "exercise_id" = exercise_id;
  INSERT INTO "listening_questions"
    ("exercise_id", "question_number", "prompt", "correct_answer", "sort_order") VALUES
${values(
  part.questions.map((item) => [
    'exercise_id',
    item.questionNumber,
    q(item.prompt),
    q(hoerenAnswer(item.correctAnswer, `Hören ${name} Q${item.questionNumber}`)),
    item.sortOrder,
  ]),
)};
`);
}

// ─── Schreiben ──────────────────────────────────────────────────────────────
//
// One row per task. B1 writes a single letter; B2 offers a choice and the
// candidate answers exactly one, so both carry the same choiceGroupId and the
// key is (modelltest_id, part).
{
  const s = sections.schreiben;
  const tasks = s.tasks ?? [s];
  const choiceGroupId = tasks.length > 1 ? (s.choiceGroupId ?? null) : null;

  // The section's own declared revision is checked even when its tasks each
  // get a suffixed one. Skipping it for a choice disabled the drift check in
  // the only case that has more than one row.
  if (tasks.length > 1) revision('schreiben', s.contentRevision);

  tasks.forEach((task, index) => {
    const part = index + 1;
    const slug = tasks.length > 1 ? `schreiben-${part}` : 'schreiben';
    const bullets = task.bulletPoints ?? [];
    sql.push(`  INSERT INTO "writing_exercises"
    ("content_revision", "title", "subtitle", "task_type", "intro", "stimulus",
     "task_instructions", "bullet_points", "closing_reminder", "modelltest_id",
     "part", "choice_group_id")
  VALUES (${q(revision(slug, tasks.length > 1 ? null : s.contentRevision))},
    ${q(task.title ?? s.title)}, ${q(task.label ?? null)}, 'brief',
    ${q(task.intro ?? null)}, ${task.stimulus ? json(task.stimulus) : 'NULL'},
    ${q(task.taskInstructions ?? s.instruction)},
    ARRAY[${bullets.map(q).join(', ')}]::text[],
    ${q(task.minimumWords ? `Mindestens ${task.minimumWords} Wörter.` : null)},
    mt_id, ${part}, ${q(choiceGroupId)})
  ON CONFLICT ("modelltest_id", "part") DO UPDATE SET
    "content_revision" = EXCLUDED."content_revision", "title" = EXCLUDED."title",
    "subtitle" = EXCLUDED."subtitle", "task_type" = EXCLUDED."task_type",
    "intro" = EXCLUDED."intro", "stimulus" = EXCLUDED."stimulus",
    "task_instructions" = EXCLUDED."task_instructions",
    "bullet_points" = EXCLUDED."bullet_points",
    "closing_reminder" = EXCLUDED."closing_reminder",
    "choice_group_id" = EXCLUDED."choice_group_id";
`);
  });
}

// ─── Sprechen ───────────────────────────────────────────────────────────────
//
// An unscored introduction is part 0. telc's B2 oral opens with `Einander
// kennenlernen`, which is not marked — the same task is B1's scored Teil 1,
// which is exactly why nothing here keys behaviour on the Teil number alone.
for (const [name, section] of Object.entries(sections.sprechen)) {
  const part = section.part ?? 0;
  const scored = section.scoring?.mode !== 'NOT_SCORED';

  // What the candidate is given to work from, flattened to the string list the
  // runtime renders. Each Aufgabenart keeps it under a different name.
  let topicPoints = [];
  if (Array.isArray(section.prompts)) topicPoints = [...section.prompts];
  if (Array.isArray(section.planningPoints) && section.planningPoints.length) {
    topicPoints = [...section.planningPoints];
  }
  if (section.participants) {
    topicPoints = Object.values(section.participants).map((p) =>
      [p.label, p.position, p.stimulusText].filter((x) => x).join(' — '),
    );
  }

  sql.push(`  INSERT INTO "speaking_exercises"
    ("modelltest_id", "part", "title", "subtitle", "topic_title", "topic_description",
     "topic_points", "instructions", "duration_minutes", "prep_duration_seconds",
     "image_url", "exam_image_url", "content_revision")
  VALUES (mt_id, ${part}, ${q(section.title)}, ${q(scored ? '' : 'Nicht bewertet')},
    ${q(section.topicTitle ?? section.title)},
    ${q(section.topicDescription ?? section.commonInstructions ?? section.instruction)},
    ${json(topicPoints)},
    ${q(section.instructions ?? section.commonInstructions ?? section.instruction)},
    ${SPEAKING_MINUTES[part] ?? 5}, ${SPEAKING_PREP_SECONDS}, '', NULL,
    ${q(revision(`sprechen-${name}`, section.contentRevision))})
  ON CONFLICT ("modelltest_id", "part") DO UPDATE SET
    "title" = EXCLUDED."title", "subtitle" = EXCLUDED."subtitle",
    "topic_title" = EXCLUDED."topic_title",
    "topic_description" = EXCLUDED."topic_description",
    "topic_points" = EXCLUDED."topic_points", "instructions" = EXCLUDED."instructions",
    "duration_minutes" = EXCLUDED."duration_minutes",
    "prep_duration_seconds" = EXCLUDED."prep_duration_seconds",
    "image_url" = EXCLUDED."image_url", "exam_image_url" = EXCLUDED."exam_image_url",
    "content_revision" = EXCLUDED."content_revision";
`);
}

/**
 * Remove parts this paper no longer has.
 *
 * The three per-part tables are upserted by (modelltest_id, part), and child
 * rows are deleted by parent, but nothing removed a parent whose part
 * disappeared. A corrected paper with one Schreiben task instead of two would
 * leave part 2 behind, and the `choices` field would offer a candidate a task
 * the paper no longer contains — which they could then answer, since the exam
 * resolves a submission by task id.
 *
 * B1 never exposed this because its shape does not vary. B2 is the first
 * level where the number of parts is genuinely a property of the paper.
 *
 * `listening_attempts.listening_exercise_id` is ON DELETE RESTRICT, so
 * dropping a Hoeren part somebody has already attempted fails here rather
 * than quietly discarding their work. That is the right outcome: it says the
 * content cannot be reshaped without deciding what happens to those attempts.
 */
const keptParts = {
  writing_exercises: (sections.schreiben.tasks ?? [sections.schreiben]).map(
    (_task, index) => index + 1,
  ),
  speaking_exercises: Object.values(sections.sprechen).map(
    (section) => section.part ?? 0,
  ),
  listening_exercises: Object.values(sections.hoeren).map((part) => part.part),
};

for (const [table, parts] of Object.entries(keptParts)) {
  sql.push(`  DELETE FROM "${table}"
  WHERE "modelltest_id" = mt_id AND "part" NOT IN (${parts.join(', ')});
`);
}

sql.push(`END $$;

COMMIT;
`);

// `exercise_id` is a PL/pgSQL variable here and a column name in the SQL. The
// B1 generator renames the variable for the same reason: unqualified, Postgres
// resolves the column and the statement silently compares a column to itself.
const output = sql
  .join('\n')
  .replaceAll(/\bexercise_id\b/g, 'seed_exercise_id')
  .replaceAll('"seed_exercise_id"', '"exercise_id"');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output, 'utf8');

const sectionCount =
  5 +
  Object.keys(sections.hoeren).length +
  (sections.schreiben.tasks?.length ?? 1) +
  Object.keys(sections.sprechen).length;
assertCount('sections emitted', sectionCount, sectionCount);
process.stdout.write(
  `${level} paper ${paperNumber} -> Modelltest ${globalNumber}: ` +
    `${sectionCount} sections, ${output.split('\n').length} lines\n`,
);
