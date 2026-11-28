import { createHash } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import type { RequestHandler } from 'express';
import { XMLParser } from 'fast-xml-parser';
import directory from './kaptLargeApartmentCatalog.json';
import kaptDetails from './aptKaptDetails.json';
import rankings from './aptContractorRanks2026.json';
import seedSales from './aptOfficialSales.json';
import recommendations from './songApartmentCatalog.json';
import { getApartmentLocationGrades } from '../components/ApartmentRadar';

type Sale = [date: string, area: number, price: number, floor: number];
type Grades = ReturnType<typeof getApartmentLocationGrades>;
type Complex = { id: string; region: string; lawd: string; name: string; dong: string; district: string;
  homes: number; parcel: string; address: string; approvalDate: string | null; grades: Grades; seedSalesJson: string };
type Month = { lawd: string; month: string; salesJson: string; fetchedAt: string; unresolved: string[] };
type Manifest = { asOf: string; through: string; count: number; revision: string };
const targets = new Set(['서울', '과천', '분당', '구성남', '하남']);
const catalogRows = directory.complexes.filter(row => targets.has(String(row[1])));
const collection = 'apt_complexes_v1';
const batches = 'apt_sales_district_month_v1';
const meta = 'apt_search_v1';
const seedPrices: Record<string, Sale[]> = Object.fromEntries(Object.entries(seedSales.prices).map(([id, sales]) =>
  [id, sales.map((row): Sale => {
    const [date, area, price, floor] = row;
    if (row.length !== 4 || typeof date !== 'string' || !/^20\d\d-\d\d-\d\d$/.test(date) ||
        typeof area !== 'number' || !Number.isFinite(area) || area <= 0 ||
        typeof price !== 'number' || !Number.isSafeInteger(price) || price <= 0 ||
        typeof floor !== 'number' || !Number.isSafeInteger(floor)) throw Error('APT_INVALID_SEED_SALE');
    return [date, area, price, floor];
  })]));
const endpoint = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev';
const parser = new XMLParser({ parseTagValue: false });
const normalized = (value: unknown) => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').replace(/아파트$/, '');
const parcelKey = (value: unknown) => {
  const match = String(value ?? '').trim().match(/^(산\s*)?0*(\d+)(?:\s*-\s*0*(\d+))?$/);
  return match ? (match[1] ? '산' : '') + Number(match[2]) + '-' + Number(match[3] || 0) : '';
};
const monthsInKorea = (now = Date.now()) => {
  const current = new Date(now + 9 * 3_600_000);
  return [2, 1, 0].map(offset => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - offset, 1))
    .toISOString().slice(0, 7).replace('-', ''));
};
const firestore = () => new Firestore({
  projectId: process.env.APT_FIRESTORE_PROJECT || 'busan-redevelopment',
  databaseId: process.env.APT_FIRESTORE_DATABASE || 'apt-data',
});

const contractors = new Map(rankings.companies.map(([rank, label]) => [normalized(label), { rank: Number(rank), label: String(label) }]));
const contractorAliases = new Map([
  ['gs건설', '지에스건설'], ['lg건설', '지에스건설'], ['삼성물산건설부문', '삼성물산'],
  ['현대산업개발', '아이파크현대산업개발'], ['hdc현대산업개발', '아이파크현대산업개발'],
  ['에이치디씨현대산업개발', '아이파크현대산업개발'], ['sk건설', '에스케이에코플랜트'],
  ['sk에코플랜트', '에스케이에코플랜트'], ['대림산업', '디엘이앤씨'], ['dl이앤씨', '디엘이앤씨'],
  ['포스코건설', '포스코이앤씨'], ['한진중공업', '에이치제이중공업'], ['kcc건설', '케이씨씨건설'],
]);
const kstYear = (now = Date.now()) => new Date(now + 9 * 3_600_000).getUTCFullYear();
const details: Record<string, (string | null)[]> = kaptDetails;

