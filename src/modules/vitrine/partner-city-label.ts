import { COUNTRIES } from '../locations/locations.data';

/**
 * Display city for the vitrine partners strip.
 *
 * Catalog `city_id` wins when known; otherwise free-text `city_other`.
 * Unknown ids fall through to `city_other` so a stale id never leaks as a
 * raw slug on the marketing site.
 */
export function partnerCityLabel(center: {
  city_id: string | null;
  city_other: string | null;
}): string | null {
  const cityId = center.city_id?.trim() ?? '';
  if (cityId) {
    for (const country of COUNTRIES) {
      for (const region of country.regions) {
        const match = region.cities.find((city) => city.id === cityId);
        if (match) {
          return match.name;
        }
      }
    }
  }

  const other = center.city_other?.trim() ?? '';
  return other.length > 0 ? other : null;
}
