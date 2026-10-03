import {
  amountWithVatXaf,
  splitVatXaf,
  vatAmountXaf,
} from '../src/modules/centers/vat';

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

describe('splitVatXaf', () => {
  it('splits an HT figure into three amounts that add up', () => {
    // The invariant an invoice depends on. Checked on a total whose VAT is not
    // a whole number before rounding: 9,000 x 0.18 is 1,620 exactly, so the
    // interesting case is one that rounds — 305 HT.
    for (const ht of [9_000, 45_000, 300, 305, 54_000, 1]) {
      const { netXaf, vatXaf, grossXaf } = splitVatXaf(ht);

      expect(netXaf + vatXaf).toBe(grossXaf);
      expect(netXaf).toBe(ht);
      expect(grossXaf).toBe(amountWithVatXaf(ht));
      expect(vatXaf).toBe(vatAmountXaf(ht));
    }
  });

  it('carries the rounding on the VAT line, never the net', () => {
    // 305 x 1.18 = 359.9, stored as 360. The net stays what was quoted, so the
    // rounding shows up as 55 of VAT rather than as a price nobody agreed to.
    expect(splitVatXaf(305)).toEqual({
      netXaf: 305,
      vatXaf: 55,
      grossXaf: 360,
    });
  });

  it('is all zeroes for a non-positive amount', () => {
    expect(splitVatXaf(0)).toEqual({ netXaf: 0, vatXaf: 0, grossXaf: 0 });
    expect(splitVatXaf(-1)).toEqual({ netXaf: 0, vatXaf: 0, grossXaf: 0 });
  });
});
