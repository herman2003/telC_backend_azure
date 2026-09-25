import { readFileSync } from 'fs';

/**
 * Exam work must never appear in training.
 *
 * The four attempt tables hold both: a Teil practised at home and the same
 * Teil sat under exam conditions, told apart only by `exam_attempt_id`. Every
 * training read has to say so, and until this test existed none of them did —
 * the schema comments claimed the filter and the code never had it.
 *
 * What that cost, concretely: a candidate finishes an exam, opens their own
 * history, and reads scores their center has not released. And the center's
 * dashboard counts an exam as practice, so a student who has only ever sat
 * one looks fully prepared for it.
 *
 * The scan is over source rather than behaviour because the risk is a NEW
 * read, written next year by someone who has never heard of exams.
 */
describe('exam work stays out of training reads', () => {
  /** Every read of the four tables a candidate writes to during an exam. */
  const TRAINING_READS: { file: string; model: string }[] = [
    { file: 'src/modules/lesen/lesen.service.ts', model: 'lesenAttempt' },
    {
      file: 'src/modules/listening/listening.service.ts',
      model: 'listeningAttempt',
    },
    {
      file: 'src/modules/sprachbausteine/sprachbausteine.service.ts',
      model: 'sprachbausteineAttempt',
    },
    { file: 'src/modules/writing/writing.service.ts', model: 'writingAttempt' },
    // Added when the AI tier put a speaking session inside an exam. Sprechen
    // was outside the exam when the other four were listed, which is exactly
    // how a table gets missed.
    {
      file: 'src/modules/speaking/services/speaking.service.ts',
      model: 'speakingAttempt',
    },
  ];

  const READING_METHODS = [
    'findMany',
    'findFirst',
    'count',
    'aggregate',
    'groupBy',
  ];

  /**
   * Each read, with the block that follows it.
   *
   * Found by hand rather than by one regex: an earlier version used a lazy
   * `[\s\S]{0,400}?` and matched NOTHING, so the suite failed on "found no
   * reads" while looking like it had caught the bug. A scan that can pass for
   * the wrong reason is worse than no scan, which is why the count is
   * asserted before the contents are.
   */
  const readsOf = (source: string, model: string): string[] => {
    const found: string[] = [];
    for (const method of READING_METHODS) {
      const needle = `prisma.${model}.${method}({`;
      let at = source.indexOf(needle);
      while (at !== -1) {
        found.push(source.slice(at, at + 600));
        at = source.indexOf(needle, at + 1);
      }
    }
    return found;
  };

  it.each(TRAINING_READS)(
    '$file filters every $model read on exam_attempt_id',
    ({ file, model }) => {
      const reads = readsOf(readFileSync(file, 'utf8'), model);

      // The scan must find something, or it proves nothing.
      expect(reads.length).toBeGreaterThan(0);

      const unfiltered = reads
        .filter((read) => !read.includes('exam_attempt_id: null'))
        .map((read) => read.slice(0, 100));

      expect(unfiltered).toEqual([]);
    },
  );

  it('names a column the schema actually has', () => {
    // If the column is ever renamed, the scan above would go quiet by
    // matching nothing meaningful. This is what stops that.
    const schema = readFileSync('prisma/schema.prisma', 'utf8');

    expect(schema).toContain('exam_attempt_id String?');
  });
});
