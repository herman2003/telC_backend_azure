import type { CefrLevel } from '@prisma/client';
import {
  SPEAKING_TOPICS,
  SpeakingTopic,
} from '../src/modules/speaking/room/speaking-topics.data';

/**
 * The Live Room catalogue, per level.
 *
 * This suite asserted that every card in the file was B1 with a `b1-` id, a
 * description that was accurate only while B1 was the only level. The ten B2
 * cards made it false, so the counts are stated per level and the structural
 * checks — which are what actually protect a room from a malformed card —
 * apply to the whole catalogue.
 */
const EXPECTED_PER_LEVEL: Array<{ level: CefrLevel; count: number }> = [
  { level: 'B1', count: 60 },
  { level: 'B2', count: 10 },
];

const topicsAt = (level: CefrLevel) =>
  SPEAKING_TOPICS.filter((topic) => topic.level === level);

describe('speaking topic catalog', () => {
  it.each(EXPECTED_PER_LEVEL)(
    'contains $count Teil 2 topics at $level',
    ({ level, count }) => {
      expect(topicsAt(level)).toHaveLength(count);
    },
  );

  it('holds no level beyond the ones counted above', () => {
    // So a card added at a level nobody listed here is noticed rather than
    // served silently.
    const counted = EXPECTED_PER_LEVEL.map((row) => row.level);
    expect(
      SPEAKING_TOPICS.every((topic) => counted.includes(topic.level)),
    ).toBe(true);
  });

  it('is Teil 2 throughout', () => {
    expect(SPEAKING_TOPICS.every((topic) => topic.teil === 2)).toBe(true);
  });

  it('uses unique ids, prefixed by their own level', () => {
    const ids = SPEAKING_TOPICS.map((topic) => topic.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of SPEAKING_TOPICS) {
      // A B2 card carrying a b1- id would be invisible in a level-filtered
      // read and confusing in every log line that quotes it.
      expect(topic.id).toMatch(
        new RegExp(`^${topic.level.toLowerCase()}-t2-[0-9]{3}$`),
      );
    }
  });

  it('provides complete discussion material for every topic', () => {
    for (const topic of SPEAKING_TOPICS) {
      expectNonEmpty(topic, 'title');
      expectNonEmpty(topic, 'positionA');
      expectNonEmpty(topic, 'positionB');
      expect(topic.positionA).not.toBe(topic.positionB);
      expect(topic.followUpQuestions.length).toBeGreaterThanOrEqual(2);
      expect(topic.followUpQuestions.length).toBeLessThanOrEqual(4);
      expect(
        topic.followUpQuestions.every((question) => question.trim().length > 0),
      ).toBe(true);
    }
  });

  it('has no duplicate titles within a level', () => {
    for (const { level } of EXPECTED_PER_LEVEL) {
      const titles = topicsAt(level).map((topic) => topic.title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });
});

function expectNonEmpty(
  topic: SpeakingTopic,
  field: 'title' | 'positionA' | 'positionB',
): void {
  expect(topic[field].trim().length).toBeGreaterThan(0);
}
