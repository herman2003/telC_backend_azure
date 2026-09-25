import {
  ACCESS_WINDOW_HOURS,
  ExamSessionPolicyService,
  type ExamSessionRecord,
} from '../src/modules/centers/exam-session-policy.service';

/**
 * What state a sitting is in, and what may be done to it.
 *
 * No status is stored, for the reason CenterSubscription stores none: a
 * status column needs a job to keep it true, and the direction it fails in is
 * letting a closed exam be taken. These are the timestamps; this is the rule.
 */
describe('ExamSessionPolicyService', () => {
  const policy = new ExamSessionPolicyService();

  const HOUR = 60 * 60 * 1000;
  const now = new Date('2026-10-05T12:00:00.000Z');
  const at = (hoursFromNow: number) =>
    new Date(now.getTime() + hoursFromNow * HOUR);

  const session = (
    over: Partial<ExamSessionRecord> = {},
  ): ExamSessionRecord => ({
    opens_at: at(-1),
    closes_at: at(47),
    published_at: at(-24),
    cancelled_at: null,
    force_closed_at: null,
    ...over,
  });

  describe('the status it derives', () => {
    it('calls an unpublished sitting a draft, whatever its dates say', () => {
      // A draft with an opening time in the past is an ordinary thing: the
      // manager set a date, went to lunch, and came back tomorrow.
      expect(
        policy.statusOf(
          session({ published_at: null, opens_at: at(-48) }),
          now,
        ),
      ).toBe('DRAFT');
    });

    it('calls a published sitting scheduled until its opening minute', () => {
      expect(policy.statusOf(session({ opens_at: at(1) }), now)).toBe(
        'SCHEDULED',
      );
    });

    it('opens it at the opening minute, with nothing having run', () => {
      // The whole point of deriving: no job, no cron, no flag flip. The clock
      // passes and the answer changes.
      const sitting = session({ opens_at: at(0) });

      expect(policy.statusOf(sitting, now)).toBe('OPEN');
    });

    it('closes it once the window has passed', () => {
      expect(policy.statusOf(session({ closes_at: at(-1) }), now)).toBe(
        'CLOSED',
      );
    });

    it('closes it early when the center said so', () => {
      expect(policy.statusOf(session({ force_closed_at: at(-1) }), now)).toBe(
        'CLOSED',
      );
    });

    it('reports cancelled ahead of everything else', () => {
      // A cancelled sitting inside its own window is still cancelled. Reading
      // the window first would reopen an exam the center called off.
      expect(policy.statusOf(session({ cancelled_at: at(-2) }), now)).toBe(
        'CANCELLED',
      );
    });

    it('reports cancelled even for a draft, so a cancelled draft is not editable', () => {
      expect(
        policy.statusOf(
          session({ published_at: null, cancelled_at: at(-2) }),
          now,
        ),
      ).toBe('CANCELLED');
    });
  });

  describe('may a candidate start', () => {
    it('allows it only while the sitting is open', () => {
      expect(policy.mayStart(session(), now)).toBe(true);
    });

    it.each([
      ['a draft', { published_at: null }],
      ['one that has not opened', { opens_at: at(1) }],
      ['one whose window passed', { closes_at: at(-1) }],
      ['one closed by the center', { force_closed_at: at(-1) }],
      ['a cancelled one', { cancelled_at: at(-2) }],
    ])('refuses %s', (_case, over) => {
      expect(policy.mayStart(session(over), now)).toBe(false);
    });
  });

  describe('may the center still edit it', () => {
    it('allows a draft to be changed', () => {
      expect(policy.mayEdit(session({ published_at: null }), now)).toBe(true);
    });

    it('allows a published sitting to be changed before it opens', () => {
      // Publishing is not a freeze. Until a candidate can start, changing the
      // Modelltest or the list harms nobody.
      expect(policy.mayEdit(session({ opens_at: at(1) }), now)).toBe(true);
    });

    it('refuses once it has opened, because someone may be sitting it', () => {
      expect(policy.mayEdit(session(), now)).toBe(false);
    });

    it('refuses a closed sitting, whose results are being marked', () => {
      expect(policy.mayEdit(session({ closes_at: at(-1) }), now)).toBe(false);
    });

    it('refuses a cancelled sitting', () => {
      expect(policy.mayEdit(session({ cancelled_at: at(-1) }), now)).toBe(
        false,
      );
    });
  });

  describe('the access window', () => {
    it('offers exactly the three windows the product sells', () => {
      expect(ACCESS_WINDOW_HOURS).toEqual([24, 48, 72]);
    });

    it('closes a 48-hour sitting two days after it opens', () => {
      expect(policy.closesAt(new Date('2026-10-05T09:00:00.000Z'), 48)).toEqual(
        new Date('2026-10-07T09:00:00.000Z'),
      );
    });

    it('refuses a window nobody sells', () => {
      // 48 hours of access is a product decision, not a number a client may
      // choose. Accepting 8760 would sell a permanent exam.
      expect(() => policy.closesAt(now, 12)).toThrow('ACCESS_WINDOW_INVALID');
    });
  });
});
