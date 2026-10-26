import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  ANSWER_KEY_FIELDS,
  withoutAnswerKey,
} from '../src/modules/centers/exam-content';

/**
 * The claim the exam rests on: a candidate never receives the answers.
 *
 * Training ships the key with the exercise on purpose — a student correcting
 * offline needs it. This is the one case that decision did not cover, and
 * getting it wrong is not a bug a manager notices: every candidate scores
 * 100% and the sitting is worthless.
 *
 * The last tests read the DTOs themselves, so a field added to a Teil next
 * year is caught here rather than in an exam.
 */
describe('exam content carries no answers', () => {
  describe('withoutAnswerKey', () => {
    it('removes the answer from a Lesen Teil 1 text', () => {
      const stripped = withoutAnswerKey({
        id: '1',
        von: 'Anna',
        body: 'Text',
        correctTitleId: 'title-4',
      });

      expect(stripped).toEqual({ id: '1', von: 'Anna', body: 'Text' });
    });

    it('reaches answers nested inside arrays', () => {
      const stripped = withoutAnswerKey({
        teil2: {
          questions: [
            { id: '6', prompt: 'Warum?', correctOptionId: '6b' },
            { id: '7', prompt: 'Wann?', correctOptionId: '7a' },
          ],
        },
      });

      expect(JSON.stringify(stripped)).not.toContain('correctOptionId');
      expect(stripped.teil2.questions[0]).toEqual({
        id: '6',
        prompt: 'Warum?',
      });
    });

    it('keeps the option itself, which is what the candidate picks from', () => {
      // Only the answer goes. An exam with no options to choose between is
      // as broken as one with the answers in it.
      const stripped = withoutAnswerKey({
        options: [
          { id: '6a', text: 'weil' },
          { id: '6b', text: 'obwohl', isCorrect: true },
        ],
      });

      expect(stripped.options).toEqual([
        { id: '6a', text: 'weil' },
        { id: '6b', text: 'obwohl' },
      ]);
    });

    it("strips the generic model's (A1/A2) per-item solution", () => {
      // GenericSectionContent's items[].solution is the A1/A2 answer key --
      // {key:'a'}, {value:true}, {acceptedAnswers:[...]}, {choiceKey:'b'}.
      // Not a /correct.../-named field, so this guards a shape the DTO scan
      // below (B1-specific dto/ directories) cannot see.
      const stripped = withoutAnswerKey({
        itemNumber: 1,
        prompt: 'Frage?',
        solution: { key: 'a' },
        options: [{ key: 'a', content: 'Antwort', isCorrect: true }],
      });

      expect(stripped).toEqual({
        itemNumber: 1,
        prompt: 'Frage?',
        options: [{ key: 'a', content: 'Antwort' }],
      });
    });

    it('leaves dates alone rather than emptying them', () => {
      // A Date walked as a plain object comes back as {}, and the exam
      // renders with no dates in it.
      const createdAt = new Date('2026-10-05T09:00:00.000Z');

      expect(withoutAnswerKey({ createdAt }).createdAt).toEqual(createdAt);
    });

    it('leaves a payload with nothing to hide untouched', () => {
      const payload = { instruction: 'Lesen Sie', teile: [1, 2, 3] };

      expect(withoutAnswerKey(payload)).toEqual(payload);
    });
  });

  /**
   * The regression guard, at the source rather than through a fixture.
   *
   * An earlier version of this ran the real builders against hand-made rows
   * and asserted the output. It kept breaking on the fixtures rather than on
   * the thing it was guarding — and a fixture that drifts silently guards
   * nothing. This reads the DTOs themselves: every field a client-facing DTO
   * declares that looks like an answer must be one this strips.
   */
  describe('every answer field in the DTOs is covered', () => {
    const DTO_DIRS = [
      'src/modules/lesen/dto',
      'src/modules/sprachbausteine/dto',
      'src/modules/listening/dto',
    ];

    const declaredAnswerFields = () => {
      const found = new Map<string, string>();
      for (const dir of DTO_DIRS) {
        for (const file of readdirSync(dir)) {
          if (!file.endsWith('.ts')) continue;
          const source = readFileSync(join(dir, file), 'utf8');
          // `  correctTitleId!: string;` and friends.
          for (const [, name] of source.matchAll(
            /^\s{2}(\w*[Cc]orrect\w*)[!?]?\s*:/gm,
          )) {
            found.set(name, `${dir}/${file}`);
          }
        }
      }
      return found;
    };

    it('strips every field whose name says it holds an answer', () => {
      // Add a `correctSomething` to a DTO and forget ANSWER_KEY_FIELDS, and
      // every candidate in every exam scores full marks. This is the test
      // that fails instead.
      const missing = [...declaredAnswerFields()].filter(
        ([name]) => !ANSWER_KEY_FIELDS.includes(name),
      );

      expect(missing).toEqual([]);
    });

    it('finds the fields at all, so the scan cannot pass vacuously', () => {
      const names = [...declaredAnswerFields().keys()];

      expect(names).toEqual(
        expect.arrayContaining([
          'correctTitleId',
          'correctOptionId',
          'correctAnswer',
          'correctWordId',
        ]),
      );
    });
  });
});
