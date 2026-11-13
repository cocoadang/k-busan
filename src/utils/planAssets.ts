import { existsSync } from 'node:fs';
import path from 'node:path';

const known = new Map<string, string | null>();

/**
 * Returns the URL path of "<file>.webp" next to a plan image when it exists inside root,
 * otherwise null. Results are memoised (assets only change with a deploy).
 */
export function resolveWebpSibling(root: string, urlPath: string): string | null {
  if (known.has(urlPath)) return known.get(urlPath)!;
  let result: string | null = null;
  try {
    const decoded = decodeURIComponent(urlPath);
    const candidate = path.resolve(root, '.' + decoded + '.webp');
    if (candidate.startsWith(path.resolve(root) + path.sep) && existsSync(candidate)) {
      result = urlPath + '.webp';
    }
  } catch {
    result = null;
  }
  if (known.size < 5000) known.set(urlPath, result);
  return result;
}
