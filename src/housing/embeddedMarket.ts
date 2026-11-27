import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import express from 'express';

const port = 18081;
const origin = `http://127.0.0.1:${port}`;
const marketDirectory = path.resolve('market');
const aptProject = 'busan-redevelopment';
const publicReads = /^\/(?:data-status|config\/maps|map-summaries|monthly-prices\/[a-z0-9_]+|complex-trades\/[a-z0-9_]+|complexes\/[a-z0-9_]+\/area-families(?:\/[a-z0-9_-]+\/(?:ath-trade|monthly-prices))?|redevelopment\/(?:price-availability|lineages(?:\/[a-z0-9_-]+(?:\/(?:targets|land-share|construction-costs))?)?))$/i;
const publicPosts = new Set(['/ai/analyze', '/redevelopment/analysis']);

export function marketFetch(enabled: boolean): typeof fetch {
  if (!enabled) return fetch;
  return (input, init) => {
    const url = new URL(input instanceof URL ? input.href : typeof input === 'string' ? input : input.url);
    if (url.origin !== 'https://k-housing-5he2zcaska-du.a.run.app') throw Error('UNEXPECTED_MARKET_ORIGIN');
    return fetch(origin + url.pathname + url.search, init);
  };
}

export async function startEmbeddedMarket() {
  if (process.env.FIRESTORE_EMULATOR_HOST) throw Error('MARKET_EMULATOR_NOT_ALLOWED');
  const useApt = process.env.APT_MARKET_DB === 'apt';
  if (process.env.APT_MARKET_DB && !useApt) throw Error('UNKNOWN_MARKET_DB_TARGET');
  const aptDatabase = process.env.FIRESTORE_DATABASE_ID ?? '(default)';
  const parentProject = process.env.FIRESTORE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || aptProject;
  if (useApt && (parentProject !== aptProject || !/^(?:\(default\)|[a-z][a-z0-9-]{2,62})$/.test(aptDatabase))) {
    throw Error('INVALID_APT_MARKET_DB');
  }
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    PORT: String(port),
    KHOUSING_LOOPBACK_ONLY: 'true',
    USE_SERVER_IAM: 'true',
    PRICE_REVISIONS_ENABLED: 'true',
    GOOGLE_CLOUD_PROJECT: useApt ? aptProject : 'gen-lang-client-0064554427',
    FIRESTORE_DATABASE_ID: useApt ? aptDatabase : 'ai-studio-khousing-38852770-f782-474c-b219-956fbb846237',
    ...(useApt ? { KHOUSING_DB_TARGET: 'apt' } : {}),
  };
  for (const key of ['GOOGLE_MAPS_API_KEY', 'GOOGLE_MAPS_MAP_ID', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'AI_CACHE_BUCKET']) {
    const value = process.env[`MARKET_${key}`];
    if (value) env[key] = value;
  }
  const child = spawn(process.execPath, ['dist/server.cjs'], { cwd: marketDirectory, env, stdio: 'inherit' });
  let stopped = false;
  function workerStopped() {
    stopped = true;
    process.exitCode = 1;
    process.kill(process.pid, 'SIGTERM');
  }
  child.once('error', workerStopped);
  child.once('exit', workerStopped);
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      child.removeListener('exit', workerStopped);
      child.kill(signal);
      process.exit(process.exitCode ?? 0);
    });
  }
  for (let i = 0; i < 60 && !stopped; i++) {
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(500) });
      await response.body?.cancel();
      if (response.ok) return;
    } catch {
      // The local process may still be loading its dependencies.
    }
    await delay(200);
  }
  workerStopped();
}

export function createMarketRouter() {
  const router = express.Router();
  const dist = path.join(marketDirectory, 'dist');
  router.use('/api', async (req, res) => {
    const post = req.method === 'POST';
    if ((!post && (req.method !== 'GET' || !publicReads.test(req.path))) ||
        (post && !publicPosts.has(req.path))) {
      res.status(404).json({ error: 'MARKET_ROUTE_NOT_FOUND' });
      return;
    }
    // Browser POSTs must be same-origin. Forward only the public request payload.
    if (post && !req.is('application/json')) {
      res.status(415).json({ error: 'MARKET_JSON_REQUIRED' });
      return;
    }
    const requestOrigin = req.get('origin');
    if (post && requestOrigin && requestOrigin !== 'https://apt.dsoom.com') {
      res.status(403).json({ error: 'MARKET_INVALID_ORIGIN' });
      return;
    }
    try {
      const response = await fetch(origin + '/api' + req.url, {
        method: req.method,
        headers: post ? { 'Content-Type': 'application/json', ...(requestOrigin ? { origin: requestOrigin } : {}) } : undefined,
        body: post ? JSON.stringify(req.body) : undefined,
        signal: AbortSignal.timeout(45_000),
        redirect: 'error',
      });
      for (const header of ['content-type', 'cache-control', 'retry-after']) {
        const value = response.headers.get(header);
        if (value) res.setHeader(header, value);
      }
      res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.status(502).json({ error: 'MARKET_UNAVAILABLE' });
    }
  });
  router.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
  router.get('/', (_req, res) => res.setHeader('Cache-Control', 'no-cache').sendFile(path.join(dist, 'index.html')));
  router.use((_req, res) => res.sendStatus(404));
  return router;
}
