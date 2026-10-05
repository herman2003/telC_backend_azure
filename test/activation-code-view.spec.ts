import { toActivationCodeView } from '../src/modules/centers/activation-code-view';

describe('toActivationCodeView', () => {
  const base = {
    id: '00000000-0000-4000-8000-000000000001',
    code: 'LQ-7K2P-94QX',
    linked_name: null as string | null,
    linked_email: null as string | null,
    connected_at: null as Date | null,
    created_at: new Date('2026-10-01T00:00:00.000Z'),
    expires_at: null as Date | null,
  };

  it('maps SUSPENDED to suspended', () => {
    expect(toActivationCodeView({ ...base, status: 'SUSPENDED' }).status).toBe(
      'suspended',
    );
  });
});
