/**
 * Merge content/b2-modelltest-1-corrections.json into b2-modelltest-1-source.json.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(root, 'content/b2-modelltest-1-source.json');
const packPath = path.join(root, 'content/b2-modelltest-1-corrections.json');

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));

const attachHoeren = (teilKey, packTeil) => {
  const teil = source.sections.hoeren[teilKey];
  for (const q of teil.questions) {
    const item = packTeil[String(q.questionNumber)];
    if (item) q.correction = item;
  }
};

attachHoeren('teil1', pack.hoeren.teil1);
attachHoeren('teil2', pack.hoeren.teil2);
attachHoeren('teil3', pack.hoeren.teil3);

for (const text of source.sections.lesenTeil1.texts) {
  const item = pack.lesen.teil1[String(text.textNumber)];
  if (item) text.correction = item;
}

for (const q of source.sections.lesenTeil2.questions) {
  const item = pack.lesen.teil2[String(q.questionNumber)];
  if (item) q.correction = item;
}

for (const s of source.sections.lesenTeil3.situations) {
  const item = pack.lesen.teil3[String(s.situationNumber)];
  if (item) s.correction = item;
}

for (const gap of source.sections.sprachbausteineTeil1.gaps) {
  const item = pack.sprachbausteine.teil1[String(gap.gapNumber)];
  if (item) gap.correction = item;
}

for (const gap of source.sections.sprachbausteineTeil2.gaps) {
  const item = pack.sprachbausteine.teil2[String(gap.gapNumber)];
  if (item) gap.correction = item;
}

fs.writeFileSync(sourcePath, `${JSON.stringify(source, null, 2)}\n`);
console.log('Merged corrections into', sourcePath);
