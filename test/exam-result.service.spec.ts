/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { ExamResultService } from '../src/modules/centers/exam-result.service';

/**
 * What a candidate scored, and whether they passed.
 *
 * telc passes the two halves separately — 60% of the written block AND 60% of
 * the oral — so someone strong on paper and silent in the room fails. No
 * combined average can say that, which is why this is not an average.
 *
 * The automatic marks are percentages per Teil; the weights turn them into
 * telc's points. A perfect Sprachbausteine is 30 points and a poor Lesen
 * costs 75, so the arithmetic has to happen in points and not in percent.
 */
describe('ExamResultService', () => {
  const ATTEMPT = 'attempt-1';

  /**
   * Uuid-shaped on purpose. `writing_exercises.id` is a uuid column, so a
   * readable stand-in like 'task-b' is a value production cannot hold, and
   * the service now filters unresolvable ids by that shape before querying.
   */
  const TASK_B_ID = '3f1c8a52-9d64-4e71-b0a3-7c5e2d184af6';

  /** telc B1, as seeded: 225 written, 75 oral. */
  const weights = [
    { skill: 'LESEN', teil: 1, max_points: 25, part: 'WRITTEN' },
    { skill: 'LESEN', teil: 2, max_points: 25, part: 'WRITTEN' },
    { skill: 'LESEN', teil: 3, max_points: 25, part: 'WRITTEN' },
    { skill: 'SPRACHBAUSTEINE', teil: 1, max_points: 15, part: 'WRITTEN' },
    { skill: 'SPRACHBAUSTEINE', teil: 2, max_points: 15, part: 'WRITTEN' },
    { skill: 'HOEREN', teil: 1, max_points: 25, part: 'WRITTEN' },
    { skill: 'HOEREN', teil: 2, max_points: 25, part: 'WRITTEN' },
    { skill: 'HOEREN', teil: 3, max_points: 25, part: 'WRITTEN' },
    { skill: 'SCHREIBEN', teil: 1, max_points: 45, part: 'WRITTEN' },
    { skill: 'SPRECHEN', teil: 1, max_points: 75, part: 'ORAL' },
  ];

  let prisma: any;
  let service: ExamResultService;

  /** Every call made on the mocked client, so an N+1 can be asserted. */
  const countQueries = () =>
    Object.values(prisma)
      .flatMap((model) => Object.values(model as Record<string, unknown>))
      .filter((fn): fn is jest.Mock => typeof fn === 'function' && 'mock' in fn)
      .reduce((total, fn) => total + fn.mock.calls.length, 0);

  /** Every automatic Teil at the same percentage, which keeps the sums easy
   *  to check by hand. */
  const autoAt = (percent: number, attemptId = ATTEMPT) => ({
    // exam_attempt_id is what groups a sitting's marks by candidate in one
    // read, so the fixtures carry it as the real query selects it.
    lesen: [1, 2, 3].map((teil) => ({
      exam_attempt_id: attemptId,
      teil_id: String(teil),
      score: percent,
    })),
    sprachbausteine: [1, 2].map((teil) => ({
      exam_attempt_id: attemptId,
      teil_id: String(teil),
      score: percent,
    })),
    hoeren: [1, 2, 3].map((teil) => ({
      exam_attempt_id: attemptId,
      exercise_id: String(teil),
      score: percent,
    })),
  });

  const load = (percent: number, manual: unknown[] = []) => {
    const auto = autoAt(percent);
    prisma.lesenAttempt.findMany.mockResolvedValue(auto.lesen);
    prisma.sprachbausteineAttempt.findMany.mockResolvedValue(
      auto.sprachbausteine,
    );
    prisma.listeningAttempt.findMany.mockResolvedValue(auto.hoeren);
    prisma.examSectionResult.findMany.mockResolvedValue(
      manual.map((mark) => ({ attempt_id: ATTEMPT, ...(mark as object) })),
    );
  };

  beforeEach(() => {
    prisma = {
      examAttempt: {
        findFirst: jest.fn().mockResolvedValue({
          id: ATTEMPT,
          student_id: 'student-1',
          submitted_at: new Date(),
          released_at: null,
          session: { level: 'B1', center_id: 'center-1' },
        }),
      },
      examSectionWeight: { findMany: jest.fn().mockResolvedValue(weights) },
      examPassRule: {
        findUnique: jest.fn().mockResolvedValue({
          type: 'PART_PERCENT',
          minimum_percent: null,
          written_percent: 60,
          oral_percent: 60,
        }),
      },
      examSectionResult: { findMany: jest.fn().mockResolvedValue([]) },
      lesenAttempt: { findMany: jest.fn().mockResolvedValue([]) },
      sprachbausteineAttempt: { findMany: jest.fn().mockResolvedValue([]) },
      listeningAttempt: { findMany: jest.fn().mockResolvedValue([]) },
      writingAttempt: { findMany: jest.fn().mockResolvedValue([]) },
      speakingAttempt: { findMany: jest.fn().mockResolvedValue([]) },
      examAttemptBlock: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new ExamResultService(prisma);
  });

  describe('Schreiben text for the center marker', () => {
    const submittedAt = new Date('2026-10-04T10:00:00.000Z');

    it('returns the letter from the writing attempt', async () => {
      load(100);
      const letter = 'Sehr geehrte Damen und Herren, ich bewerbe mich.';
      prisma.writingAttempt.findMany.mockResolvedValue([
        {
          exam_attempt_id: ATTEMPT,
          content: letter,
          exercise_id: TASK_B_ID,
          score: null,
          feedback: null,
          corrections: null,
        },
      ]);
      prisma.writingExercise = {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: TASK_B_ID, part: 2, title: 'Beschwerde' }]),
      };
      prisma.examAttemptBlock.findMany.mockResolvedValue([
        {
          attempt_id: ATTEMPT,
          block: 'SCHREIBEN',
          submitted_at: submittedAt,
          answers: { text: letter },
        },
      ]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.schreibenSubmission).toEqual({
        text: letter,
        submittedAt,
        characterCount: letter.length,
        // Which of a B2 choice was answered. Criterion I is whether that
        // prompt's required points were addressed, so a trainer marking
        // without it is guessing.
        task: 'Aufgabe B — Beschwerde',
      });
    });

    /**
     * Before B2, the exam stored `exam-<modelltestId>` in `exercise_id`. Those
     * rows are still there, and `exercise_id` is text, so nothing rejected
     * them on write.
     *
     * Postgres rejects the whole statement on the first unparseable uuid, so
     * one old row used to cost every label in the batch — the current
     * candidates' labels disappeared too, and the service logged it as an
     * unreadable task. The placeholder must never reach the query.
     */
    it('keeps current labels when an older attempt carries a placeholder id', async () => {
      load(100);
      const letter = 'Sehr geehrte Damen und Herren, ich bewerbe mich.';
      prisma.writingAttempt.findMany.mockResolvedValue([
        {
          exam_attempt_id: ATTEMPT,
          content: letter,
          exercise_id: TASK_B_ID,
          score: null,
          feedback: null,
          corrections: null,
        },
        {
          exam_attempt_id: 'attempt-older',
          content: 'Ein alter Brief.',
          exercise_id: 'exam-7b3d9f20-5c41-4a68-9e02-1d8f6b4c3a95',
          score: null,
          feedback: null,
          corrections: null,
        },
      ]);
      const findMany = jest
        .fn()
        .mockResolvedValue([{ id: TASK_B_ID, part: 2, title: 'Beschwerde' }]);
      prisma.writingExercise = { findMany };
      prisma.examAttemptBlock.findMany.mockResolvedValue([
        {
          attempt_id: ATTEMPT,
          block: 'SCHREIBEN',
          submitted_at: submittedAt,
          answers: { text: letter },
        },
      ]);

      const result = await service.forAttempt(ATTEMPT);

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [TASK_B_ID] } } }),
      );
      expect(result.schreibenSubmission?.task).toBe('Aufgabe B — Beschwerde');
    });

    it('falls back to block answers when writing attempt has no content', async () => {
      load(100);
      const letter = 'Letter only on the timed block.';
      prisma.examAttemptBlock.findMany.mockResolvedValue([
        {
          attempt_id: ATTEMPT,
          block: 'SCHREIBEN',
          submitted_at: submittedAt,
          answers: { text: letter },
        },
      ]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.schreibenSubmission).toEqual({
        text: letter,
        submittedAt,
        characterCount: letter.length,
        // No writing attempt row, so no task to name.
        task: null,
      });
    });

    it('returns null text when nothing was submitted', async () => {
      load(100);
      prisma.examAttemptBlock.findMany.mockResolvedValue([
        {
          attempt_id: ATTEMPT,
          block: 'SCHREIBEN',
          submitted_at: null,
          answers: {},
        },
      ]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.schreibenSubmission).toEqual({
        text: null,
        submittedAt: null,
        characterCount: 0,
        task: null,
      });
    });

    it('returns null submission when there is no Schreiben block yet', async () => {
      load(100);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.schreibenSubmission).toBeNull();
    });

    it('keeps AI suggestions separate from the letter text', async () => {
      load(100);
      const letter = 'Text the trainer must read.';
      prisma.writingAttempt.findMany.mockResolvedValue([
        {
          exam_attempt_id: ATTEMPT,
          content: letter,
          score: 80,
          feedback: 'Gut.',
          corrections: null,
        },
      ]);
      prisma.examAttemptBlock.findMany.mockResolvedValue([
        {
          attempt_id: ATTEMPT,
          block: 'SCHREIBEN',
          submitted_at: submittedAt,
          answers: { text: letter },
        },
      ]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.schreibenSubmission?.text).toBe(letter);
      expect(result.suggestions).toEqual([
        expect.objectContaining({ skill: 'SCHREIBEN', source: 'AI' }),
      ]);
    });
  });

  describe('turning percentages into telc points', () => {
    it('weights each Teil rather than averaging them', async () => {
      // 100% of Lesen is 75 points; 100% of Sprachbausteine is 30. An average
      // would call those equal.
      load(100);

      const result = await service.forAttempt(ATTEMPT);

      const lesen = result.sections.filter((s) => s.skill === 'LESEN');
      expect(lesen.reduce((n, s) => n + (s.points ?? 0), 0)).toBe(75);
      const sb = result.sections.filter((s) => s.skill === 'SPRACHBAUSTEINE');
      expect(sb.reduce((n, s) => n + (s.points ?? 0), 0)).toBe(30);
    });

    it('rounds a Teil to whole points, because telc has no half marks', async () => {
      load(50);

      const result = await service.forAttempt(ATTEMPT);
      const teil = result.sections.find(
        (s) => s.skill === 'SPRACHBAUSTEINE' && s.teil === 1,
      )!;

      // 50% of 15 is 7.5.
      expect(teil.points).toBe(8);
    });
  });

  describe('the two halves', () => {
    it('counts the written block out of 225 and the oral out of 75', async () => {
      load(100, [
        { skill: 'SCHREIBEN', teil: 1, points: 45 },
        { skill: 'SPRECHEN', teil: 1, points: 75 },
      ]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.written).toMatchObject({ points: 225, maxPoints: 225 });
      expect(result.oral).toMatchObject({ points: 75, maxPoints: 75 });
    });

    it('keeps Sprechen out of the written total', async () => {
      // A candidate who says nothing still passes the written half. Folding
      // the oral in would make one failure look like two.
      load(100, [{ skill: 'SCHREIBEN', teil: 1, points: 45 }]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.written.points).toBe(225);
      expect(result.oral.points).toBe(0);
    });
  });

  describe("pass or fail, on telc's rule", () => {
    it('passes only when BOTH halves reach sixty per cent', async () => {
      load(60, [
        { skill: 'SCHREIBEN', teil: 1, points: 27 },
        { skill: 'SPRECHEN', teil: 1, points: 45 },
      ]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.outcome).toBe('PASSED');
    });

    it('fails a candidate who was excellent on paper and silent in the room', async () => {
      // The case an average would get wrong, and the reason telc marks the
      // halves separately.
      load(100, [
        { skill: 'SCHREIBEN', teil: 1, points: 45 },
        { skill: 'SPRECHEN', teil: 1, points: 30 },
      ]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.outcome).toBe('FAILED');
      expect(result.written.passed).toBe(true);
      expect(result.oral.passed).toBe(false);
    });

    it('fails the reverse case too', async () => {
      load(20, [
        { skill: 'SCHREIBEN', teil: 1, points: 9 },
        { skill: 'SPRECHEN', teil: 1, points: 75 },
      ]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.outcome).toBe('FAILED');
    });

    it('decides on exact points, not on what it shows', async () => {
      // 134.5 of 225 displays as 60% and is not 60%. Deciding on the rounded
      // number would pass a candidate who failed.
      load(60, [
        { skill: 'SCHREIBEN', teil: 1, points: 26 },
        { skill: 'SPRECHEN', teil: 1, points: 45 },
      ]);

      const result = await service.forAttempt(ATTEMPT);

      // 60% of each auto Teil: 15+15+15+9+9+15+15+15 = 108, +26 = 134 of 225.
      expect(result.written.points).toBe(134);
      expect(result.written.passed).toBe(false);
      expect(result.outcome).toBe('FAILED');
    });
  });

  describe("A2's rule: one combined bar, not two", () => {
    /** telc A2 — 45 written, 15 oral, 60 total. */
    const a2Weights = [
      { skill: 'LESEN', teil: 1, max_points: 15, part: 'WRITTEN' },
      { skill: 'HOEREN', teil: 1, max_points: 15, part: 'WRITTEN' },
      { skill: 'SCHREIBEN', teil: 1, max_points: 15, part: 'WRITTEN' },
      { skill: 'SPRECHEN', teil: 1, max_points: 15, part: 'ORAL' },
    ];

    beforeEach(() => {
      prisma.examSectionWeight.findMany.mockResolvedValue(a2Weights);
      prisma.examPassRule.findUnique.mockResolvedValue({
        type: 'TOTAL_PERCENT',
        minimum_percent: 60,
        written_percent: null,
        oral_percent: null,
      });
      prisma.examAttempt.findFirst.mockResolvedValue({
        id: ATTEMPT,
        student_id: 'student-1',
        submitted_at: new Date(),
        released_at: null,
        session: { level: 'A2', center_id: 'center-1' },
      });
    });

    it('passes a candidate strong on paper and silent orally, which PART_PERCENT would fail', async () => {
      // 45/45 written, 0/15 oral: 45/60 = 75% combined. The exact scenario
      // "fails a candidate who was excellent on paper and silent in the
      // room" (above) marks FAILED under B1/B2's per-half rule — A2 has no
      // separate oral bar, so this candidate passes.
      load(100, [
        { skill: 'SCHREIBEN', teil: 1, points: 15 },
        { skill: 'SPRECHEN', teil: 1, points: 0 },
      ]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.written.points).toBe(45);
      expect(result.oral.points).toBe(0);
      expect(result.outcome).toBe('PASSED');
    });

    it('fails below the combined 60%', async () => {
      // 24/60 everywhere = 40% combined.
      load(40, [
        { skill: 'SCHREIBEN', teil: 1, points: 6 },
        { skill: 'SPRECHEN', teil: 1, points: 6 },
      ]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.outcome).toBe('FAILED');
    });
  });

  describe('what the machine suggested', () => {
    it('reports the AI Schreiben score as a suggestion, not a mark', async () => {
      load(100);
      prisma.writingAttempt.findMany.mockResolvedValue([
        {
          exam_attempt_id: ATTEMPT,
          score: 71,
          feedback: 'Gute Struktur, einige Fehler bei den Artikeln.',
          corrections: [{ from: 'der Buch', to: 'das Buch' }],
        },
      ]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.suggestions).toEqual([
        expect.objectContaining({
          skill: 'SCHREIBEN',
          // 71% of Schreiben's 45 points.
          points: 32,
          maxPoints: 45,
          source: 'AI',
        }),
      ]);
      // And the mark itself is still nobody's.
      expect(result.awaiting).toContain('SCHREIBEN');
    });

    it('hands the examiner the transcript to read', async () => {
      load(100);
      prisma.speakingAttempt.findMany.mockResolvedValue([
        {
          exam_attempt_id: ATTEMPT,
          teil_number: 1,
          transcript: 'Ich heisse Marie und komme aus Douala.',
          score: 68,
          evaluation: { grammar: 70, vocabulary: 66 },
        },
      ]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.suggestions).toEqual([
        expect.objectContaining({
          skill: 'SPRECHEN',
          transcript: 'Ich heisse Marie und komme aus Douala.',
          source: 'AI',
        }),
      ]);
    });

    it('suggests nothing on a sitting that bought nothing', async () => {
      load(100);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.suggestions).toEqual([]);
    });

    it('never lets a suggestion count toward the verdict', async () => {
      // The whole rule. A machine's opinion beside an examiner's is a second
      // opinion; a machine's opinion instead of one is a different product.
      load(100);
      prisma.writingAttempt.findMany.mockResolvedValue([
        {
          exam_attempt_id: ATTEMPT,
          score: 100,
          feedback: null,
          corrections: null,
        },
      ]);
      prisma.speakingAttempt.findMany.mockResolvedValue([
        {
          exam_attempt_id: ATTEMPT,
          teil_number: 1,
          transcript: 'x',
          score: 100,
          evaluation: {},
        },
      ]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.outcome).toBe('INCOMPLETE');
      expect(result.awaiting).toEqual(['SCHREIBEN', 'SPRECHEN']);
      expect(result.oral.points).toBe(0);
    });
  });

  describe('a whole sitting at once', () => {
    const attemptsFor = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `attempt-${i}`,
        student_id: `student-${i}`,
        submitted_at: new Date(),
        released_at: null,
        student: {
          first_name: `First${i}`,
          last_name: `Last${i}`,
          email: `s${i}@example.com`,
        },
      }));

    beforeEach(() => {
      prisma.examSession = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'session-1',
          level: 'B1',
          attempts: attemptsFor(3),
          participants: [],
        }),
      };
      load(100, []);
    });

    it('reads the sitting in a fixed number of queries, not one per candidate', async () => {
      // A school with four hundred candidates would otherwise mean sixteen
      // hundred round trips to draw one table.
      const before = countQueries();

      await service.forSession('center-1', 'session-1');

      const perCandidate = countQueries() - before;
      // 7, not 6: forSession now also reads the level's exam_pass_rules row
      // once, alongside exam_section_weights — still fixed, not per-candidate.
      expect(perCandidate).toBeLessThanOrEqual(7);
    });

    it('returns one row per candidate, named', async () => {
      const table = await service.forSession('center-1', 'session-1');

      expect(table.candidates).toHaveLength(3);
      expect(table.candidates[0]).toMatchObject({
        studentId: 'student-0',
        firstName: 'First0',
        outcome: 'INCOMPLETE',
      });
    });

    it('counts what the manager needs to see at a glance', async () => {
      const table = await service.forSession('center-1', 'session-1');

      expect(table.summary).toMatchObject({
        candidates: 3,
        awaitingMarks: 3,
        released: 0,
      });
    });

    it('includes an admitted candidate who never turned up', async () => {
      // A no-show is a row with nothing in it, not a missing row: a manager
      // reconciling fifteen names against twelve results needs the three.
      prisma.examSession.findFirst.mockResolvedValue({
        id: 'session-1',
        level: 'B1',
        attempts: attemptsFor(1),
        participants: [
          {
            student_id: 'absent-1',
            student: {
              first_name: 'Absent',
              last_name: 'One',
              email: 'absent@example.com',
            },
          },
        ],
      });

      const table = await service.forSession('center-1', 'session-1');

      expect(table.candidates).toHaveLength(2);
      expect(
        table.candidates.find((c) => c.studentId === 'absent-1'),
      ).toMatchObject({ outcome: 'NOT_TAKEN', attemptId: null });
    });

    it('refuses a sitting belonging to another center', async () => {
      prisma.examSession.findFirst.mockResolvedValue(null);

      await expect(service.forSession('center-1', 'session-1')).rejects.toThrow(
        'EXAM_SESSION_NOT_FOUND',
      );
    });
  });

  describe('while marks are missing', () => {
    it('says incomplete rather than guessing a verdict', async () => {
      // Sprechen happens in a room, days later. Calling that a fail would
      // fail every candidate the moment they put their pen down.
      load(100, [{ skill: 'SCHREIBEN', teil: 1, points: 45 }]);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.outcome).toBe('INCOMPLETE');
      expect(result.awaiting).toEqual(['SPRECHEN']);
    });

    it('names every mark it is still waiting for', async () => {
      load(100);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.awaiting).toEqual(['SCHREIBEN', 'SPRECHEN']);
    });

    it('still reports the halves, so a manager sees where they stand', async () => {
      load(100);

      const result = await service.forAttempt(ATTEMPT);

      expect(result.written.points).toBe(180);
      expect(result.oral.points).toBe(0);
    });
  });
});
