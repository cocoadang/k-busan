// Bounded, read-only inventory of the two legacy Apt trade collections.
// Do not use FirestoreService here: its initialization can seed unrelated documents.
import { Firestore } from '@google-cloud/firestore';
import { pathToFileURL } from 'node:url';
import catalog from '../src/housing/songApartmentCatalog.json';

const maxAge = 6 * 3600_000;
const monthPattern = /^20\d{2}(0[1-9]|1[0-2])$/;
const normalize = (value: unknown) => String(value ?? '').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
const key = (dong: unknown, name: unknown) => `${normalize(dong)}/${normalize(name)}`;
const summaries = new Map(catalog.apartments.map(apt => [apt.name, new Set(apt.aliases.map(alias => key(apt.neighborhood, alias)))]));
const regions = [...new Set(catalog.apartments.map(apt => apt.region))].sort();
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export type LegacyReader = (collection: 'apartment_trade_months_v1' | 'apartment_trade_fallback', id: string) => Promise<unknown>;

export function recentMonths(end: string): string[] {
  if (!monthPattern.test(end)) throw new Error('INVALID_MONTH');
  const year = Number(end.slice(0, 4)), month = Number(end.slice(4));
  return [2, 1, 0].map(offset => new Date(Date.UTC(year, month - 1 - offset, 1)).toISOString().slice(0, 7).replace('-', ''));
}

async function status(read: LegacyReader, collection: Parameters<LegacyReader>[0], id: string, field: string, now: number) {
  let value: unknown;
  try { value = await read(collection, id); } catch { return { status: 'unreadable' as const, rows: null }; }
  if (value === undefined) return { status: 'missing' as const, rows: null };
  if (!record(value) || !Array.isArray(value[field]) || typeof value.fetchedAt !== 'number' ||
      !Number.isFinite(value.fetchedAt) || value.fetchedAt < 0 || value.fetchedAt > now) {
    return { status: 'invalid' as const, rows: null };
  }
  return { status: now - value.fetchedAt < maxAge ? 'present_fresh' as const : 'present_stale' as const, rows: value[field] as unknown[] };
}

export async function inventoryLegacyTrades(read: LegacyReader, end: string, now = Date.now()) {
  const months = recentMonths(end);
  const buckets = [];
  // Deliberately sequential: at most 37 capped document reads, no collection scan.
  for (const district of regions) for (const month of months) {
    const snap = await status(read, 'apartment_trade_months_v1', `${district}_${month}`, 'rows', now);
    const complexes = catalog.apartments.filter(apt => apt.region === district)
      .map(apt => ({ name: apt.name, rows: 0, cancelled: 0, multiIdentity: 0 }));
    let unknown = 0;
    const rows = snap.rows?.length ?? null;
    for (const row of snap.rows ?? []) {
      if (!record(row) || !('cdealDay' in row) || !('cdealType' in row)) { unknown++; continue; }
      const matches = complexes.filter(s => summaries.get(s.name)?.has(key(row.umdNm, row.aptNm)));
      if (matches.length !== 1) {
        if (matches.length === 0) unknown++;
        else for (const m of matches) m.multiIdentity++;
        continue;
      }
      const match = matches[0];
      match.rows++;
      if (String(row.cdealDay ?? '').replace(/[-\s]/g, '') || String(row.cdealType ?? '').trim() === 'O') match.cancelled++;
    }
    buckets.push({ district, month, status: snap.status, rows, unknown, complexes: snap.rows === null ? null : complexes });
  }
  const fallback = await status(read, 'apartment_trade_fallback', end, 'results', now);
  return {
    end, scope: 'apt_legacy_inventory_only', independentlyVerified: false, eligibleForCutover: false,
    complexCount: catalog.apartments.length, districtCount: regions.length, buckets,
    surFallback: { status: fallback.status, rows: fallback.rows?.length ?? null },
  };
}

async function main(args: string[]) {
  if (args.length !== 3 || args[0] !== 'busan-redevelopment' ||
      !(args[1] === '(default)' || /^[a-z][a-z0-9-]{2,62}$/.test(args[1])) ||
      !monthPattern.test(args[2]) || recentMonths(args[2])[2] > new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7).replace('-', '') ||
      process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Usage: npx tsx ops/apt_legacy_trade_inventory.ts busan-redevelopment "(default)" YYYYMM (use the verified deployment database ID and approved read-only ADC)');
  }
  const firestore = new Firestore({ projectId: args[0], databaseId: args[1] });
  try {
    const firstPath = `apartment_trade_months_v1/${regions[0]}_${recentMonths(args[2])[0]}`;
    // A missing document is fine; abort on access errors instead of issuing 36 more reads.
    const first = await firestore.doc(firstPath).get();
    const report = await inventoryLegacyTrades(async (collection, id) => {
      const docPath = `${collection}/${id}`;
      return (docPath === firstPath ? first : await firestore.doc(docPath).get()).data();
    }, args[2]);
    console.log(JSON.stringify(report, null, 2));
    if (report.buckets.some(bucket => bucket.status === 'unreadable') || report.surFallback.status === 'unreadable') process.exitCode = 2;
  } finally {
    await firestore.terminate();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main(process.argv.slice(2)).catch(() => {
    // Do not log SDK error objects, document contents, or credential details.
    console.error('Apt inventory did not run. Check the explicit project, deployed database ID, YYYYMM, and approved Firestore read access.');
    process.exitCode = 2;
  });
}
