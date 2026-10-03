// require() is the point of this file: controllers are discovered on disk at
// runtime, so they cannot be named in static imports. A static list would
// defeat the test, which exists to catch a controller nobody remembered.
/* eslint-disable @typescript-eslint/no-require-imports */
import { UseGuards } from '@nestjs/common';
import { readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { JwtAuthGuard } from '../src/shared/guards/jwt-auth.guard';
import { StudentSubscriptionGuard } from '../src/shared/guards/student-subscription.guard';

/**
 * Controllers that authenticate a student but must NOT require a live
 * subscription. Every entry needs a reason, because adding one is how a
 * learning route would quietly escape enforcement.
 */
const EXEMPT: Record<string, string> = {
  // A blocked student still has to log in, refresh and reset a password.
  // Refusing here would strand the account their center may yet pay for.
  AuthController: 'auth must stay reachable while blocked',
  // Redeeming a code is how a student WITHOUT access gets it. Requiring a live
  // subscription here would make the door open only for people already
  // inside. The route checks the code's own center instead.
  CodeRedemptionController:
    'redeeming is how a student with no access gets some',
  // Guards are per-route here. Room creation carries both guards; the public
  // room lookup stays open so a guest can join by link. Proven in
  // room-subscription.spec.ts rather than by this sweep.
  RoomController: 'per-route guards; enforced on create, public on lookup',
  // Reading one's own past results (D38). Nothing is practised or spent, and
  // a student whose center lapsed should still see what they achieved.
  ProgressController: 'a student reads their own history, even while blocked',
  // The Elena demo has no login: the Flutter app mints a guest JWT on first
  // load, so a subscription check here would refuse every real caller. Spend
  // is bounded by LiveSessionLimitService, which caps guests by IP because a
  // guest studentId can be re-rolled at will.
  LiveTokenController: 'the live demo is deliberately open to guests',
  // An exam is paid for per candidate, in advance, when the center publishes
  // the sitting. Refusing a candidate because their school's monthly plan
  // lapsed between the purchase and the exam would take the fee and grant
  // nothing. The access rule here is the participant row: no subscription
  // opens a sitting, and no lapsed one closes a sitting already bought.
  ExamSittingController: 'an exam seat is bought per candidate, not monthly',
  // Being told something is not learning. A student whose center lapsed
  // should still be told their exam result is ready — especially then, since
  // the exam was paid for per candidate and separately from the monthly plan.
  NotificationsController: 'a notification is not a lesson',
  // The screen that explains why nothing else works. A student whose center
  // has lapsed must be able to read what is waiting for them — the response
  // carries `frozen: true` and the real balances, so the app can say "your
  // credits are held" rather than showing zeroes or an error. Refusing here
  // would leave it with nothing to show at the one moment it matters.
  MyEntitlementsController:
    'reading what is frozen is how a student learns it is frozen',
};

/** The seven the plan inventoried. Named so the scan cannot pass vacuously. */
const EXPECTED_LEARNING_CONTROLLERS = [
  'LesenController',
  'ListeningController',
  'ModelltestsController',
  'SpeakingController',
  'SpeakingCatalogController',
  'SprachbausteineController',
  'WritingController',
];

const MODULES_DIR = resolve(__dirname, '..', 'src', 'modules');

function findControllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return findControllerFiles(full);
    return entry.endsWith('.controller.ts') ? [full] : [];
  });
}

interface DiscoveredController {
  name: string;
  /** The class itself, so metadata other than guards can be read from it. */
  target: object;
  /** Guards from `@UseGuards` on the class itself. */
  guards: unknown[];
  /** Guards on each handler, keyed by method name. */
  routeGuards: Map<string, unknown[]>;
}

const guardsOn = (target: object): unknown[] =>
  (Reflect.getMetadata('__guards__', target) ?? []) as unknown[];

/**
 * Reads the guards Nest recorded, both on the class and on every handler.
 *
 * Handlers are read deliberately rather than for completeness. Scanning only
 * the class would miss a controller that applies JwtAuthGuard per-route — the
 * shape AuthController and RoomController already use — so a new one written
 * that way would slip past the very sweep meant to catch it.
 */
