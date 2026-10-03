import { amountWithVatXaf, vatAmountXaf } from '../src/modules/centers/vat';

describe('amountWithVatXaf', () => {
  it('adds 18% on seat totals (10 × 4500 HT → 53100 TTC)', () => {
    expect(amountWithVatXaf(45_000)).toBe(53_100);
    expect(vatAmountXaf(45_000)).toBe(8_100);
  });

  it('adds 18% on exam slots and add-ons', () => {
    expect(amountWithVatXaf(10_000)).toBe(11_800);
    expect(amountWithVatXaf(12_000)).toBe(14_160);
    expect(amountWithVatXaf(300)).toBe(354);
  });

  it('returns 0 for non-positive amounts', () => {
    expect(amountWithVatXaf(0)).toBe(0);
    expect(amountWithVatXaf(-1)).toBe(0);
  });
});
