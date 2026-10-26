import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface GrammarImageManifest {
  items: Array<{ slug: string; filename: string }>;
}

let slugToFilename: Map<string, string> | null = null;

function manifestPath(): string {
  return join(process.cwd(), 'content', 'grammar-images', 'manifest.json');
}

function loadSlugMap(): Map<string, string> {
  if (slugToFilename) return slugToFilename;
  const path = manifestPath();
  if (!existsSync(path)) {
    slugToFilename = new Map();
    return slugToFilename;
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as GrammarImageManifest;
  slugToFilename = new Map(
    (raw.items ?? []).map((item) => [item.slug, item.filename]),
  );
  return slugToFilename;
}

/** Test-only: clear cached manifest map. */
export function resetGrammarImageManifestCache(): void {
  slugToFilename = null;
}

/**
 * Local-only image URL for a grammar topic slug.
 * Returns null when GRAMMAR_IMAGES_PUBLIC_BASE_URL is unset (prod/instance)
 * or when the slug is missing from the manifest.
 */
export function grammarImageUrlForSlug(
  slug: string,
  baseUrl: string | undefined = process.env.GRAMMAR_IMAGES_PUBLIC_BASE_URL,
): string | null {
  const base = baseUrl?.trim();
  if (!base) return null;
  const filename = loadSlugMap().get(slug);
  if (!filename) return null;
  return `${base.replace(/\/$/, '')}/${filename}`;
}