function builderGrade(builder: string | null) {
  if (!builder?.trim()) return null;
  const names = builder.replace(/㈜|\(주\)|주식회사/g, '').split(/[,，·&+/;]|\.(?=\S)|\s+외\s*/);
  const matches = names.flatMap(name => {
    const key = normalized(name);
    const ranked = contractors.get(contractorAliases.get(key) ?? key);
    return ranked ? [ranked] : [];
  }).sort((a, b) => a.rank - b.rank);
  const best = matches[0];
  if (!best) return { label: builder, grade: null, pending: '시공능력평가 순위 또는 시공사 확인 필요', source: directory.source };
  return { label: best.label + ' · ' + best.rank + '위', grade: 5 - [3, 10, 20, 50].filter(limit => best.rank > limit).length,
    source: rankings.source };
}

function gradesAsOf(grades: Grades, approvalDate: string | null) {
  if (!approvalDate) return grades;
  const age = kstYear() - Number(approvalDate.slice(0, 4));
  const copy = [...grades];
  copy[3] = { label: approvalDate + ' 사용승인 · ' + age + '년 경과',
    grade: 5 - [5, 10, 15, 25].filter(limit => age > limit).length, source: directory.source };
  return copy;
}

function profileName(name: string, dong: string, lawd: string) {
  const aliases = [normalized(name)];
  if (lawd === '41290' && aliases[0] === '과천래미안슈르') aliases.push('래미안슈르');
  const candidates = recommendations.apartments.filter(entry => entry.region === lawd && entry.neighborhood === dong
    && [entry.name, ...entry.aliases].some(value => aliases.includes(normalized(value))));
  return candidates.length === 1 ? candidates[0].name : undefined;
}

export async function seedAptSearch(db = firestore()) {
  const complexes = catalogRows.map((row): Complex => {
    const [id, region, lawd, district, dong, name, homes, parcel, address] = row;
    const profile = profileName(String(name), String(dong), String(lawd));
    const [approvalDate = null, builder = null] = details[String(id)] ?? [];
    const grades = getApartmentLocationGrades(profile ?? String(name));
    const assessed = builderGrade(builder);
    if (assessed && (assessed.grade !== null || grades[0].grade === null)) grades[0] = assessed;
    grades[2] = { ...grades[2], label: Number(homes).toLocaleString('ko-KR') + '세대',
      grade: 1 + [500, 1000, 1500, 2000].filter(limit => Number(homes) >= limit).length, source: directory.source };
    return { id: String(id), region: String(region), lawd: String(lawd), name: String(name), dong: String(dong),
      district: String(district), homes: Number(homes), parcel: String(parcel), address: String(address),
      approvalDate, grades: JSON.parse(JSON.stringify(grades)), seedSalesJson: JSON.stringify(seedPrices[String(id)] ?? []) };
  });
  if (new Set(complexes.map(row => row.id)).size !== complexes.length ||
      complexes.some(row => !/^A\d{8}$/.test(row.id) || row.homes < 1000)) throw Error('APT_INVALID_DIRECTORY');
  const manifest: Manifest = { asOf: directory.asOf, through: seedSales.through,
    count: complexes.length, revision: 'kapt-' + directory.asOf.replace(/-/g, '') + '-' + createHash('sha256').update(JSON.stringify(complexes)).digest('hex').slice(0, 12) };
  const ref = db.collection(meta).doc('active');
  const seed = db.collection('apt_search_seeds_v1').doc(manifest.revision);
  const destination = seed.collection(collection);
  // Stage a complete snapshot before exposing the directory to readers.
  for (let offset = 0; offset < complexes.length; offset += 400) {
    const batch = db.batch();
    for (const row of complexes.slice(offset, offset + 400)) batch.set(destination.doc(row.id), row);
    await batch.commit();
  }
  if ((await destination.count().get()).data().count !== complexes.length) throw Error('APT_DIRECTORY_COUNT_MISMATCH');
  await ref.set(manifest);
  return { count: complexes.length, sales: complexes.reduce((sum, row) => sum + (seedPrices[row.id]?.length ?? 0), 0),
    graded: complexes.map(row => gradesAsOf(row.grades, row.approvalDate)).reduce((counts, grades) => counts.map((n, i) => n + (grades[i].grade !== null ? 1 : 0)), [0, 0, 0, 0, 0, 0]) };
}

