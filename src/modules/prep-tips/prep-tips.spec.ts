import { NotFoundException } from '@nestjs/common';
import { PrepTipsService } from './prep-tips.service';
import { PREP_TIPS } from './prep-tips.data';

describe('PrepTipsService', () => {
  const service = new PrepTipsService();

  it('lists all 12 tip sheets', () => {
    const list = service.list();
    expect(list).toHaveLength(12);
    expect(PREP_TIPS).toHaveLength(12);
    expect(typeof list[0].skill).toBe('string');
    expect(typeof list[0].teil).toBe('number');
    expect(typeof list[0].title).toBe('string');
  });

  it('returns a full tip for lesen/1', () => {
    const tip = service.get('lesen', '1');
    expect(tip.skill).toBe('lesen');
    expect(tip.teil).toBe(1);
    expect(tip.title).toContain('Globalverstehen');
    expect(tip.strategy.length).toBeGreaterThan(0);
    expect(tip.traps.length).toBeGreaterThan(0);
    expect(tip.practiceHint).toBeTruthy();
  });

  it('accepts skill case-insensitively', () => {
    expect(service.get('LESEN', '1').skill).toBe('lesen');
  });

  it('covers sprechen teil 3 as planen', () => {
    const tip = service.get('sprechen', '3');
    expect(tip.title.toLowerCase()).toContain('planen');
    expect(tip.traps.some((t) => t.toLowerCase().includes('debat'))).toBe(true);
  });

  it('404s for unknown combinations', () => {
    expect(() => service.get('schreiben', '2')).toThrow(NotFoundException);
    expect(() => service.get('hoeren', '9')).toThrow(NotFoundException);
    expect(() => service.get('unknown', '1')).toThrow(NotFoundException);
  });
});
