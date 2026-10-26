/** Uses IANA zones on each instant, including DST changes. No fixed UTC offsets. */
export function quietHoursEnd(
  now: Date,
  timezone: string,
  start = '21:00',
  end = '08:00',
): Date | null {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const minute = (date: Date) => {
    const p = formatter.formatToParts(date);
    return (
      Number(p.find((x) => x.type === 'hour')!.value) * 60 +
      Number(p.find((x) => x.type === 'minute')!.value)
    );
  };
  const number = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const a = number(start),
    b = number(end);
  const quiet = (m: number) =>
    a === b ? false : a < b ? m >= a && m < b : m >= a || m < b;
  if (!quiet(minute(now))) return null;
  const candidate = new Date(Math.floor(now.getTime() / 60000) * 60000);
  for (let n = 0; n < 26 * 60; n++) {
    candidate.setTime(candidate.getTime() + 60000);
    if (!quiet(minute(candidate))) return candidate;
  }
  throw new Error('QUIET_HOURS_UNRESOLVED');
}

export const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);
export const PROVIDER_CONFIG_CODES = new Set([
  'messaging/authentication-error',
  'messaging/mismatched-credential',
  'messaging/invalid-credential',
  'app/invalid-credential',
  'messaging/third-party-auth-error',
  'messaging/invalid-apns-credentials',
]);
export function retryDelay(attempt: number): number {
  return [60, 300, 900, 3600][Math.min(attempt - 1, 3)] * 1000;
}