async function readDirectory(db: Firestore) {
  const manifest = (await db.collection(meta).doc('active').get()).data() as Manifest | undefined;
  if (!manifest || !/^kapt-\d{8}-[a-f0-9]{12}$/.test(manifest.revision)) throw Error('APT_DIRECTORY_NOT_READY');
  const snapshot = await db.collection('apt_search_seeds_v1').doc(manifest.revision).collection(collection).get();
  if (snapshot.size !== manifest.count) throw Error('APT_DIRECTORY_COUNT_MISMATCH');
  return { manifest, complexes: snapshot.docs.map(doc => doc.data() as Complex) };
}

async function loadMonth(key: string, lawd: string, month: string) {
  let expected: number | undefined;
  const rows: Record<string, string>[] = [];
  for (let page = 1; page <= 30; page++) {
    const url = new URL(endpoint);
    url.search = new URLSearchParams({ serviceKey: key, LAWD_CD: lawd, DEAL_YMD: month, pageNo: String(page), numOfRows: '500' }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000), redirect: 'error' }).catch(() => null);
    if (!response?.ok) throw Error('MOLIT_HTTP_' + (response?.status ?? 'TRANSPORT'));
    const body = parser.parse(await response.text());
    const code = String(body.response?.header?.resultCode ?? body.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode ?? '');
    if (!/^0{1,3}$/.test(code)) throw Error('MOLIT_RESPONSE_' + (/^\d{1,3}$/.test(code) ? code : 'INVALID'));
    const total = Number(body.response.body?.totalCount);
    const item = body.response.body?.items?.item;
    if (!Number.isSafeInteger(total) || total < 0 || (expected !== undefined && total !== expected)) throw Error('MOLIT_INCONSISTENT_TOTAL');
    expected = total;
    if (item) rows.push(...[item].flat());
    if (rows.length === total) return rows;
    if (!item || rows.length > total) break;
  }
  throw Error('MOLIT_INCOMPLETE_MONTH');
}

function projectSales(rows: Record<string, string>[], complexes: Complex[], month: string) {
  const byParcel = new Map<string, Complex[]>();
  for (const complex of complexes) {
    const key = normalized(complex.dong) + '/' + parcelKey(complex.parcel);
    if (complex.parcel) byParcel.set(key, [...(byParcel.get(key) ?? []), complex]);
  }
  const sales: Record<string, Sale[]> = {};
  const unresolved = new Set<string>();
  for (const row of rows) {
    const parcel = parcelKey(row.jibun);
    const candidates = parcel ? byParcel.get(normalized(row.umdNm) + '/' + parcel) ?? [] : [];
    const name = normalized(row.aptNm);
    const matches = candidates.filter(complex => normalized(complex.name) === name
      || (complex.lawd === '41290' && normalized(complex.name) === '과천래미안슈르' && name === '래미안슈르'));
    if (matches.length !== 1) {
      for (const candidate of complexes) {
        if (candidates.includes(candidate) || (normalized(candidate.dong) === normalized(row.umdNm) &&
          normalized(candidate.name) === name)) unresolved.add(candidate.id);
      }
      continue;
    }
    if (String(row.cdealDay ?? '').replace(/[-\s]/g, '') || String(row.cdealType ?? '').trim() === 'O') continue;
    const date = String(row.dealYear) + '-' + String(row.dealMonth).padStart(2, '0') + '-' + String(row.dealDay).padStart(2, '0');
    const area = Number(row.excluUseAr), price = Number(String(row.dealAmount).replace(/,/g, '')), floor = Number(row.floor);
    if (!/^20\d\d-\d\d-\d\d$/.test(date) || date.slice(0, 7).replace('-', '') !== month ||
        !Number.isFinite(area) || area <= 0 || !Number.isSafeInteger(price) || price <= 0 || !Number.isSafeInteger(floor)) {
      throw Error('MOLIT_INVALID_TRADE');
    }
    (sales[matches[0].id] ??= []).push([date, area, price, floor]);
  }
  return { sales, unresolved: [...unresolved] };
}

