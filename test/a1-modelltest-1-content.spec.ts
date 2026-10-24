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
  options?: { key: string; text: string; imageUrl?: string | null }[];
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
  content: {
    items?: Item[];
    fields?: Field[];
    texts?: {
      forItems: number[];
      body: string;
      imageUrl?: string | null;
    }[];
    rubric?: unknown;
    rounds?: {
      topic?: string;
      cards: { text: string; imageUrl?: string | null }[];
    }[];
  };
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
  assets: { imageUrl: string; sourcePages: number[] }[];
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

  it('carries the Bewertungsbogen rubrics', () => {
    // Schreiben Teil 2: 3 / 1.5 / 0 per point, Kommunikative Gestaltung
    // 1 / 0.5 / 0 (page 34). Sprechen: M10 telc Deutsch A1 (page 35).
    expect(section('SCHREIBEN_2').content.rubric).toEqual({
      contentPoints: { selectRequired: 3, pointsPerPoint: [3, 1.5, 0] },
      communicativeDesign: { points: [1, 0.5, 0] },
    });
    expect(section('SPRECHEN_1').content.rubric).toEqual({
      vorstellen: [1, 0.5, 0],
      buchstabieren: [1, 0.5, 0],
      zahlen: [1, 0.5, 0],
    });
    expect(section('SPRECHEN_2').content.rubric).toEqual({
      frage: [2, 1, 0],
      antwort: [1, 0.5, 0],
    });
    expect(section('SPRECHEN_3').content.rubric).toEqual({
      bitte: [2, 1, 0],
      reaktion: [1, 0.5, 0],
    });
  });

  it('has the Sprechen cards as printed', () => {
    const rounds = (id: string) =>
      (section(id).content.rounds ?? []).map((r) => ({
        topic: r.topic,
        cards: r.cards.map((c) => c.text),
      }));

    expect(rounds('SPRECHEN_2')).toEqual([
      {
        topic: 'Essen und Trinken',
        cards: [
          'Frühstück',
          'Lieblingsessen',
          'Sonntag',
          'Bier',
          'Fisch',
          'Brot',
        ],
      },
      {
        topic: 'Einkaufen',
        cards: ['Zeitung', 'Kasse', 'Obst', 'Schuhe', 'Buch', 'Stadtplan'],
      },
    ]);
    // Picture cards (page 27): twelve objects, named by us.
    const teil3 = rounds('SPRECHEN_3');
    expect(teil3).toHaveLength(1);
    expect([...teil3[0].cards].sort()).toEqual(
      [
        'Äpfel',
        'Auto',
        'Banane',
        'Blumen',
        'Einkaufskorb',
        'Fleisch',
        'Hund',
        'Koffer',
        'Kuchen',
        'Laptop',
        'Orangensaft',
        'Schlüssel',
      ].sort(),
    );
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

  it('points every Exam Day picture at its R2 object, text kept as fallback', () => {
    const base =
      'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/a1-mt-hoeren/a1-mt-1-hoeren/a1-mt-images-1/';

    const hoeren1 = section('HOEREN_1').content.items ?? [];
    expect(hoeren1).toHaveLength(6);
    for (const item of hoeren1) {
      for (const o of item.options ?? []) {
        expect(o.text.length).toBeGreaterThan(0);
        expect(o.imageUrl).toBe(
          `${base}a1-modelltest-1-hoeren-1-item${item.number}-${o.key}.png`,
        );
      }
    }

    const lesen3Texts = section('LESEN_3').content.texts ?? [];
    expect(lesen3Texts.map((t) => t.imageUrl)).toEqual(
      [11, 12, 13, 14, 15].map(
        (n) => `${base}a1-modelltest-1-lesen-3-item${n}.png`,
      ),
    );

    const cards = (section('SPRECHEN_3').content.rounds ?? [])[0].cards;
    expect(
      cards.every((c) => (c.imageUrl ?? '').includes('sprechen-3-card-')),
    ).toBe(true);

    expect(source.assets).toHaveLength(46);
    expect(source.assets.every((a) => a.imageUrl.startsWith(base))).toBe(true);
    expect(
      source.assets
        .filter((a) => a.imageUrl.includes('sprechen-3-card-'))
        .every((a) => a.sourcePages[0] === 26),
    ).toBe(true);
  });
});
