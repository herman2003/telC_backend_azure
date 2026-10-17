/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { CenterProfileService } from '../src/modules/centers/center-profile.service';
import { SubscriptionPolicyService } from '../src/modules/centers/subscription-policy.service';

/**
 * Onboarding completeness, derived on read.
 *
 * There is no stored flag on purpose. A column would need something to keep it
 * true, and when that runs late the value is wrong — the same reasoning that
 * left subscription status computed from timestamps rather than stored.
 *
 * `missing` exists so the dashboard renders its checklist without holding a
 * second copy of the rules. Add a fourth required field later and every
 * checklist updates with no frontend change.
 */
const identity = { centerUserId: 'owner-1', centerId: 'center-1' } as never;

/**
 * `center` is merged rather than replaced, so an override naming only
 * `country` keeps the id and name. Spreading the override over the whole row
 * would blank the rest of the center, which is a fixture bug that reads like a
 * service bug.
 */
const managerRow = (
  over: { phone?: string | null; center?: Record<string, unknown> } = {},
) => {
  const { center: centerOver, ...userOver } = over;

  return {
    id: 'owner-1',
    role: 'OWNER',
    first_name: 'Alain',
    last_name: 'Ngeukeu',
    email: 'manager@example.com',
    phone: '+237690000000',
    email_verified: true,
    ...userOver,
    center: {
      id: 'center-1',
      name: 'Institut Goethe Douala',
      country_code: 'CM',
      city_id: 'douala',
      city_other: null,
      logo_url: null,
      ...(centerOver ?? {}),
    },
  };
};

describe('onboarding state on the center profile', () => {
  let prisma: any;
  let service: CenterProfileService;

  const given = (row: unknown) => {
    prisma.centerUser.findFirst.mockResolvedValue(row);
  };

  beforeEach(() => {
    prisma = {
      centerUser: { findFirst: jest.fn() },
      // The profile read now also answers where the center stands, so the
      // fixture carries a subscription and its (empty) seat rows. A center
      // without a subscription is a fault, not a state to test here.
      centerSubscription: {
        findUnique: jest.fn().mockResolvedValue({
          plan: 'TRIAL',
          trial_started_at: null,
          trial_ends_at: null,
          paid_until: null,
        }),
      },
      centerSeat: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    service = new CenterProfileService(prisma, new SubscriptionPolicyService());
  });

  it('reports a complete profile', async () => {
    given(
      managerRow({
        center: { logo_url: 'https://cdn.lerniqo.tech/center-logos/a.png' },
      }),
    );

    const profile: any = await service.getProfile(identity);

    expect(profile.onboarding).toEqual({ complete: true, missing: [] });
  });

  it('reports a freshly registered center as incomplete', async () => {
    // Exactly what five-field registration writes: a name and nothing else.
    given(
      managerRow({
        phone: null,
        center: { country_code: null, city_id: null, logo_url: null },
      }),
    );

    const profile: any = await service.getProfile(identity);

    expect(profile.onboarding.complete).toBe(false);
    expect(profile.onboarding.missing).toEqual([
      'country',
      'city',
      'phone',
      'logo',
    ]);
  });

  describe('each field on its own', () => {
    const withLogo = {
      logo_url: 'https://cdn.lerniqo.tech/center-logos/a.png',
    };

    it('names country when only that is absent', async () => {
      given(managerRow({ center: { ...withLogo, country_code: null } }));

      const profile: any = await service.getProfile(identity);

      expect(profile.onboarding).toEqual({
        complete: false,
        missing: ['country'],
      });
    });

    it('names city when only that is absent', async () => {
      given(managerRow({ center: { ...withLogo, city_id: null } }));

      const profile: any = await service.getProfile(identity);

      expect(profile.onboarding.missing).toEqual(['city']);
    });

    it('names phone when only that is absent', async () => {
      given(managerRow({ phone: null, center: withLogo }));

      const profile: any = await service.getProfile(identity);

      expect(profile.onboarding.missing).toEqual(['phone']);
    });

    it('names logo when only that is absent', async () => {
      given(managerRow({ center: { logo_url: null } }));

      const profile: any = await service.getProfile(identity);

      expect(profile.onboarding.missing).toEqual(['logo']);
    });
  });

  describe('what does not count as complete', () => {
    it.each([
      ['an empty country', ''],
      ['a whitespace country', '   '],
    ])('treats %s as missing', async (_case, country_code) => {
      // A blank string is not an answer. Without this, a client could satisfy
      // the checklist by submitting spaces.
      given(
        managerRow({
          center: {
            country_code,
            logo_url: 'https://cdn.lerniqo.tech/center-logos/a.png',
          },
        }),
      );

      const profile: any = await service.getProfile(identity);

      expect(profile.onboarding.missing).toContain('country');
    });
  });

  it('requires a logo for marketing partners', async () => {
    given(managerRow({ center: { logo_url: null } }));

    const profile: any = await service.getProfile(identity);

    expect(profile.onboarding.complete).toBe(false);
    expect(profile.onboarding.missing).toContain('logo');
  });

  it('keeps the order stable, so a checklist does not reshuffle', async () => {
    given(
      managerRow({
        phone: null,
        center: {
          city_id: null,
          logo_url: 'https://cdn.lerniqo.tech/center-logos/a.png',
        },
      }),
    );

    const profile: any = await service.getProfile(identity);

    // Declaration order, not discovery order: country, city, phone, logo.
    expect(profile.onboarding.missing).toEqual(['city', 'phone']);
  });

  it('still returns the profile itself alongside the state', async () => {
    given(
      managerRow({
        phone: null,
        center: { country_code: null, city_id: null },
      }),
    );

    const profile: any = await service.getProfile(identity);

    expect(profile.center.name).toBe('Institut Goethe Douala');
    expect(profile.centerUser.email).toBe('manager@example.com');
  });
});
