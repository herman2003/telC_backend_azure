import { ForbiddenException } from '@nestjs/common';

/**
 * Demo guests may browse / practise these Modelltests only.
 * Newer series (e.g. MT3) require a real student account (+ Prep Pass on
 * the training library).
 */
export const GUEST_ALLOWED_MODELLTEST_NUMBERS = new Set([1, 2]);

export function guestMayAccessModelltest(number: number): boolean {
  return GUEST_ALLOWED_MODELLTEST_NUMBERS.has(number);
}

export function assertGuestMayAccessModelltest(
  isGuest: boolean | undefined,
  modelltestNumber: number,
): void {
  if (isGuest !== true) return;
  if (guestMayAccessModelltest(modelltestNumber)) return;

  throw new ForbiddenException({
    message: 'ACCOUNT_REQUIRED',
    messageKey: 'accountRequired',
    reason: 'GUEST_MODELLTEST_FORBIDDEN',
  });
}
