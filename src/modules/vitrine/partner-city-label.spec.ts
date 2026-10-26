import { partnerCityLabel } from './partner-city-label';

describe('partnerCityLabel', () => {
  it('resolves a known city_id to its display name', () => {
    expect(
      partnerCityLabel({ city_id: 'douala', city_other: null }),
    ).toBe('Douala');
  });

  it('prefers city_id over city_other when both are set', () => {
    expect(
      partnerCityLabel({ city_id: 'yaounde', city_other: 'Somewhere' }),
    ).toBe('Yaoundé');
  });

  it('uses city_other when there is no city_id', () => {
    expect(
      partnerCityLabel({ city_id: null, city_other: 'Edea' }),
    ).toBe('Edea');
  });

  it('returns null when neither city is supplied', () => {
    expect(partnerCityLabel({ city_id: null, city_other: null })).toBeNull();
    expect(partnerCityLabel({ city_id: null, city_other: '  ' })).toBeNull();
  });

  it('falls back to city_other when city_id is unknown', () => {
    expect(
      partnerCityLabel({ city_id: 'not-a-real-city', city_other: 'Kribi' }),
    ).toBe('Kribi');
  });
});