function discoverControllers(): DiscoveredController[] {
  const found: DiscoveredController[] = [];

  for (const file of findControllerFiles(MODULES_DIR)) {
    const exported = require(file) as Record<string, unknown>;

    for (const [name, value] of Object.entries(exported)) {
      if (typeof value !== 'function' || !name.endsWith('Controller')) continue;

      const prototype = (value as { prototype: object }).prototype;
      const routeGuards = new Map<string, unknown[]>();

      for (const method of Object.getOwnPropertyNames(prototype)) {
        if (method === 'constructor') continue;

        const handler = (prototype as Record<string, unknown>)[method];
        if (typeof handler !== 'function') continue;

        const onHandler = guardsOn(handler);
        if (onHandler.length > 0) routeGuards.set(method, onHandler);
      }

      found.push({
        name,
        target: value as object,
        guards: guardsOn(value),
        routeGuards,
      });
    }
  }

  return found;
}

/** Every guard protecting a route, whether declared on the class or the handler. */
const effectiveGuards = (
  controller: DiscoveredController,
  method: string,
): unknown[] => [
  ...controller.guards,
  ...(controller.routeGuards.get(method) ?? []),
];

describe('subscription enforcement across learning controllers', () => {
  const controllers = discoverControllers();

  it('discovers the controllers at all, so the sweep cannot pass vacuously', () => {
    expect(controllers.length).toBeGreaterThanOrEqual(
      EXPECTED_LEARNING_CONTROLLERS.length,
    );
  });

  it.each(EXPECTED_LEARNING_CONTROLLERS)(
    '%s is still present and still authenticates',
    (name) => {
      const controller = controllers.find((c) => c.name === name);

      expect(controller).toBeDefined();
      expect(controller!.guards).toContain(JwtAuthGuard);
    },
  );

  it.each(EXPECTED_LEARNING_CONTROLLERS)(
    '%s refuses a student whose center is not entitled',
    (name) => {
      const controller = controllers.find((c) => c.name === name);

      expect(controller!.guards).toContain(StudentSubscriptionGuard);
    },
  );

  it.each(EXPECTED_LEARNING_CONTROLLERS)(
    '%s checks identity before entitlement',
    (name) => {
      const { guards } = controllers.find((c) => c.name === name)!;

      // StudentSubscriptionGuard reads request.student, which JwtAuthGuard
      // puts there. Reversed, it would see no student and wave everyone
      // through — a silent hole rather than a loud failure.
      //
      // Presence is asserted before order, because indexOf returns -1 for an
      // absent guard and -1 is less than every real index: the comparison
      // alone would pass for a controller that had no JwtAuthGuard at all,
      // which is the exact case it is supposed to rule out.
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(StudentSubscriptionGuard);
      expect(guards.indexOf(JwtAuthGuard)).toBeLessThan(
        guards.indexOf(StudentSubscriptionGuard),
      );
    },
  );

  /**
   * The point of the whole file. A learning controller added next month with
   * only JwtAuthGuard fails here rather than shipping unenforced — whether it
   * declares that guard on the class or on each route.
   */
  it('leaves no student-authenticated route unenforced', () => {
    const unenforced: string[] = [];

    for (const controller of controllers) {
      if (controller.name in EXEMPT) continue;

      // Every route the controller actually exposes, plus a sentinel for a
      // class-level declaration with no decorated handlers of its own.
      const methods = new Set([
        ...controller.routeGuards.keys(),
        ...(controller.guards.length > 0 ? ['<class>'] : []),
      ]);

      for (const method of methods) {
        const guards = effectiveGuards(controller, method);

        if (
          guards.includes(JwtAuthGuard) &&
          !guards.includes(StudentSubscriptionGuard)
        ) {
          unenforced.push(`${controller.name}.${method}`);
        }
      }
    }

    expect(unenforced).toEqual([]);
  });

  /**
   * The inverse mistake, which is the worse one: a route carrying
   * StudentSubscriptionGuard but NOT JwtAuthGuard.
   *
   * That route looks protected and protects nothing. The guard reads
   * `request.student`, which only JwtAuthGuard sets, and returns true when
   * there is no student to check — so every caller, authenticated or not,
   * passes straight through. A missing guard is at least visible; this one
   * reads as defence in depth while being an open door.
   */
  it('never enforces entitlement on a route that does not establish identity', () => {
    const identityless: string[] = [];

    for (const controller of controllers) {
      const methods = new Set([
        ...controller.routeGuards.keys(),
        ...(controller.guards.length > 0 ? ['<class>'] : []),
      ]);

      for (const method of methods) {
        const guards = effectiveGuards(controller, method);

        if (
          guards.includes(StudentSubscriptionGuard) &&
          !guards.includes(JwtAuthGuard)
        ) {
          identityless.push(`${controller.name}.${method}`);
        }
      }
    }

    expect(identityless).toEqual([]);
  });

  /**
   * Guards against the sweep quietly going blind. If handler metadata ever
   * stops being readable, routeGuards empties and the check above passes
   * while testing nothing — so assert we can still see a known per-route case.
   */
  it('can see per-route guards, not only class-level ones', () => {
    const room = controllers.find((c) => c.name === 'RoomController');

    expect(room!.guards).toEqual([]);
    expect(room!.routeGuards.get('createRoom')).toContain(
      StudentSubscriptionGuard,
    );
  });

  /**
   * Proves the sweep above can fail, not merely that it passes today.
   *
   * Both real per-route controllers are exempt, so nothing else exercises that
   * branch — without this, the per-route detection could be broken and every
   * assertion here would stay green.
   */
  describe('the sweep would actually catch an offender', () => {
    class UnenforcedController {
      @UseGuards(JwtAuthGuard)
      findAll() {}
    }

    class EnforcedController {
      @UseGuards(JwtAuthGuard, StudentSubscriptionGuard)
      findAll() {}
    }

    const inspect = (cls: { prototype: { findAll: object } }) => {
      const routeGuards = guardsOn(cls.prototype.findAll);
      return {
        authenticates: routeGuards.includes(JwtAuthGuard),
        enforces: routeGuards.includes(StudentSubscriptionGuard),
      };
    };

    it('flags a route that authenticates but does not enforce', () => {
      expect(inspect(UnenforcedController)).toEqual({
        authenticates: true,
        enforces: false,
      });
    });

    it('clears a route that does both', () => {
      expect(inspect(EnforcedController)).toEqual({
        authenticates: true,
        enforces: true,
      });
    });
  });

  it('keeps every exemption deliberate', () => {
    for (const [name, reason] of Object.entries(EXEMPT)) {
      expect(controllers.some((c) => c.name === name)).toBe(true);
      expect(reason.length).toBeGreaterThan(0);
    }
  });
});
/**
 * The exam module is open to every student whose school is paying.
 *
 * It used to be the line between Start and Pro. With Start the only plan
 * (2026-09-23) nothing compares tiers, so the subscription guard is the whole
 * rule — the same one per-skill practice runs on. What the new pricing sells
 * instead (Prep Pass, Exam Day) gets its own check when it is built, and this
 * is where that check will be pinned.
 */
describe('the exam module gates on nothing but the subscription', () => {
  const controllers = discoverControllers();

  it('guards ModelltestsController with identity and subscription only', () => {
    const controller = controllers.find(
      (c) => c.name === 'ModelltestsController',
    );

    expect(controller).toBeDefined();
    expect(controller!.guards).toEqual([
      JwtAuthGuard,
      StudentSubscriptionGuard,
    ]);
  });

  it('leaves every learning controller the same two guards', () => {
    // A third guard appearing on one of these is how a gate would spread
    // without anyone noticing.
    for (const name of EXPECTED_LEARNING_CONTROLLERS) {
      const controller = controllers.find((c) => c.name === name)!;
      const perRoute = [...controller.routeGuards.values()].flat();

      expect([...controller.guards, ...perRoute]).toEqual(
        expect.arrayContaining([JwtAuthGuard, StudentSubscriptionGuard]),
      );
    }
  });
});
