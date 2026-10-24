/**
 * The non-regression net for phase 26 (B2 as a second CEFR level).
 *
 * Phase 26 touches scoring and content code that B1 uses in production. This
 * suite captures what every content surface returns for Modelltests 1–6 and
 * asserts it afterwards, so "we did not change B1" is a test run rather than a
 * judgement.
 *
 * Captured at the service layer, not over HTTP: the subject is the content
 * mappers, and going through the controllers would drag auth, entitlements and
 * the weekly rotation into a fixture that is supposed to change only when
 * content mapping changes. The e2e suite remains the HTTP-level guard.
 *
 * Only answer-key-bearing content surfaces are captured. `getTeils` on Lesen,
 * Sprachbausteine and Hören is per-student progress, not content, so it moves
 * for reasons that have nothing to do with this phase.
 *
 * Recapture deliberately:
 *   GOLDEN_UPDATE=1 npm.cmd run test:integration -- --runInBand
 * A fixture change must appear in a commit diff and be explained there. If one
 * moves without a reason, the phase has changed B1.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../src/shared/services/prisma.service';
import { GenericExamContentService } from '../../src/shared/services/generic-exam-content.service';
import { LesenService } from '../../src/modules/lesen/lesen.service';
import { SprachbausteineService } from '../../src/modules/sprachbausteine/sprachbausteine.service';
import { ListeningService } from '../../src/modules/listening/listening.service';
import { WritingService } from '../../src/modules/writing/writing.service';
import { WritingDailyQuotaService } from '../../src/modules/writing/writing-daily-quota.service';
import { SpeakingService } from '../../src/modules/speaking/services/speaking.service';

const prisma = new PrismaService();
const genericContent = new GenericExamContentService(prisma);
const lesen = new LesenService(prisma, genericContent);
const sprachbausteine = new SprachbausteineService(prisma);
const listening = new ListeningService(prisma, genericContent);
const writing = new WritingService(
  prisma,
  new WritingDailyQuotaService(prisma),
);
const speaking = new SpeakingService(prisma);

/** Every B1 Modelltest in the training catalogue when phase 26 started. */
const GOLDEN_MODELLTESTS = [1, 2, 3, 4, 5, 6] as const;
const HOEREN_PARTS = [1, 2, 3] as const;

const fixtureDir = join(__dirname, 'fixtures');
const fixturePath = (modelltestNumber: number) =>
  join(fixtureDir, `modelltest-${modelltestNumber}.json`);

const updating = process.env.GOLDEN_UPDATE === '1';

/**
 * Fields that move on every call and carry no content.
 *
 * `issuedAt` is the moment the response was built. Scrubbed by name rather
 * than by looking for anything timestamp-shaped: a volatile field appearing
 * under a new name should fail this suite and get a deliberate decision, not
 * be swallowed by a pattern.
 */
const VOLATILE_KEYS = new Set(['issuedAt']);
const SCRUBBED = '<volatile>';

/**
 * Values that differ between databases rather than between code versions.
 *
 * The first version of this file compared them literally, so the fixtures
 * matched only the machine that captured them. CI seeds its own database and
 * failed on two counts at once:
 *
 *   ids — every `gen_random_uuid()` row key differs per seed. One Modelltest
 *   fixture carried fourteen of them. Replaced by a stable placeholder, which
 *   still asserts an id is PRESENT and well-formed without pinning its value.
 *
 *   line endings inside content — this database holds CRLF in the German
 *   text, CI's holds LF. Normalising the file's own line endings, which an
 *   earlier commit did, does not touch the bytes inside a JSON string.
 *
 * What survives is what the suite is for: which fields exist, their shapes,
 * their counts, and every piece of content a mapper could change.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ids are numbered in first-seen order rather than blanked.
 *
 * Blanking them made the fixtures portable but cost real coverage: with every
 * id reading the same token, a mapper pointing `correctTitleId` at the wrong
 * title would still have matched. Numbering keeps the relationships — one id
 * reads one token wherever it appears, a different id reads a different one —
 * while the absolute values, which differ per seeded database, never appear.
 *
 * Deterministic because `canonical` sorts keys and walks arrays in order, so
 * the same content always yields the same tokens.
 */
function idNumberer() {
  const seen = new Map<string, string>();
  return (value: string): string => {
    // split/join rather than a regex: escape sequences in a replace() get
    // mangled by every shell between here and this file.
    if (!UUID.test(value)) return value.split('\r\n').join('\n');
    if (!seen.has(value)) seen.set(value, `<id:${seen.size + 1}>`);
    return seen.get(value) as string;
  };
}

/**
 * Fixtures are written with LF and checked out with CRLF on Windows, so the
 * comparison normalizes both sides. Without this the suite passes for whoever
 * captured the fixtures and fails on every other clone and in CI.
 */
const lf = (value: string) => value.replace(/\r\n/g, '\n');

/**
 * Sorted keys so a fixture diff is readable, and both sides go through
 * `JSON.stringify` so a `Date` and its serialization never compare unequal.
 */
function canonical(value: unknown): string {
  const stable = idNumberer();
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (typeof input === 'string') return stable(input);
    if (input instanceof Date) return input.toISOString();
    if (input && typeof input === 'object') {
      const row = input as Record<string, unknown>;
      return Object.fromEntries(
        Object.keys(row)
          .sort()
          .map((key) => [
            key,
            VOLATILE_KEYS.has(key) ? SCRUBBED : normalize(row[key]),
          ]),
      );
    }
    return input;
  };
  return `${JSON.stringify(normalize(value), null, 2)}\n`;
}

async function capture(modelltestNumber: number) {
  return {
    lesen: await lesen.getExercise(modelltestNumber),
    sprachbausteine: await sprachbausteine.getExercise(modelltestNumber),
    hoeren: await Promise.all(
      HOEREN_PARTS.map((part) => listening.getExamTeil(modelltestNumber, part)),
    ),
    schreiben: await writing.getExerciseByModelltest(modelltestNumber),
    sprechen: await speaking.getTeils(modelltestNumber),
  };
}

describe('Modelltest content golden master (B1, 1–6)', () => {
  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('the catalogue under guard is exactly Modelltests 1–6, all B1', async () => {
    const rows = await prisma.modelltest.findMany({
      orderBy: { number: 'asc' },
      select: { number: true, level: true },
    });
    // If this fails, the fixtures below describe a different catalogue than
    // the database holds and the comparison means nothing.
    expect(
      rows.filter((row) => row.level === 'B1').map((row) => row.number),
    ).toEqual([...GOLDEN_MODELLTESTS]);
  });

  it.each(GOLDEN_MODELLTESTS)(
    'Modelltest %i content is unchanged',
    async (modelltestNumber) => {
      const captured = await capture(modelltestNumber);

      if (updating) {
        mkdirSync(fixtureDir, { recursive: true });
        writeFileSync(
          fixturePath(modelltestNumber),
          canonical(captured),
          'utf8',
        );
        return;
      }

      const path = fixturePath(modelltestNumber);
      if (!existsSync(path)) {
        throw new Error(
          `No golden fixture for Modelltest ${modelltestNumber}. Capture it once with ` +
            'GOLDEN_UPDATE=1 npm.cmd run test:integration -- --runInBand',
        );
      }

      expect(lf(canonical(captured))).toBe(lf(readFileSync(path, 'utf8')));
    },
  );
});
