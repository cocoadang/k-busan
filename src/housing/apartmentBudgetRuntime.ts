import { createKhousingRecommendationMode } from './khousingRecommendationClient';
import { readFileSync } from 'node:fs';
import { Firestore } from '@google-cloud/firestore';
import { createApartmentBudgetService } from './apartmentBudgetApi';
import { createCanonicalManifestBudgetMode, createCanonicalManifestFirestoreStore } from './apartmentCanonicalManifestConnector';
import type { AptBudgetIdentity } from './aptBudgetCanonicalProjection';

const target = Object.freeze({
  projectId: 'gen-lang-client-0064554427',
  databaseId: 'ai-studio-khousing-38852770-f782-474c-b219-956fbb846237',
});

type Dependencies = {
  readRegistry: (path: string) => unknown;
  makeReader: (destination: typeof target) => ReturnType<typeof createCanonicalManifestFirestoreStore>;
  now: () => Date;
};
const defaults: Dependencies = {
  readRegistry: path => JSON.parse(readFileSync(path,'utf8')),
  makeReader: destination => createCanonicalManifestFirestoreStore(new Firestore(destination)),
  now: () => new Date(),
};
const badConfiguration = (): never => { throw Error('APT_CANONICAL_BUDGET_CONFIGURATION_INVALID'); };

function exactRegistry(value: unknown): AptBudgetIdentity[] {
  if (!Array.isArray(value) || !value.length || value.length > 18 || value.some(entry =>
      !entry || typeof entry.id !== 'string' || !/^[a-z][a-z0-9_]{1,95}$/.test(entry.id) ||
      typeof entry.name !== 'string' || !entry.name.trim() || typeof entry.district !== 'string' || !/^\d{5}$/.test(entry.district) ||
      typeof entry.legalDong !== 'string' || !/^[가-힣0-9·]{1,30}$/.test(entry.legalDong) ||
      typeof entry.parcel !== 'string' || !/^[1-9]\d{0,3}-(?:0|[1-9]\d{0,3})$/.test(entry.parcel))) return badConfiguration();
  return value.map(({id,name,district,legalDong,parcel}) => ({id,name,district,legalDong,parcel}));
}

/** Select once for the GET, startup, and scheduled Apt sale paths. Do not create credentials, guess registry data or silently fall back. */
export function createRuntimeApartmentBudgetService(env: NodeJS.ProcessEnv, deps: Dependencies = defaults) {
  const mode = env.APT_TRADE_MODE ?? 'legacy';
  // Preview resolves 'active' locally to one immutable manifest. Never let a normal
  // serving process silently accept a pin or a preview fall back to the live pointer.
  const pin = env.APT_CANONICAL_TRADE_PREVIEW_REVISION;
  const origin=env.APT_KHOUSING_PREVIEW_ORIGIN, revision=env.APT_KHOUSING_PREVIEW_REVISION;
  if (mode==='khousing-api-preview') {
    if (!origin || !revision || pin!==undefined) return badConfiguration();
    return createApartmentBudgetService(createKhousingRecommendationMode({origin,revision}));
  }
  if (origin!==undefined||revision!==undefined) return badConfiguration();
  if (mode==='khousing-api'&&pin===undefined) return createApartmentBudgetService(createKhousingRecommendationMode());

  if (mode === 'legacy' && pin === undefined) return createApartmentBudgetService();
  if (mode !== 'canonical' && mode !== 'canonical-preview') return badConfiguration();
  if ((mode === 'canonical-preview' ? !pin || !/^r\d{14}(?:_[a-f0-9]{8})?$/.test(pin) : pin !== undefined) ||
      env.FIRESTORE_EMULATOR_HOST?.trim()) return badConfiguration();
  const registryFile = env.APT_CANONICAL_TRADE_REGISTRY_FILE;
  const age = env.APT_CANONICAL_TRADE_MAX_AGE_HOURS;
  if (!registryFile?.startsWith('/') || !age || !/^[1-9]\d?$/.test(age) || Number(age) > 72) return badConfiguration();
  try {
    const registry = exactRegistry(deps.readRegistry(registryFile));
    // Construction is lazy even with valid file flags: only a valid whole-catalog canonical request obtains a DB client.
    let reader: ReturnType<typeof createCanonicalManifestFirestoreStore> | undefined;
    const lazyReader = () => reader ??= deps.makeReader(target);
    const store = {
      manifest:(id:string) => lazyReader().manifest(id === 'active' && pin ? pin : id),
      page:(q:Parameters<ReturnType<typeof lazyReader>['page']>[0]) => lazyReader().page(q),
    };
    return createApartmentBudgetService(createCanonicalManifestBudgetMode(store,registry,deps.now,
      {maxAgeMs:Number(age)*3_600_000,maxFutureMs:5*60_000}));
  } catch {
    return badConfiguration();
  }
}
