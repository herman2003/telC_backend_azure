/**
 * Test-only harness: validates `{format, assets}` (read from a JSON file
 * given as argv[2]) against `validateFormatAndAssets` in
 * scripts/generic-modelltest-schemas.mjs. Same subprocess reasoning as
 * validate-generic-section.mjs.
 *
 * Prints the validated `{format, assets}` as JSON and exits 0 on success;
 * exits 1 with the Zod error on stderr otherwise.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFormatAndAssets } from '../../scripts/generic-modelltest-schemas.mjs';

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('Usage: validate-format-assets.mjs <source.json>');
  process.exit(2);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, sourcePath), 'utf8'),
);

try {
  const result = validateFormatAndAssets(source);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
