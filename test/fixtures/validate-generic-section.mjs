/**
 * Test-only harness: validates one section (read from a JSON file given as
 * argv[2]) against scripts/generic-modelltest-schemas.mjs, in a plain Node
 * process rather than inside Jest — Jest's CJS module loader cannot run a
 * dynamic `import()` of an ESM file without --experimental-vm-modules, but
 * a child process started with `node --input-type=module` has no such
 * restriction. See test/generic-modelltest-schemas.spec.ts.
 *
 * Prints "OK" and exits 0 on a valid section; exits 1 with the Zod error on
 * stderr otherwise.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSection } from '../../scripts/generic-modelltest-schemas.mjs';

const sectionPath = process.argv[2];
if (!sectionPath) {
  console.error('Usage: validate-generic-section.mjs <section.json>');
  process.exit(2);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const section = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, sectionPath), 'utf8'),
);

try {
  validateSection(section);
  process.stdout.write('OK\n');
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
