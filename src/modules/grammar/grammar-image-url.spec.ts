import {
  grammarImageUrlForSlug,
  resetGrammarImageManifestCache,
} from './grammar-image-url';

describe('grammarImageUrlForSlug', () => {
  beforeEach(() => {
    resetGrammarImageManifestCache();
  });

  it('returns null when public base URL is unset', () => {
    expect(
      grammarImageUrlForSlug('nominativ-gram-a-001', undefined),
    ).toBeNull();
    expect(grammarImageUrlForSlug('nominativ-gram-a-001', '')).toBeNull();
    expect(grammarImageUrlForSlug('nominativ-gram-a-001', '   ')).toBeNull();
  });

  it('resolves a known slug against the local manifest', () => {
    const url = grammarImageUrlForSlug(
      'nominativ-gram-a-001',
      'http://localhost:3000/static/grammar-images',
    );
    expect(url).toBe(
      'http://localhost:3000/static/grammar-images/001_nominativ-gram-a-001.jpg',
    );
  });

  it('strips a trailing slash on the base URL', () => {
    const url = grammarImageUrlForSlug(
      'nominativ-gram-a-001',
      'http://localhost:3000/static/grammar-images/',
    );
    expect(url).toBe(
      'http://localhost:3000/static/grammar-images/001_nominativ-gram-a-001.jpg',
    );
  });

  it('returns null for an unknown slug', () => {
    expect(
      grammarImageUrlForSlug(
        'does-not-exist-slug',
        'http://localhost:3000/static/grammar-images',
      ),
    ).toBeNull();
  });
});
