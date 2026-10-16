import type { TeilScore } from './progress-formula';
import { sessionOfDay } from './session-of-day';

const NOW = new Date('2026-09-19T12:00:00Z'); // Saturday
const OTHER_DAY = new Date('2026-09-20T12:00:00Z');

describe('sessionOfDay', () => {
  it('picks the weakest practised skill and its weakest Teil', () => {
    const teils: TeilScore[] = [
      { skill: 'LESEN', teil: 1, score: 80 },
      { skill: 'LESEN', teil: 2, score: 70 },
      { skill: 'LESEN', teil: 3, score: 75 },
      { skill: 'HOEREN', teil: 1, score: 90 },
      { skill: 'HOEREN', teil: 2, score: 40 },
      { skill: 'HOEREN', teil: 3, score: 50 },
    ];

    const session = sessionOfDay(teils, {
      studentId: 'stu-1',
      now: NOW,
    });

    expect(session).toEqual({
      moduleId: 'hoeren',
      teil: 2,
      durationMinutes: 10,
      mode: 'training',
      maxListens: 3,
      weaknessPercent: 40,
    });
  });

  it('treats an unattempted Teil as 0 when choosing within the skill', () => {
    // HOEREN mean = (90+60+0)/3 = 50; LESEN mean = 80 → HOEREN weaker
    const teils: TeilScore[] = [
      { skill: 'HOEREN', teil: 1, score: 90 },
      { skill: 'HOEREN', teil: 2, score: 60 },
      { skill: 'LESEN', teil: 1, score: 80 },
      { skill: 'LESEN', teil: 2, score: 80 },
      { skill: 'LESEN', teil: 3, score: 80 },
    ];

    const session = sessionOfDay(teils, {
      studentId: 'stu-1',
      now: NOW,
    });

    expect(session.moduleId).toBe('hoeren');
    expect(session.teil).toBe(3);
    expect(session.weaknessPercent).toBe(0);
    expect(session.mode).toBe('training');
  });

  it('uses exam mode and 2 listens when the Teil is at or above 60', () => {
    const teils: TeilScore[] = [
      { skill: 'HOEREN', teil: 1, score: 70 },
      { skill: 'HOEREN', teil: 2, score: 65 },
      { skill: 'HOEREN', teil: 3, score: 80 },
    ];

    const session = sessionOfDay(teils, {
      studentId: 'stu-1',
      now: NOW,
    });

    expect(session).toMatchObject({
      moduleId: 'hoeren',
      teil: 2,
      mode: 'exam',
      maxListens: 2,
      weaknessPercent: 65,
    });
  });

  it('decides mode on the exact score, then rounds weaknessPercent', () => {
    // 59.6 rounds to 60 for display, but must stay training (< 60 exact).
    const training = sessionOfDay(
      [
        { skill: 'HOEREN', teil: 1, score: 59.6 },
        { skill: 'HOEREN', teil: 2, score: 90 },
        { skill: 'HOEREN', teil: 3, score: 90 },
      ],
      { studentId: 'stu-1', now: NOW },
    );
    expect(training).toMatchObject({
      teil: 1,
      weaknessPercent: 60,
      mode: 'training',
      maxListens: 3,
    });

    const exam = sessionOfDay(
      [
        { skill: 'HOEREN', teil: 1, score: 60 },
        { skill: 'HOEREN', teil: 2, score: 90 },
        { skill: 'HOEREN', teil: 3, score: 90 },
      ],
      { studentId: 'stu-1', now: NOW },
    );
    expect(exam).toMatchObject({
      teil: 1,
      weaknessPercent: 60,
      mode: 'exam',
      maxListens: 2,
    });
  });

  it('leaves maxListens null for non-listening modules', () => {
    const teils: TeilScore[] = [
      { skill: 'SCHREIBEN', teil: 1, score: 30 },
      { skill: 'LESEN', teil: 1, score: 90 },
      { skill: 'LESEN', teil: 2, score: 90 },
      { skill: 'LESEN', teil: 3, score: 90 },
    ];

    const session = sessionOfDay(teils, {
      studentId: 'stu-1',
      now: NOW,
    });

    expect(session.moduleId).toBe('schreiben');
    expect(session.teil).toBe(1);
    expect(session.maxListens).toBeNull();
    expect(session.mode).toBe('training');
  });

  it('rotates a beginner by calendar day when nothing is practised', () => {
    const a = sessionOfDay([], { studentId: 'stu-beginner', now: NOW });
    const b = sessionOfDay([], { studentId: 'stu-beginner', now: OTHER_DAY });
    const sameDay = sessionOfDay([], {
      studentId: 'stu-beginner',
      now: NOW,
    });

    expect(a.weaknessPercent).toBe(0);
    expect(a.mode).toBe('training');
    expect(sameDay).toEqual(a);
    // Different day → different seed; may or may not differ module, but
    // must stay a valid session.
    expect(['hoeren', 'lesen', 'sprachbausteine', 'schreiben', 'sprechen']).toContain(
      b.moduleId,
    );
    expect(b.teil).toBeGreaterThanOrEqual(1);
  });

  it('is stable for the same student and day', () => {
    const teils: TeilScore[] = [
      { skill: 'LESEN', teil: 1, score: 50 },
      { skill: 'LESEN', teil: 2, score: 50 },
      { skill: 'LESEN', teil: 3, score: 50 },
      { skill: 'HOEREN', teil: 1, score: 50 },
      { skill: 'HOEREN', teil: 2, score: 50 },
      { skill: 'HOEREN', teil: 3, score: 50 },
    ];

    const first = sessionOfDay(teils, { studentId: 'tie-stu', now: NOW });
    const second = sessionOfDay(teils, { studentId: 'tie-stu', now: NOW });

    expect(first).toEqual(second);
  });
});
