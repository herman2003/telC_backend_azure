/**
 * The B1 seed generator must keep producing the migrations already committed.
 *
 * Phase 26 adds a second importer for B2 (`import-modelltest-v2.mjs`) and
 * never edits `generate-modelltest-seed.mjs`. This test is what makes that
 * promise enforceable: it re-runs the B1 generator over the four source files
 * that have a committed migration and asserts the SQL is unchanged.
 *
 * Line endings are normalized before comparing. The generator writes LF; the
 * committed files hold CRLF because they were checked out on Windows. The SQL
 * is byte-identical otherwise, and a test that failed on the checkout's line
 * endings would be noise rather than a guard.
 *
 * Modelltests 1 and 2 are not covered: their content predates this generator
 * and lives in `00000000000001_exam_content`.
 */
import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { globSync } from 'glob';

const repoRoot = resolve(__dirname, '..', '..');
const GENERATED_MODELLTESTS = [3, 4, 5, 6] as const;

const lf = (value: string) => value.replace(/\r\n/g, '\n');

function committedMigration(modelltestNumber: number): string {
  const matches = globSync(
    `prisma/migrations/*_seed_modelltest${modelltestNumber}/migration.sql`,
    { cwd: repoRoot },
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one committed migration for Modelltest ${modelltestNumber}, found ${matches.length}`,
    );
  }
  return readFileSync(join(repoRoot, matches[0]), 'utf8');
}

describe('B1 seed generator fidelity', () => {
  let workDir: string;

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), 'generator-fidelity-'));
  });

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it.each(GENERATED_MODELLTESTS)(
    'reproduces the committed migration for Modelltest %i',
    (modelltestNumber) => {
      const source = join(
        repoRoot,
        'content',
        `modelltest-${modelltestNumber}-source.json`,
      );
      expect(existsSync(source)).toBe(true);

      const output = join(workDir, `mt-${modelltestNumber}.sql`);
      execFileSync(
        process.execPath,
        [
          join(repoRoot, 'scripts', 'generate-modelltest-seed.mjs'),
          source,
          output,
        ],
        { cwd: repoRoot, stdio: 'pipe' },
      );

      expect(lf(readFileSync(output, 'utf8'))).toBe(
        lf(committedMigration(modelltestNumber)),
      );
    },
  );
});
