import { MyEntitlementsController } from '../src/modules/me/entitlements.controller';
import { JwtAuthGuard } from '../src/shared/guards/jwt-auth.guard';
import { StudentSubscriptionGuard } from '../src/shared/guards/student-subscription.guard';

/**
 * One call, everything the app renders.
 *
 * What the numbers mean is tested against real Postgres in
 * `entitlement-spend-integration.spec.ts`. This is about the route: who may
 * call it, and that it does not quietly become three calls.
 */
describe('MyEntitlementsController', () => {
  const student = { studentId: 'student-1' } as never;

  let entitlements: { forStudent: jest.Mock };
  let controller: MyEntitlementsController;

  beforeEach(() => {
    entitlements = {
      forStudent: jest.fn().mockResolvedValue({
        prepPass: { active: true, expiresAt: new Date('2026-12-04') },
        aiAssisted: { active: false, expiresAt: null },
        aiSpeaking: {
          freeRemaining: 3,
          resetsAt: new Date('2026-11-01'),
          creditsAvailable: 8,
        },
        aiSchreiben: {
          freeRemaining: 2,
          resetsAt: new Date('2026-10-25'),
          creditsAvailable: 5,
        },
        frozen: false,
      }),
    };
    controller = new MyEntitlementsController(entitlements as never);
  });

  it('answers for the student in the token, never one named in a parameter', async () => {
    await controller.mine(student);

    expect(entitlements.forStudent).toHaveBeenCalledWith('student-1');
  });

  it('returns the products and the frozen flag in one response', async () => {
    const mine = await controller.mine(student);

    expect(mine).toMatchObject({
      prepPass: { active: true },
      aiAssisted: { active: false },
      aiSpeaking: { freeRemaining: 3, creditsAvailable: 8 },
      aiSchreiben: { freeRemaining: 2, creditsAvailable: 5 },
      frozen: false,
    });
  });

  describe('the guards', () => {
    const guardsOn = (target: object): unknown[] =>
      (Reflect.getMetadata('__guards__', target) as unknown[]) ?? [];

    it('requires a token', () => {
      expect(guardsOn(MyEntitlementsController)).toContain(JwtAuthGuard);
    });

    it('does NOT require an active subscription', () => {
      // This is the screen that explains why nothing else works. A student
      // whose centre has lapsed must be able to see what is waiting for them;
      // refusing here would leave the app with nothing to show but an error.
      expect(guardsOn(MyEntitlementsController)).not.toContain(
        StudentSubscriptionGuard,
      );
    });
  });
});
