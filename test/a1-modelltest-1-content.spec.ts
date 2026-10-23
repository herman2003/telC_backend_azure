/**
 * The A1 Modelltest 1 source against telc's own Lösungsschlüssel
 * (telc Start Deutsch 1, Übungstest 1, page 36).
 *
 * The key below is typed from the printed answer key, not copied from the
 * JSON: a wrong answer in the content file is exactly what this test exists
 * to catch, and a test derived from the file would agree with it.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface Item {
  number: number;
  solution: { key?: string; value?: boolean };
}
interface Field {
  number: number;
  inputType: string;
  choices?: string[];
  solution: { acceptedAnswers: string[] };
}
interface Section {
  sectionId: string;
  aufgabentyp: string;
  scoring: { mode: string; maxPoints: number };
  content: { items?: Item[]; fields?: Field[] };
}

const source = JSON.parse(
  readFileSync(
    resolve(__dirname, '..', 'content', 'a1-modelltest-1-source.json'),
    'utf8',
  ),
) as {
  modelltest: { level: string };
  format: {
    hoerenDelivery: {
      recordings: { teil: number; durationSeconds: number; audioUrl: string }[];
    };
  };
  sections: Record<string, Section[]>;
};

const sections = Object.values(source.sections).flat();
const section = (id: string): Section => {
  const found = sections.find((s) => s.sectionId === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};

/** Lösungsschlüssel: a/b/c, or + (richtig) / – (falsch). */
const KEY: Record<string, Record<number, string>> = {
  HOEREN_1: { 1: 'c', 2: 'b', 3: 'a', 4: 'b', 5: 'a', 6: 'c' },
  HOEREN_2: { 7: '-', 8: '-', 9: '+', 10: '+' },
  HOEREN_3: { 11: 'a', 12: 'c', 13: 'c', 14: 'b', 15: 'b' },
  LESEN_1: { 1: '+', 2: '-', 3: '-', 4: '-', 5: '+' },
  LESEN_2: { 6: 'b', 7: 'a', 8: 'a', 9: 'a', 10: 'b' },
  LESEN_3: { 11: '+', 12: '-', 13: '-', 14: '+', 15: '+' },
};

const asKey = (item: Item): string =>
  item.solution.key ?? (item.solution.value ? '+' : '-');

describe('A1 Modelltest 1 content', () => {
  it('is an A1 paper', () => {
    expect(source.modelltest.level).toBe('A1');
  });

  it.each(Object.entries(KEY))(
    '%s matches the Lösungsschlüssel',
    (id, expected) => {
      const items = section(id).content.items ?? [];
      const actual = Object.fromEntries(
        items.map((item) => [item.number, asKey(item)]),
      );
      expect(actual).toEqual(
        Object.fromEntries(
          Object.entries(expected).map(([n, k]) => [Number(n), k]),
        ),
      );
    },
  );

  it('gives each automatic Teil one point per item', () => {
    for (const id of Object.keys(KEY)) {
      const s = section(id);
      expect(s.scoring.mode).toBe('AUTO');
      expect(s.scoring.maxPoints).toBe(s.content.items?.length);
    }
  });

  it('Schreiben Teil 1 accepts the key and nothing that contradicts it', () => {
    const fields = section('SCHREIBEN_1').content.fields ?? [];
    const answers = Object.fromEntries(
      fields.map((f) => [f.number, f.solution.acceptedAnswers]),
    );

    expect(answers[1]).toContain('4');
    expect(answers[2]).toContain('2');
    expect(answers[3]).toEqual(['Seeheim']);
    expect(answers[4]).toEqual(['Bar']);
    expect(answers[5]).toContain('Sonntag');
    // telc: numbers must be exactly right.
    expect(answers[1].every((a) => ['4', 'vier'].includes(a))).toBe(true);
    expect(answers[2].every((a) => ['2', 'zwei'].includes(a))).toBe(true);

    const payment = fields.find((f) => f.number === 4);
    expect(payment?.inputType).toBe('CHOICE');
    expect(payment?.choices).toEqual(['Bar', 'Kreditkarte']);
  });

  it('adds up to the official 15 / 15 / 15 / 15', () => {
    const total = (skill: string) =>
      source.sections[skill].reduce((sum, s) => sum + s.scoring.maxPoints, 0);

    expect(total('HOEREN')).toBe(15);
    expect(total('LESEN')).toBe(15);
    expect(total('SCHREIBEN')).toBe(15);
    expect(total('SPRECHEN')).toBe(15);
  });

  it('has the three uploaded Hören recordings, rounded up to whole seconds', () => {
    const recordings = source.format.hoerenDelivery.recordings;

    expect(recordings.map((r) => [r.teil, r.durationSeconds])).toEqual([
      [1, 492],
      [2, 231],
      [3, 292],
    ]);
    for (const r of recordings) {
      expect(r.audioUrl).toMatch(
        new RegExp(
          `/a1-mt-1-hoeren/a1-modelltest-1-hoeren-teil${r.teil}\\.mp3$`,
        ),
      );
    }
  });
});
