import type { RequestHandler } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';

export const SECURITY_VERSION = 'api-security-20261015-v1';
const PUBLIC_READS = new Set([
  '/api/health', '/api/status', '/api/readiness', '/api/registry', '/api/taxonomy',
  '/api/storage/overview', '/api/developments', '/api/plans', '/api/unit-types',
  '/api/site-plans', '/api/buildings',
]);
const equal = (a: string, b: string) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

// Headers only. Query parameters, browser-origin headers and client-supplied IDs are never credentials.
export function validJobCredential(headers: Record<string, unknown>, secret: string | undefined): boolean {
  if (!secret?.trim()) return false;
  return (typeof headers.authorization === 'string' && equal(headers.authorization, `Bearer ${secret}`)) ||
    (typeof headers['x-cron-secret'] === 'string' && equal(headers['x-cron-secret'], secret));
}

export function createApiSecurity(options: { production: boolean; secret: () => string | undefined; now?: () => number; publicLimit?: number; adminLimit?: number }): RequestHandler {
  let windowStart = 0, publicCount = 0, adminCount = 0;
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
    if (time - windowStart >= 60000) { windowStart = time; publicCount = 0; adminCount = 0; }
    const exceeded = readOnly ? ++publicCount > (options.publicLimit ?? 300) : ++adminCount > (options.adminLimit ?? 20);
    if (exceeded) { res.setHeader('Retry-After', '60'); res.status(429).json({ error: 'RATE_LIMITED' }); return; }
    next();
  };
}
