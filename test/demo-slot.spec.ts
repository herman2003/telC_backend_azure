import { validateDemoSlot } from '../src/modules/vitrine/demo-slot';

describe('validateDemoSlot', () => {
  // Fixed "now": Monday 2026-10-12 10:00 Berlin (CEST = UTC+2)
  const now = new Date('2026-10-12T08:00:00.000Z');

  it('accepts a Tuesday morning Berlin slot inside the window', () => {
    // 2026-10-13 09:00 Berlin = 07:00 UTC
    const result = validateDemoSlot('2026-10-13T07:00:00.000Z', now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.berlinLabel).toMatch(/13/);
    }
  });

  it('rejects Sunday', () => {
    const result = validateDemoSlot('2026-10-18T07:00:00.000Z', now);
    expect(result).toEqual({ ok: false, reason: 'SLOT_INVALID' });
  });

  it('rejects hours outside demo windows', () => {
    // 13:00 Berlin
    const result = validateDemoSlot('2026-10-13T11:00:00.000Z', now);
    expect(result).toEqual({ ok: false, reason: 'SLOT_INVALID' });
  });

  it('rejects today (must be from tomorrow)', () => {
    const result = validateDemoSlot('2026-10-12T07:00:00.000Z', now);
    expect(result).toEqual({ ok: false, reason: 'SLOT_OUTSIDE_WINDOW' });
  });
});
