/**
 * One-shot: fill A1/A2 Modelltest 1 source JSON with R2 image URLs, expand
 * assets[] to one entry per file, and write the guarded UPDATE migration.
 *
 * Run from repo root: node scripts/patch-a1-a2-image-urls.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const A1_BASE =
  'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/a1-mt-hoeren/a1-mt-1-hoeren/a1-mt-images-1/';
const A2_BASE =
  'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/a2-hoeren-mt/a2-mt-1-hoeren/a2-mt-1/';

const SPRECHEN3_SLUG = {
  Äpfel: 'aepfel',
  Fleisch: 'fleisch',
  Banane: 'banane',
  Orangensaft: 'orangensaft',
  Einkaufskorb: 'einkaufskorb',
  Hund: 'hund',
  Schlüssel: 'schluessel',
  Koffer: 'koffer',
  Blumen: 'blumen',
  Kuchen: 'kuchen',
  Laptop: 'laptop',
  Auto: 'auto',
};

function a1Url(name) {
  return A1_BASE + name;
}
function a2Url(name) {
  return A2_BASE + name;
}

function asset({
  assetKey,
  usedBy,
  sourcePages,
  requiredForTask,
  targetFileName,
  imageUrl,
  altText,
  extractionNotes,
}) {
  return {
    assetKey,
    usedBy,
    sourcePages,
    requiredForTask,
    containsSolution: false,
    targetFileName,
    imageUrl,
    altText,
    extractionNotes,
  };
}

function patchA1(source) {
  const hoeren1 = source.sections.HOEREN.find((s) => s.sectionId === 'HOEREN_1');
  for (const item of hoeren1.content.items) {
    for (const o of item.options) {
      o.imageUrl = a1Url(
        `a1-modelltest-1-hoeren-1-item${item.number}-${o.key}.png`,
      );
    }
  }

  const lesen2 = source.sections.LESEN.find((s) => s.sectionId === 'LESEN_2');
  for (const item of lesen2.content.items) {
    for (const o of item.options) {
      o.imageUrl = a1Url(
        `a1-modelltest-1-lesen-2-item${item.number}-${o.key}.png`,
      );
    }
  }

  const lesen3 = source.sections.LESEN.find((s) => s.sectionId === 'LESEN_3');
  for (const text of lesen3.content.texts) {
    const n = text.forItems[0];
    text.imageUrl = a1Url(`a1-modelltest-1-lesen-3-item${n}.png`);
  }

  const schreiben1 = source.sections.SCHREIBEN.find(
    (s) => s.sectionId === 'SCHREIBEN_1',
  );
  schreiben1.content.sourceDocuments[0].imageUrl = a1Url(
    'a1-modelltest-1-schreiben-1-form.png',
  );

  const sprechen3 = source.sections.SPRECHEN.find(
    (s) => s.sectionId === 'SPRECHEN_3',
  );
  for (const card of sprechen3.content.rounds[0].cards) {
    const slug = SPRECHEN3_SLUG[card.text];
    if (!slug) throw new Error(`no slug for Sprechen 3 card "${card.text}"`);
    card.imageUrl = a1Url(`a1-modelltest-1-sprechen-3-card-${slug}.png`);
  }

  const assets = [];
  for (let n = 1; n <= 6; n++) {
    for (const k of ['a', 'b', 'c']) {
      const name = `a1-modelltest-1-hoeren-1-item${n}-${k}.png`;
      assets.push(
        asset({
          assetKey: `a1-hoeren-1-item${n}-${k}`,
          usedBy: ['HOEREN_1'],
          sourcePages: n <= 3 ? [8] : [9],
          requiredForTask: false,
          targetFileName: name,
          imageUrl: a1Url(name),
          altText: `Hören Teil 1 item ${n} option ${k}`,
          extractionNotes: 'Option picture; option text is the fallback.',
        }),
      );
    }
  }
  for (let n = 6; n <= 10; n++) {
    for (const k of ['a', 'b']) {
      const name = `a1-modelltest-1-lesen-2-item${n}-${k}.png`;
      assets.push(
        asset({
          assetKey: `a1-lesen-2-item${n}-${k}`,
          usedBy: ['LESEN_2'],
          sourcePages: n <= 8 ? [16] : [17],
          requiredForTask: false,
          targetFileName: name,
          imageUrl: a1Url(name),
          altText: `Lesen Teil 2 item ${n} option ${k}`,
          extractionNotes: 'Ad screenshot; option text is the fallback.',
        }),
      );
    }
  }
  for (let n = 11; n <= 15; n++) {
    const name = `a1-modelltest-1-lesen-3-item${n}.png`;
    assets.push(
      asset({
        assetKey: `a1-lesen-3-item${n}`,
        usedBy: ['LESEN_3'],
        sourcePages: n <= 13 ? [18] : [19],
        requiredForTask: false,
        targetFileName: name,
        imageUrl: a1Url(name),
        altText: `Lesen Teil 3 sign for item ${n}`,
        extractionNotes: 'Sign picture; texts[].body is the fallback.',
      }),
    );
  }
  assets.push(
    asset({
      assetKey: 'a1-schreiben-1-form',
      usedBy: ['SCHREIBEN_1'],
      sourcePages: [20],
      requiredForTask: false,
      targetFileName: 'a1-modelltest-1-schreiben-1-form.png',
      imageUrl: a1Url('a1-modelltest-1-schreiben-1-form.png'),
      altText: 'Bodensee-Rundfahrt registration form',
      extractionNotes: 'Form picture; sourceDocuments body is the fallback.',
    }),
  );
  for (const [text, slug] of Object.entries(SPRECHEN3_SLUG)) {
    const name = `a1-modelltest-1-sprechen-3-card-${slug}.png`;
    assets.push(
      asset({
        assetKey: `a1-sprechen-3-${slug}`,
        usedBy: ['SPRECHEN_3'],
        sourcePages: [26],
        requiredForTask: false,
        targetFileName: name,
        imageUrl: a1Url(name),
        altText: `Sprechen Teil 3 card: ${text}`,
        extractionNotes: 'Picture-only card; card text names the object.',
      }),
    );
  }
  source.assets = assets;
  return source;
}

function patchA2(source) {
  const hoeren1 = source.sections.HOEREN.find((s) => s.sectionId === 'HOEREN_1');
  for (const item of hoeren1.content.items) {
    item.imageUrl = a2Url(
      `a2-modelltest-1-hoeren-1-item${item.number}-note.png`,
    );
  }

  const lesen1 = source.sections.LESEN.find((s) => s.sectionId === 'LESEN_1');
  lesen1.content.stimulus.imageUrl = a2Url(
    'a2-modelltest-1-lesen-1-directory.png',
  );

  const lesen3 = source.sections.LESEN.find((s) => s.sectionId === 'LESEN_3');
  for (const choice of lesen3.content.choices) {
    choice.imageUrl = a2Url(
      `a2-modelltest-1-lesen-3-ad-${choice.key}.png`,
    );
  }

  const schreiben1 = source.sections.SCHREIBEN.find(
    (s) => s.sectionId === 'SCHREIBEN_1',
  );
  const docFiles = [
    'personal-data',
    'bank-card',
    'biography',
    'form',
  ];
  schreiben1.content.sourceDocuments.forEach((doc, i) => {
    doc.imageUrl = a2Url(`a2-modelltest-1-schreiben-1-${docFiles[i]}.png`);
  });

  const schreiben2 = source.sections.SCHREIBEN.find(
    (s) => s.sectionId === 'SCHREIBEN_2',
  );
  schreiben2.content.stimulus = {
    type: 'IMAGE',
    body: null,
    imageUrl: a2Url('a2-modelltest-1-schreiben-2-points.png'),
  };

  const sprechen1 = source.sections.SPRECHEN.find(
    (s) => s.sectionId === 'SPRECHEN_1',
  );
  sprechen1.content.imageUrl = a2Url(
    'a2-modelltest-1-sprechen-1-prompts.png',
  );

  const sprechen2 = source.sections.SPRECHEN.find(
    (s) => s.sectionId === 'SPRECHEN_2',
  );
  sprechen2.content.imageUrl = a2Url('a2-modelltest-1-sprechen-2-cards.png');

  const sprechen3 = source.sections.SPRECHEN.find(
    (s) => s.sectionId === 'SPRECHEN_3',
  );
  sprechen3.content.participantCardSheets = {
    A: { imageUrl: a2Url('a2-modelltest-1-sprechen-3-a.png') },
    B: { imageUrl: a2Url('a2-modelltest-1-sprechen-3-b.png') },
  };

  const a2Files = [
    ...[1, 2, 3, 4, 5].map((n) => ({
      name: `a2-modelltest-1-hoeren-1-item${n}-note.png`,
      usedBy: ['HOEREN_1'],
      sourcePages: [8],
      requiredForTask: true,
      altText: `Hören Teil 1 telephone note ${n}`,
    })),
    {
      name: 'a2-modelltest-1-lesen-1-directory.png',
      usedBy: ['LESEN_1'],
      sourcePages: [13],
      requiredForTask: true,
      altText: 'Kaufhaus Waldheim floor directory',
    },
    ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k) => ({
      name: `a2-modelltest-1-lesen-3-ad-${k}.png`,
      usedBy: ['LESEN_3'],
      sourcePages: [17],
      requiredForTask: true,
      altText: `Lesen Teil 3 advertisement ${k}`,
    })),
    ...docFiles.map((slug, i) => ({
      name: `a2-modelltest-1-schreiben-1-${slug}.png`,
      usedBy: ['SCHREIBEN_1'],
      sourcePages: i < 3 ? [18] : [19],
      requiredForTask: true,
      altText: `Schreiben Teil 1 ${slug}`,
    })),
    {
      name: 'a2-modelltest-1-schreiben-2-points.png',
      usedBy: ['SCHREIBEN_2'],
      sourcePages: [20],
      requiredForTask: true,
      altText: 'Schreiben Teil 2 content-point boxes',
    },
    {
      name: 'a2-modelltest-1-sprechen-1-prompts.png',
      usedBy: ['SPRECHEN_1'],
      sourcePages: [22],
      requiredForTask: false,
      altText: 'Sprechen Teil 1 prompt cards',
    },
    {
      name: 'a2-modelltest-1-sprechen-2-cards.png',
      usedBy: ['SPRECHEN_2'],
      sourcePages: [23],
      requiredForTask: true,
      altText: 'Sprechen Teil 2 question-word cards',
    },
    {
      name: 'a2-modelltest-1-sprechen-3-a.png',
      usedBy: ['SPRECHEN_3'],
      sourcePages: [24],
      requiredForTask: true,
      altText: 'Sprechen Teil 3 participant A sheet',
    },
    {
      name: 'a2-modelltest-1-sprechen-3-b.png',
      usedBy: ['SPRECHEN_3'],
      sourcePages: [25],
      requiredForTask: true,
      altText: 'Sprechen Teil 3 participant B sheet',
    },
  ];

  source.assets = a2Files.map((f) =>
    asset({
      assetKey: f.name.replace(/\.png$/, ''),
      usedBy: f.usedBy,
      sourcePages: f.sourcePages,
      requiredForTask: f.requiredForTask,
      targetFileName: f.name,
      imageUrl: a2Url(f.name),
      altText: f.altText,
      extractionNotes: 'Uploaded to R2; text in section content is the fallback.',
    }),
  );
  return source;
}

function sqlLiteral(value) {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

function buildMaterialPatches(level, source) {
  const patches = [];
  for (const skill of Object.keys(source.sections)) {
    for (const section of source.sections[skill]) {
      const content = section.content;
      let materialPatch = null;

      if (section.aufgabentyp === 'EINZELAUSWAHL') {
        const optionImages = {};
        for (const item of content.items ?? []) {
          const byKey = {};
          for (const o of item.options ?? []) {
            if (o.imageUrl) byKey[o.key] = o.imageUrl;
          }
          if (Object.keys(byKey).length) optionImages[String(item.number)] = byKey;
        }
        materialPatch = {
          ...(content.stimulus !== undefined
            ? { stimulus: content.stimulus ?? null }
            : {}),
          ...(Object.keys(optionImages).length ? { optionImages } : {}),
        };
      } else if (section.aufgabentyp === 'RICHTIG_FALSCH' && content.texts) {
        materialPatch = {
          ...(content.stimulus !== undefined
            ? { stimulus: content.stimulus ?? null }
            : {}),
          texts: content.texts,
        };
      } else if (section.aufgabentyp === 'KURZANTWORT') {
        const itemImages = {};
        for (const item of content.items ?? []) {
          if (item.imageUrl) itemImages[String(item.number)] = item.imageUrl;
        }
        if (Object.keys(itemImages).length) materialPatch = { itemImages };
      } else if (section.aufgabentyp === 'ZUORDNUNG') {
        materialPatch = {
          leftLabel: content.leftLabel,
          rightLabel: content.rightLabel,
          allowNoMatch: content.allowNoMatch,
          noMatchKey: content.noMatchKey ?? null,
          choices: content.choices,
        };
      } else if (section.aufgabentyp === 'FORMULAR_AUSFUELLEN') {
        materialPatch = {
          scenario: content.scenario ?? null,
          sourceDocuments: content.sourceDocuments ?? [],
        };
      } else if (
        [
          'TEXT_SCHREIBEN',
          'SICH_VORSTELLEN',
          'FRAGEN_UND_ANTWORTEN',
          'BITTEN_UND_REAGIEREN',
          'ALLTAGSGESPRAECH',
          'ETWAS_AUSHANDELN',
        ].includes(section.aufgabentyp)
      ) {
        // Full content becomes material (media is separate on the row).
        materialPatch = { ...content };
      }

      if (!materialPatch) continue;
      // Only write patches that introduce a real (non-null) picture URL.
      if (!hasRealImageUrl(materialPatch)) continue;
      patches.push({
        contentRevision: section.contentRevision,
        materialPatch,
        sectionId: section.sectionId,
      });
    }
  }
  return patches;
}

function hasRealImageUrl(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return false;
  if (Array.isArray(value)) return value.some(hasRealImageUrl);
  if (typeof value === 'object') {
    if (
      typeof value.imageUrl === 'string' &&
      value.imageUrl.length > 0
    ) {
      return true;
    }
    if (value.optionImages && Object.keys(value.optionImages).length > 0) {
      return true;
    }
    if (value.itemImages && Object.keys(value.itemImages).length > 0) {
      return true;
    }
    return Object.values(value).some(hasRealImageUrl);
  }
  return false;
}

function buildMigration(a1, a2) {
  const a1Patches = buildMaterialPatches('A1', a1);
  const a2Patches = buildMaterialPatches('A2', a2);

  const lines = [
    '-- A1 Modelltest 9 and A2 Modelltest 8: fill Exam Day picture URLs',
    '-- from the R2 uploads into modelltests.assets and exam_sections.material.',
    '-- Does not re-create sections (exam_audio_plays.audio_id stays valid).',
    '-- Source of truth: content/a1-modelltest-1-source.json,',
    '-- content/a2-modelltest-1-source.json.',
    '',
  ];

  function block(number, level, assets, patches) {
    lines.push(`DO $$`);
    lines.push(`DECLARE updated integer;`);
    lines.push(`BEGIN`);
    lines.push(`  UPDATE "modelltests"`);
    lines.push(`     SET "assets" = ${sqlLiteral(assets)}`);
    lines.push(`   WHERE "number" = ${number} AND "level" = '${level}';`);
    lines.push(`  GET DIAGNOSTICS updated = ROW_COUNT;`);
    lines.push(`  IF updated <> 1 THEN`);
    lines.push(
      `    RAISE EXCEPTION 'expected exactly one ${level} Modelltest ${number}, updated %', updated;`,
    );
    lines.push(`  END IF;`);
    lines.push(`END`);
    lines.push(`$$;`);
    lines.push(``);

    for (const p of patches) {
      lines.push(`-- ${level} ${p.sectionId}`);
      lines.push(`DO $$`);
      lines.push(`DECLARE updated integer;`);
      lines.push(`BEGIN`);
      lines.push(`  UPDATE "exam_sections"`);
      lines.push(
        `     SET "material" = COALESCE("material", '{}'::jsonb) || ${sqlLiteral(p.materialPatch)}`,
      );
      lines.push(`   WHERE "content_revision" = '${p.contentRevision}'`);
      lines.push(
        `     AND "modelltest_id" = (SELECT "id" FROM "modelltests" WHERE "number" = ${number} AND "level" = '${level}');`,
      );
      lines.push(`  GET DIAGNOSTICS updated = ROW_COUNT;`);
      lines.push(`  IF updated <> 1 THEN`);
      lines.push(
        `    RAISE EXCEPTION 'expected exactly one section ${p.contentRevision} on ${level} #${number}, updated %', updated;`,
      );
      lines.push(`  END IF;`);
      lines.push(`END`);
      lines.push(`$$;`);
      lines.push(``);
    }
  }

  block(9, 'A1', a1.assets, a1Patches);
  block(8, 'A2', a2.assets, a2Patches);
  return lines.join('\n');
}

const a1Path = path.join(root, 'content', 'a1-modelltest-1-source.json');
const a2Path = path.join(root, 'content', 'a2-modelltest-1-source.json');
const a1 = patchA1(JSON.parse(fs.readFileSync(a1Path, 'utf8')));
const a2 = patchA2(JSON.parse(fs.readFileSync(a2Path, 'utf8')));

fs.writeFileSync(a1Path, JSON.stringify(a1, null, 2) + '\n');
fs.writeFileSync(a2Path, JSON.stringify(a2, null, 2) + '\n');

const migName = '20261024120000_a1_a2_mt1_image_urls';
const migDir = path.join(root, 'prisma', 'migrations', migName);
fs.mkdirSync(migDir, { recursive: true });
fs.writeFileSync(path.join(migDir, 'migration.sql'), buildMigration(a1, a2));

const a1Count = a1.assets.length;
const a2Count = a2.assets.length;
process.stdout.write(
  `patched sources; assets A1=${a1Count} A2=${a2Count} total=${a1Count + a2Count}; wrote ${migName}\n`,
);
