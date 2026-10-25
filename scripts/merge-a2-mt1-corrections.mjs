/**
 * Merge content/a2-modelltest-1-corrections.json into a2-modelltest-1-source.json.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(root, 'content/a2-modelltest-1-source.json');
const packPath = path.join(root, 'content/a2-modelltest-1-corrections.json');

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));

const attachItems = (skill, teil, packTeil) => {
  const section = source.sections[skill].find((s) => s.teil === teil);
  if (!section?.content?.items) return 0;
  let n = 0;
  for (const item of section.content.items) {
    const c = packTeil[String(item.number)];
    if (c) {
      item.correction = c;
      n++;
    }
  }
  return n;
};

const attachFields = (teil, packTeil) => {
  const section = source.sections.SCHREIBEN.find((s) => s.teil === teil);
  if (!section?.content?.fields) return 0;
  let n = 0;
  for (const field of section.content.fields) {
    const c = packTeil[String(field.number)];
    if (c) {
      field.correction = c;
      n++;
    }
  }
  return n;
};

let total = 0;
total += attachItems('HOEREN', 1, pack.hoeren.teil1);
total += attachItems('HOEREN', 2, pack.hoeren.teil2);
total += attachItems('HOEREN', 3, pack.hoeren.teil3);
total += attachItems('LESEN', 1, pack.lesen.teil1);
total += attachItems('LESEN', 2, pack.lesen.teil2);
total += attachItems('LESEN', 3, pack.lesen.teil3);
total += attachFields(1, pack.schreiben.teil1);

fs.writeFileSync(sourcePath, `${JSON.stringify(source, null, 2)}\n`);
console.log(`Merged ${total} corrections into`, sourcePath);