export async function refreshAptSales(db = firestore(), now = Date.now()) {
  const secret = process.env.APT_MOLIT_API_KEY?.trim() || process.env.MOLIT_API_KEY?.trim() || process.env.DATA_GO_KR_API_KEY?.trim();
  if (!secret) throw Error('MOLIT_KEY_UNAVAILABLE');
  const key = secret.includes('%') ? decodeURIComponent(secret) : secret;
  const { complexes } = await readDirectory(db);
  const byDistrict = new Map<string, Complex[]>();
  for (const complex of complexes) {
    const district = byDistrict.get(complex.lawd) ?? [];
    district.push(complex);
    byDistrict.set(complex.lawd, district);
  }
  const months = monthsInKorea(now);
  const probe = await loadMonth(key, '11650', months[2]);
  const collectionRef = db.collection(batches);
  const fetchedAt = new Date(now).toISOString();
  let written = 0;
  const failures: string[] = [];
  for (const [lawd, district] of byDistrict) {
    await Promise.all(months.map(async month => {
      try {
        const rows = lawd === '11650' && month === months[2] ? probe : await loadMonth(key, lawd, month);
        const latest = projectSales(rows, district, month);
        const ref = collectionRef.doc(lawd + '_' + month);
        await db.runTransaction(async transaction => {
          const existing = await transaction.get(ref);
          if (!existing.exists || String(existing.get('fetchedAt') ?? '') < fetchedAt) {
            transaction.set(ref, { lawd, month, fetchedAt, unresolved: latest.unresolved, salesJson: JSON.stringify(latest.sales) });
          }
        });
        written++;
      } catch (error) {
        failures.push(lawd + '/' + month + '/' + (error instanceof Error && /^MOLIT_[A-Z0-9_]+$/.test(error.message) ? error.message : 'WRITE_FAILED'));
      }
    }));
  }
  return { written, failures };
}

export function createAptSearchHandler(): RequestHandler {
  let db: Firestore | undefined;
  let cache: { key: string; until: number; value: Promise<unknown> } | undefined;
  return async (_req, res) => {
    const months = monthsInKorea();
    const key = months.join(',');
    const store = db ??= firestore();
    if (!cache || cache.key !== key || cache.until <= Date.now()) {
      const value = (async () => {
        const [{ manifest, complexes }, snapshots] = await Promise.all([
          readDirectory(store), store.collection(batches).where('month', 'in', months).get(),
        ]);
        const live = new Map(snapshots.docs.map(doc => {
          const report = doc.data() as Month;
          return [doc.id, { ...report, sales: JSON.parse(report.salesJson) as Record<string, Sale[]> }] as const;
        }));
        const prices: Record<string, Sale[]> = {};
        const directory = complexes.map(({ seedSalesJson, ...complex }) => {
          const seedSales = JSON.parse(seedSalesJson) as Sale[];
          const sales = months.flatMap(month => {
            const report = live.get(complex.lawd + '_' + month);
            const saved = seedSales.filter(sale => sale[0].slice(0, 7).replace('-', '') === month);
            const fresh = report?.sales[complex.id] ?? [];
            return !report || report.unresolved.includes(complex.id) || !complex.parcel ? [...saved, ...fresh] : fresh;
          });
          if (sales.length) prices[complex.id] = sales;
          return { ...complex, grades: gradesAsOf(complex.grades, complex.approvalDate) };
        });
        const confirmed = live.size;
        return { source: 'APT_FIRESTORE', ...manifest, months, confirmedDistrictMonths: confirmed,
          expectedDistrictMonths: new Set(complexes.map(row => row.lawd)).size * months.length, directory, prices };
      })();
      cache = { key, until: Date.now() + 60_000, value };
      void value.catch(() => { if (cache?.value === value) cache = undefined; });
    }
    res.setHeader('Cache-Control', 'no-store');
    try { res.json(await cache.value); } catch { res.status(503).json({ error: 'APT_SEARCH_DB_UNAVAILABLE' }); }
  };
}

// The existing Apt polling endpoint invokes this guard. Keep cold starts independent of the supplier.
let lastAttempt = 0;
let running: ReturnType<typeof refreshAptSales> | undefined;
export function refreshAptSalesIfDue() {
  if (running) return running;
  if (Date.now() - lastAttempt < 6 * 3_600_000) return Promise.resolve({ skipped: 'RECENT_APT_API_ATTEMPT' });
  lastAttempt = Date.now();
  running = refreshAptSales().finally(() => { running = undefined; });
  return running;
}
