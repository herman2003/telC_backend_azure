/**
 * The generic-model importer (scripts/import-generic-modelltest.mjs)
 * round-trips a synthetic A1/A2-shaped Modelltest against real Postgres:
 * generates SQL, applies it, reads the rows back, re-applies it to prove
 * idempotency, and never touches any B1/B2 table.
 *
 * Modelltest number 9500 is reserved for this test — far outside the real
 * catalogue, so a collision with seeded content would be a different bug.
 */
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { Client } from 'pg';
import { PrismaService } from '../src/shared/services/prisma.service';

const repoRoot = resolve(__dirname, '..');
const SMOKE_NUMBER = 9500;

const prisma = new PrismaService();

async function applySql(sql: string): Promise<void> {
  // The generated migration carries its own BEGIN/COMMIT, and multiple
  // statements in one string -- Prisma's $executeRawUnsafe only runs one
  // statement reliably, so this goes through the pg driver directly, the
  // same way scripts/apply-migration.mjs does.
  const client = new Client({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

describe('generic-model importer, against real Postgres', () => {
  let workDir: string;
  let generatedSql: string;

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), 'generic-import-'));
    const output = join(workDir, 'smoke.sql');
    execFileSync(
      process.execPath,
      [
        join(repoRoot, 'scripts', 'import-generic-modelltest.mjs'),
        join(repoRoot, 'test', 'fixtures', 'generic-modelltest-synthetic.json'),
        output,
        '--number',
        String(SMOKE_NUMBER),
      ],
      { cwd: repoRoot, stdio: 'pipe' },
    );
    generatedSql = readFileSync(output, 'utf8');
  });

  afterAll(async () => {
    rmSync(workDir, { recursive: true, force: true });
    await prisma.examSection.deleteMany({
      where: { modelltest: { number: SMOKE_NUMBER } },
    });
    await prisma.modelltest.deleteMany({ where: { number: SMOKE_NUMBER } });
    await prisma.$disconnect();
  });

  it('imports a modelltest row at the given level', async () => {
    await applySql(generatedSql);

    const modelltest = await prisma.modelltest.findUnique({
      where: { number: SMOKE_NUMBER },
    });
    expect(modelltest?.level).toBe('A2');
    expect(modelltest?.exam_only).toBe(true);
  });

  it('imports format.hoerenDelivery/gradeBands and the assets manifest', async () => {
    const modelltest = await prisma.modelltest.findUnique({
      where: { number: SMOKE_NUMBER },
    });

    const format = modelltest?.format as {
      hoerenDelivery?: {
        deliveryMode: string;
        pauseAllowed: boolean;
        recordings: { teil: number }[];
      };
      gradeBands?: { label: string }[];
    } | null;
    expect(format?.hoerenDelivery?.deliveryMode).toBe('PER_TEIL_RECORDINGS');
    expect(format?.hoerenDelivery?.pauseAllowed).toBe(false);
    expect(format?.hoerenDelivery?.recordings).toEqual([
      expect.objectContaining({ teil: 1 }),
    ]);
    expect(format?.gradeBands).toHaveLength(5);

    const assets = modelltest?.assets as { assetKey: string }[] | null;
    expect(assets).toHaveLength(1);
    expect(assets?.[0].assetKey).toBe('a2-modelltest-1-lesen-1-directory');
  });

  it('imports every section with its own aufgabentyp and scoring mode', async () => {
    const sections = await prisma.examSection.findMany({
      where: { modelltest: { number: SMOKE_NUMBER } },
      orderBy: { sort_order: 'asc' },
      select: {
        skill: true,
        teil: true,
        aufgabentyp: true,
        scoring_mode: true,
        max_points: true,
      },
    });

    expect(sections).toEqual([
      {
        skill: 'HOEREN',
        teil: 1,
        aufgabentyp: 'KURZANTWORT',
        scoring_mode: 'AUTO',
        max_points: 1,
      },
      {
        skill: 'LESEN',
        teil: 1,
        aufgabentyp: 'EINZELAUSWAHL',
        scoring_mode: 'AUTO',
        max_points: 1,
      },
      {
        skill: 'SPRECHEN',
        teil: 1,
        aufgabentyp: 'SICH_VORSTELLEN',
        scoring_mode: 'MANUAL',
        max_points: 3,
      },
      {
        skill: 'SCHREIBEN',
        teil: 2,
        aufgabentyp: 'TEXT_SCHREIBEN',
        scoring_mode: 'MANUAL_WITH_AI_SUGGESTION',
        max_points: 10,
      },
    ]);
  });

  it('imports EINZELAUSWAHL options with the right one marked correct', async () => {
    const section = await prisma.examSection.findFirst({
      where: { modelltest: { number: SMOKE_NUMBER }, skill: 'LESEN' },
      include: { items: { include: { options: true } } },
    });

    expect(section?.items).toHaveLength(1);
    const options = section!.items[0].options;
    expect(options.find((o) => o.key === 'b')?.is_correct).toBe(true);
    expect(options.filter((o) => o.is_correct)).toHaveLength(1);
  });

  it('leaves TEXT_SCHREIBEN and SICH_VORSTELLEN with no items, rubric in material', async () => {
    const section = await prisma.examSection.findFirst({
      where: { modelltest: { number: SMOKE_NUMBER }, skill: 'SCHREIBEN' },
      include: { items: true },
    });

    expect(section?.items).toHaveLength(0);
    expect((section!.material as { rubric?: unknown }).rubric).toBeDefined();
  });

  it('re-running the same SQL is a no-op, not a duplicate', async () => {
    const before = await prisma.examSection.count({
      where: { modelltest: { number: SMOKE_NUMBER } },
    });

    await applySql(generatedSql);

    const after = await prisma.examSection.count({
      where: { modelltest: { number: SMOKE_NUMBER } },
    });
    expect(after).toBe(before);
  });

  it('never touches any B1/B2 table', () => {
    // Sanity check on the generator itself, not the DB: the generic
    // importer's output must not reference a B1-shared table name.
    const b1Tables = [
      'lesen_teil1_exercises',
      'sprachbausteine_exercises',
      'writing_exercises',
      'listening_exercises',
      'speaking_exercises',
    ];
    for (const table of b1Tables) {
      expect(generatedSql).not.toContain(`"${table}"`);
    }
  });
});
