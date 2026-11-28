import type { RequestHandler } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';

export const SECURITY_VERSION = 'api-security-20261113-v2';
const PUBLIC_READS = new Set([
  '/api/apt/search',
  '/api/housing/apartment-trade-history',
  '/api/housing/collected-apartments',
  '/api/housing/apartment-budget', '/api/housing/floor-plans/raemian-sur', '/api/housing/busan-prices', '/api/analysis-queue', '/api/health', '/api/status', '/api/readiness', '/api/registry', '/api/taxonomy',
  '/api/storage/overview', '/api/developments', '/api/plans', '/api/unit-types',
  '/api/site-plans', '/api/buildings',
]);
// Public data that only changes when a collection run finishes (once a day). Browsers may reuse it
// briefly and a CDN in front (Firebase Hosting) a little longer. Health/status stay uncached.
const CACHEABLE_PUBLIC_READS = new Set([
  '/api/registry', '/api/taxonomy', '/api/storage/overview', '/api/developments', '/api/plans',
  '/api/unit-types', '/api/site-plans', '/api/buildings',
]);
export const PUBLIC_DATA_CACHE_CONTROL = 'public, max-age=60, s-maxage=300';
const equal = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

// Headers only. Query parameters, browser-origin headers and client-supplied IDs are never credentials.
export function validJobCredential(headers: Record<string, unknown>, secret: string | undefined): boolean {
  if (!secret?.trim()) return false;
  return (typeof headers.authorization === 'string' && equal(headers.authorization, `Bearer ${secret}`)) ||
    (typeof headers['x-cron-secret'] === 'string' && equal(headers['x-cron-secret'], secret));
}

/**
 * Best-effort client key for the per-client public quota. The first X-Forwarded-For hop can be
 * forged, which only lets a client dodge its own share; the instance-wide caps still apply.
 */
function clientKey(req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '';
  return (first || req.socket?.remoteAddress || 'unknown').slice(0, 64);
}

export function createApiSecurity(options: { production: boolean; secret: () => string | undefined; now?: () => number; publicLimit?: number; clientLimit?: number; adminLimit?: number }): RequestHandler {
  let windowStart = 0, publicCount = 0, adminCount = 0;
  let clientCounts = new Map<string, number>();
  const now = options.now || Date.now;
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Cache-Control', 'no-store');
    const requestPath = req.path.toLowerCase();
    if (options.production && requestPath.startsWith('/api/test/')) {
      res.status(404).json({ error: 'NOT_FOUND' }); return;
    }
    const readOnly = (req.method === 'GET' || req.method === 'HEAD') && PUBLIC_READS.has(requestPath);
    if (!readOnly) {
      const secret = options.secret();
      if (!secret?.trim()) { res.status(503).json({ error: 'ADMIN_AUTH_NOT_CONFIGURED' }); return; }
      if (!validJobCredential(req.headers, secret)) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
      const polling = requestPath === '/api/jobs/poll' || requestPath === '/api/pipeline/run';
      if (polling && !['GET', 'POST'].includes(req.method)) {
        res.setHeader('Allow', 'GET, POST'); res.status(405).json({ error: 'METHOD_NOT_ALLOWED' }); return;
      }
    }
    // Instance-wide quotas cannot be bypassed by forging X-Forwarded-For.
    const time = now();
    if (time - windowStart >= 60000) { windowStart = time; publicCount = 0; adminCount = 0; clientCounts = new Map(); }
    let exceeded: boolean;
    if (readOnly) {
      const key = clientKey(req);
      const perClient = (clientCounts.get(key) ?? 0) + 1;
      if (clientCounts.size < 10_000 || clientCounts.has(key)) clientCounts.set(key, perClient);
      // One noisy client hits its own cap long before it can use up the shared public quota.
      exceeded = perClient > (options.clientLimit ?? 120) || ++publicCount > (options.publicLimit ?? 1200);
    } else {
      exceeded = ++adminCount > (options.adminLimit ?? 20);
    }
    if (exceeded) { res.setHeader('Retry-After', '60'); res.status(429).json({ error: 'RATE_LIMITED' }); return; }
    if (readOnly && CACHEABLE_PUBLIC_READS.has(requestPath)) res.setHeader('Cache-Control', PUBLIC_DATA_CACHE_CONTROL);
    next();
  };
}
