/**
 * Same business rules as the vitrine calendar (`sprach` demo-slots):
 * Mon–Sat, Europe/Berlin, 07:00–12:00 and 16:00–20:00, half-hour starts,
 * from tomorrow through +56 days.
 */

const BERLIN = 'Europe/Berlin';

function berlinDayKey(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BERLIN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

function addCalendarDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  const yy = t.getUTCFullYear();
  const mm = String(t.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(t.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function berlinHourMinute(at: Date): { h: number; mi: number; wd: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: BERLIN,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const wdMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    h: Number(parts.hour),
    mi: Number(parts.minute),
    wd: wdMap[parts.weekday] ?? -1,
  };
}

export type DemoSlotCheck =
  | { ok: true; berlinLabel: string; endsAt: Date }
  | { ok: false; reason: 'SLOT_INVALID' | 'SLOT_OUTSIDE_WINDOW' };

export function validateDemoSlot(
  slotStartIso: string,
  now = new Date(),
): DemoSlotCheck {
  const start = new Date(slotStartIso);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, reason: 'SLOT_INVALID' };
  }

  const { h, mi, wd } = berlinHourMinute(start);
  if (wd === 0 || wd < 0) {
    return { ok: false, reason: 'SLOT_INVALID' };
  }
  if (mi !== 0 && mi !== 30) {
    return { ok: false, reason: 'SLOT_INVALID' };
  }
  const inAm = h >= 7 && h < 12;
  const inPm = h >= 16 && h < 20;
  if (!inAm && !inPm) {
    return { ok: false, reason: 'SLOT_INVALID' };
  }

  const today = berlinDayKey(now);
  const minDay = addCalendarDays(today, 1);
  const maxDay = addCalendarDays(today, 56);
  const slotDay = berlinDayKey(start);
  if (slotDay < minDay || slotDay > maxDay) {
    return { ok: false, reason: 'SLOT_OUTSIDE_WINDOW' };
  }

  const endsAt = new Date(start.getTime() + 30 * 60 * 1000);
  const berlinLabel = start.toLocaleString('de-DE', {
    timeZone: BERLIN,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  return { ok: true, berlinLabel, endsAt };
}
