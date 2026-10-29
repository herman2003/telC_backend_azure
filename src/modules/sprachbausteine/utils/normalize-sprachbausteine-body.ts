/**
 * Normalizes Sprachbausteine `body` placeholders to the FE contract `-gapId-`.
 *
 * Supported legacy forms in seeds / imports:
 * - `{{21}}` (B2 import v2)
 * - `_____` (3+ underscores, anonymous blanks in B1 MT5+)
 *
 * Already-normalized `-21-` tokens are left untouched.
 * When `{{id}}` and `_____` are mixed, blanks consume the next unused gap id.
 */
export function normalizeSprachbausteineBody(
  body: string,
  gapIdsInOrder: readonly string[],
): string {
  const used = new Set<string>();

  let out = body.replace(/\{\{(\d+)\}\}/g, (_match, id: string) => {
    used.add(id);
    return `-${id}-`;
  });

  // Also treat existing -id- as used so blanks do not collide.
  for (const m of out.matchAll(/-(\d+)-/g)) {
    used.add(m[1]!);
  }

  let cursor = 0;
  out = out.replace(/_{3,}/g, () => {
    while (cursor < gapIdsInOrder.length && used.has(gapIdsInOrder[cursor]!)) {
      cursor += 1;
    }
    const id = gapIdsInOrder[cursor];
    if (id == null || id.length === 0) {
      return '_____';
    }
    used.add(id);
    cursor += 1;
    return `-${id}-`;
  });

  return out;
}
