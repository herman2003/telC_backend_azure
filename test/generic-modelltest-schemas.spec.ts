/**
 * The generic-model Zod schemas fail loudly on a bad fixture, before any
 * SQL is written. One case per concern A2 needs. Run as a subprocess
 * (`test/fixtures/validate-generic-section.mjs`), not an in-process
 * `import()` of the .mjs schema file — Jest's CJS module loader cannot do
 * that without --experimental-vm-modules, but a plain `node` child process
 * has no such restriction.
 */
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const repoRoot = resolve(__dirname, '..');
const harness = join(
  repoRoot,
  'test',
  'fixtures',
  'validate-generic-section.mjs',
);

const envelope = (overrides: Record<string, unknown>) => ({
  sectionId: 'TEST_SECTION',
  fertigkeit: 'LESEN',
  label: 'Test',
  teil: 1,
  title: 'Test',
  contentRevision: 'a2-modelltest-1-test-v1',
  instructions: [],
  position: 1,
  scoring: { mode: 'AUTO', maxPoints: 5, examPart: 'WRITTEN' },
  media: null,
  ...overrides,
});

describe('generic-modelltest-schemas', () => {
  let workDir: string;

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), 'generic-schema-'));
  });

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  /** Runs the harness on one section object; returns stdout, or throws with stderr on a non-zero exit. */
  const validate = (section: Record<string, unknown>): string => {
    const file = join(workDir, `${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(file, JSON.stringify(section));
    return execFileSync(process.execPath, [harness, file], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  };

  const expectRejects = (
    section: Record<string, unknown>,
    pattern?: RegExp,
  ) => {
    expect(() => validate(section)).toThrow(pattern ?? expect.anything());
  };

  it('accepts a valid EINZELAUSWAHL section', () => {
    expect(
      validate(
        envelope({
          aufgabentyp: 'EINZELAUSWAHL',
          content: {
            items: [
              {
                number: 1,
                prompt: 'Was kostet der Pullover?',
                options: [
                  { key: 'a', text: '30,00 €' },
                  { key: 'b', text: '95,00 €' },
                ],
                solution: { key: 'a' },
              },
            ],
          },
        }),
      ),
    ).toBe('OK\n');
  });

  it('rejects an EINZELAUSWAHL item with only one option', () => {
    expectRejects(
      envelope({
        aufgabentyp: 'EINZELAUSWAHL',
        content: {
          items: [
            {
              number: 1,
              prompt: 'X',
              options: [{ key: 'a', text: 'only one' }],
              solution: { key: 'a' },
            },
          ],
        },
      }),
    );
  });

  it('accepts a valid KURZANTWORT section with normalization and accepted answers', () => {
    expect(
      validate(
        envelope({
          aufgabentyp: 'KURZANTWORT',
          content: {
            items: [
              {
                number: 1,
                prompt: 'Rufnummer',
                normalization: {
                  trim: true,
                  ignoreCase: true,
                  unicodeNormalization: 'NFC',
                  numericAnswersStrict: true,
                  fuzzyMatchingAllowed: false,
                  unrecognizedAnswerPolicy: 'MANUAL_REVIEW',
                },
                solution: { acceptedAnswers: ['1688538'] },
              },
            ],
          },
        }),
      ),
    ).toBe('OK\n');
  });

  it('rejects KURZANTWORT with an empty acceptedAnswers list', () => {
    expectRejects(
      envelope({
        aufgabentyp: 'KURZANTWORT',
        content: {
          items: [
            {
              number: 1,
              prompt: 'Rufnummer',
              normalization: {
                trim: true,
                ignoreCase: true,
                unicodeNormalization: 'NFC',
                numericAnswersStrict: true,
                fuzzyMatchingAllowed: false,
                unrecognizedAnswerPolicy: 'MANUAL_REVIEW',
              },
              solution: { acceptedAnswers: [] },
            },
          ],
        },
      }),
    );
  });

  it('rejects a section whose scoring.mode is not a real mode', () => {
    // The exact mistake the A2 PDF review found in the first draft of the
    // extraction prompt -- Schreiben Teil 2 must never auto-score, and a
    // typo'd mode must fail validation rather than silently defaulting.
    expectRejects(
      envelope({
        aufgabentyp: 'TEXT_SCHREIBEN',
        scoring: {
          mode: 'NOT_A_REAL_MODE',
          maxPoints: 10,
          examPart: 'WRITTEN',
        },
        content: {},
      }),
    );
  });

  it('accepts a valid TEXT_SCHREIBEN section with the official rubric', () => {
    expect(
      validate(
        envelope({
          aufgabentyp: 'TEXT_SCHREIBEN',
          scoring: {
            mode: 'MANUAL_WITH_AI_SUGGESTION',
            maxPoints: 10,
            examPart: 'WRITTEN',
          },
          content: {
            instructions: 'Schreiben Sie einen Text.',
            bulletPoints: ['a', 'b', 'c', 'd'],
            selectionRule: {
              type: 'CHOOSE_N_OR_OWN',
              requiredBulletPoints: 3,
              allowOwnPoint: false,
            },
            wordLimit: { minimum: null, recommended: 40, maximum: null },
            rubric: {
              contentPoints: { selectRequired: 3, pointsPerPoint: [3, 1.5, 0] },
              communicativeDesign: { points: [1, 0.5, 0] },
            },
          },
        }),
      ),
    ).toBe('OK\n');
  });

  it('rejects an unknown aufgabentyp', () => {
    expectRejects(envelope({ aufgabentyp: 'NOT_A_REAL_TYPE', content: {} }));
  });
});

describe('validateFormatAndAssets', () => {
  const formatHarness = join(
    repoRoot,
    'test',
    'fixtures',
    'validate-format-assets.mjs',
  );
  let workDir: string;

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), 'generic-format-'));
  });

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  const run = (
    source: Record<string, unknown>,
  ): { format: unknown; assets: unknown } => {
    const file = join(workDir, `${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(file, JSON.stringify(source));
    const stdout = execFileSync(process.execPath, [formatHarness, file], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(stdout) as { format: unknown; assets: unknown };
  };

  const delivery = (over: Record<string, unknown> = {}) => ({
    deliveryMode: 'PER_TEIL_RECORDINGS',
    playsAllowed: 1,
    pauseAllowed: false,
    seekAllowed: false,
    restartAllowed: false,
    recordings: [
      {
        teil: 1,
        audioAssetKey: 'teil1.mp3',
        audioUrl: null,
        durationSeconds: null,
      },
      {
        teil: 2,
        audioAssetKey: 'teil2.mp3',
        audioUrl: 'https://cdn/t2.mp3',
        durationSeconds: 303,
      },
    ],
    ...over,
  });

  it('accepts a valid hoerenDelivery and gradeBands', () => {
    const result = run({
      format: {
        hoerenDelivery: delivery(),
        gradeBands: [{ label: 'SEHR_GUT', minimum: 54, maximum: 60 }],
      },
    });

    expect(result.format).toMatchObject({
      hoerenDelivery: {
        pauseAllowed: false,
        recordings: [{ teil: 1 }, { teil: 2 }],
      },
    });
    expect(result.assets).toBeNull();
  });

  it('rejects pauseAllowed: true -- Exam Day Hören cannot be paused', () => {
    expect(() =>
      run({ format: { hoerenDelivery: delivery({ pauseAllowed: true }) } }),
    ).toThrow();
  });

  it('rejects a second play -- the repeats are inside the file', () => {
    expect(() =>
      run({ format: { hoerenDelivery: delivery({ playsAllowed: 2 }) } }),
    ).toThrow();
  });

  it('rejects two recordings for the same Teil', () => {
    expect(() =>
      run({
        format: {
          hoerenDelivery: delivery({
            recordings: [
              {
                teil: 1,
                audioAssetKey: 'a.mp3',
                audioUrl: null,
                durationSeconds: null,
              },
              {
                teil: 1,
                audioAssetKey: 'b.mp3',
                audioUrl: null,
                durationSeconds: null,
              },
            ],
          }),
        },
      }),
    ).toThrow();
  });

  it('returns null, not {} or [], when the source carries neither', () => {
    const result = run({});

    expect(result.format).toBeNull();
    expect(result.assets).toBeNull();
  });

  it('accepts a valid asset manifest entry', () => {
    const result = run({
      assets: [
        {
          assetKey: 'a2-modelltest-1-lesen-1-directory',
          usedBy: ['LESEN_1'],
          sourcePages: [13],
          requiredForTask: true,
          containsSolution: false,
          imageUrl: null,
        },
      ],
    });

    expect(result.assets).toEqual([
      expect.objectContaining({
        assetKey: 'a2-modelltest-1-lesen-1-directory',
      }),
    ]);
  });

  it('rejects an asset with no usedBy section', () => {
    expect(() =>
      run({
        assets: [
          {
            assetKey: 'x',
            usedBy: [],
            requiredForTask: true,
            containsSolution: false,
            imageUrl: null,
          },
        ],
      }),
    ).toThrow();
  });
});
