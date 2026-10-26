import { ForbiddenException } from '@nestjs/common';
import {
  assertGuestMayAccessModelltest,
  guestMayAccessModelltest,
} from '../src/shared/guest-modelltest-access';

describe('guest modelltest access', () => {
  it('allows guests on Modelltest 1 and 2 only', () => {
    expect(guestMayAccessModelltest(1)).toBe(true);
    expect(guestMayAccessModelltest(2)).toBe(true);
    expect(guestMayAccessModelltest(3)).toBe(false);
  });

  it('does not block real students', () => {
    expect(() => assertGuestMayAccessModelltest(false, 3)).not.toThrow();
    expect(() => assertGuestMayAccessModelltest(undefined, 3)).not.toThrow();
  });

  it('blocks guests on Modelltest 3', () => {
    expect(() => assertGuestMayAccessModelltest(true, 3)).toThrow(
      ForbiddenException,
    );
  });
});
