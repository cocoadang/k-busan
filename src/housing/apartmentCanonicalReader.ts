import type { AptBudgetProjectionRow } from './aptBudgetCanonicalProjection';
// Offline Apt-side boundary; there is intentionally no live URL, credentials or default adapter.
export type TradeScope = { district: string; month: string };
export type CanonicalTrade = {
  id: string; complex: string; neighborhood: string; date: string;
  area: number; price: number; floor: number; cancelled: boolean;
};
type CanonicalBucket = TradeScope & {
  state: 'complete_observed' | 'provisional' | 'unavailable' | 'failed';
  generation: string; exhausted: true; expectedRows: number; rows: CanonicalTrade[];
};
export type CanonicalSnapshot = {
  revision: 1; assetClass: 'APARTMENT_SALE'; generation: string;
  checkedAt: string; buckets: CanonicalBucket[];
};
const assetClass = 'APARTMENT_SALE' as const;
type Reader = (query: { revision: 1; assetClass: typeof assetClass; scopes: readonly Readonly<TradeScope>[] }) => Promise<CanonicalSnapshot>;
export type CanonicalRowsMode = { kind: 'canonical'; read: Reader };
export type AptProjectionMode = { kind: 'canonical'; project: (months: readonly string[]) => Promise<{
  incomplete: boolean; checkedAt: string; observedAt?:string; validUntil?:number; revision?:string; results: readonly AptBudgetProjectionRow[];
}> };
export type ApartmentTradeMode = { kind: 'legacy' } | CanonicalRowsMode | AptProjectionMode;
export const legacyApartmentTradeMode: ApartmentTradeMode = Object.freeze({ kind: 'legacy' });
const key = ({ district, month }: TradeScope) => district + ':' + month;
const unavailable = (): never => { throw new Error('CANONICAL_TRADES_UNAVAILABLE'); };
export function runLegacyApartmentWriter<T>(mode: ApartmentTradeMode, write: () => Promise<T>) {
  return mode.kind === 'legacy' ? write() : Promise.resolve({ skipped: true as const, reason: 'CANONICAL_READ_ONLY' as const });
}

export async function readCanonicalApartmentTrades(
  mode: CanonicalRowsMode,
  scopes: readonly TradeScope[],
  identities: ReadonlySet<string>,
) {
  const expected = new Set(scopes.map(key));
  if (!scopes.length || scopes.length > 150 || expected.size !== scopes.length ||
      scopes.some(({ district, month }) => !/^\d{5}$/.test(district) || !/^20\d{2}(0[1-9]|1[0-2])$/.test(month))) unavailable();
  const snapshot = await mode.read({ revision: 1, assetClass, scopes: scopes.map(scope => Object.freeze({ ...scope })) });
  if (!snapshot || snapshot.revision !== 1 || snapshot.assetClass !== assetClass || (typeof snapshot.generation !== 'string' || !snapshot.generation.trim()) ||
      typeof snapshot.checkedAt !== 'string' || !Number.isFinite(Date.parse(snapshot.checkedAt)) ||
      !Array.isArray(snapshot.buckets) || snapshot.buckets.length !== expected.size) unavailable();
  let incomplete = false;
  for (const bucket of snapshot.buckets) {
    if (!bucket || bucket.generation !== snapshot.generation || bucket.exhausted !== true || !expected.delete(key(bucket)) || !['complete_observed', 'provisional'].includes(bucket.state) ||
        !Array.isArray(bucket.rows) || bucket.expectedRows !== bucket.rows.length) unavailable();
    incomplete ||= bucket.state === 'provisional';
    const ids = new Set<string>();
    for (const row of bucket.rows) {
      const day = new Date(row.date + 'T00:00:00Z');
      if (typeof row.id !== 'string' || !row.id.trim() || ids.has(row.id) ||
          !identities.has(canonicalApartmentIdentity(bucket.district, row.neighborhood, row.complex)) ||
          typeof row.cancelled !== 'boolean' || !Number.isSafeInteger(row.price) || row.price <= 0 ||
          !Number.isFinite(row.area) || row.area <= 0 || !Number.isInteger(row.floor) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(day.getTime()) ||
          day.toISOString().slice(0, 10) !== row.date || row.date.slice(0, 7).replace('-', '') !== bucket.month) unavailable();
      ids.add(row.id);
    }
  }
  if (expected.size || (incomplete && !snapshot.buckets.some(bucket => bucket.rows.some(row => !row.cancelled)))) unavailable();
  return { ...snapshot, incomplete };
}

export const canonicalApartmentIdentity = (district: string, neighborhood: string, complex: string) =>
  JSON.stringify([district, neighborhood, complex]);
