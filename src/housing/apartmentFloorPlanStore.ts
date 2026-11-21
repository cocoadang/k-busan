import type { RequestHandler } from 'express';
import { FirestoreService } from '../storage/firestoreService.ts';
import catalog from './largeApartmentCatalog.json';
import sources from './largeApartmentFloorPlans.json';

type Plan = { label: string; area: string; image: string };
type Source = { source: string; url: string };
const sourceIndex: Record<string, Source | null> = sources;
const storage = new FirestoreService();
const collection = 'apartment_floor_plans_v1';

const published: Record<string, { source: string; plans: Plan[] }> = {
  '트리우스 광명': { source: '롯데캐슬 공식 분양 자료', plans: [
    {label: '59A', area: '59', image: 'https://www.lottecastle.co.kr/files/etc/2023/10/202310160136134080.jpg'},
    {label: '59B', area: '59', image: 'https://www.lottecastle.co.kr/files/etc/2023/10/202310160137050370.jpg'},
  ] },
  '이문아이파크자이': { source: '아이파크 공식 분양 자료', plans: ['59A', '59B', '59C'].map(label => ({
    label, area: '59', image: `https://cdn.i-park.com/ipark/imungrand/img/sub/1026/plane_${label.toLowerCase()}_01_grand.jpg`,
  })) },
};


async function raemianPlans(): Promise<Plan[]> {
      const origin = await fetch('https://khu0927.tistory.com/1327', { signal: AbortSignal.timeout(8000), headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; DsoomFloorPlans/1.0)' } });
      if (!origin.ok) throw new Error('FLOOR_PLAN_SOURCE_UNAVAILABLE');
      const { load } = await import('cheerio');
      const page = load(await origin.text());
      const data: { label: string; area: string; image: string }[] = [];
      let heading: { label: string; area: string } | undefined;
      page('.contents_style').first().children().each((_, element) => {
        const node = page(element);
        const match = node.is('p') && node.text().match(/^\s*\*\s*(\d+평)\s*전용\s*(\d{2,3})([A-Z]*)\s*\*\s*$/);
        if (match) heading = { label: `${match[1]} · 전용 ${match[2]}㎡${match[3] ? ` ${match[3]}` : ''}`, area: match[2] };
        if (!heading || !node.is('figure')) return;
        const image = node.find('span[data-url]').attr('data-url') ?? node.find('img').attr('src');
        if (image && /^https:\/\/blog\.kakaocdn\.net\/dna\//.test(image)) data.push({ ...heading, image });
        heading = undefined;
      });
      if (!data.length) throw new Error('FLOOR_PLAN_SOURCE_EMPTY');

  return data;
}

export async function refreshApartmentFloorPlans() {
  const db = await storage.getClient();
  if (!db) throw new Error('FLOOR_PLAN_DB_UNAVAILABLE');
  const entries = db.collection(collection);
  const results = await Promise.allSettled(catalog.apartments.map(async ({ name }) => {
    const ref = entries.doc(name);
    const source = sourceIndex[name];
    const configured = published[name];
    const existing = (await ref.get()).data();
    if (existing?.plans?.length) return true;
    const sur = name === '과천래미안슈르';
    if (!configured && !sur) {
      await ref.set({ name, source, plans: [], status: 'image_source_pending' }, { merge: true });
      return false;
    }
    const plans = sur ? await raemianPlans() : configured.plans;
    const downloads = await Promise.allSettled(plans.map(async plan => {
      const response = await fetch(plan.image, { signal: AbortSignal.timeout(10000), redirect: 'error' });
      const mime = response.headers.get('content-type')?.split(';')[0];
      if (!response.ok || !mime || !['image/png', 'image/jpeg', 'image/webp'].includes(mime)) throw new Error('FLOOR_PLAN_IMAGE_UNAVAILABLE');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 8_000_000) throw new Error('FLOOR_PLAN_IMAGE_SIZE');
      return { plan, bytes, mime };
    }));
    const batch = db.batch();
    const stored = downloads.flatMap((result, index) => {
      if (result.status !== 'fulfilled') return [];
      const { plan, bytes, mime } = result.value;
      const parts = Math.ceil(bytes.length / 650_000);
      for (let part = 0; part < parts; part++) {
        batch.set(ref.collection('images').doc(`${index}_${part}`), { bytes: bytes.subarray(part * 650_000, (part + 1) * 650_000) });
      }
      return [{ id: String(index), label: plan.label, area: plan.area, mime, parts }];
    });
    batch.set(ref, { name, source, plans: stored, status: stored.length ? 'available' : 'image_source_pending' });
    await batch.commit();
    return Boolean(stored.length);
  }));
  return { total: results.length, available: results.filter(result => result.status === 'fulfilled' && result.value).length };
}

export const readApartmentFloorPlans: RequestHandler = async (req, res) => {
  const name = typeof req.query.name === 'string' ? req.query.name : '과천래미안슈르';
  if (!catalog.apartments.some(apt => apt.name === name)) {
    res.sendStatus(404);
    return;
  }
  try {
    const db = await storage.getClient();
    if (!db) throw new Error('FLOOR_PLAN_DB_UNAVAILABLE');
    const ref = db.collection(collection).doc(name);
    const data = (await ref.get()).data();
    const plans = (data?.plans ?? []) as { id: string; label: string; area: string; mime: string; parts: number }[];
    if (typeof req.query.image !== 'string') {
      res.json(plans.map(({ id, label, area }) => ({ label, area, image: `/api/housing/floor-plans/raemian-sur?${new URLSearchParams({ name, image: id })}` })));
      return;
    }
    const image = plans.find(plan => plan.id === req.query.image);
    if (!image) {
      res.sendStatus(404);
      return;
    }
    const parts = await Promise.all(Array.from({ length: image.parts }, (_, part) => ref.collection('images').doc(`${image.id}_${part}`).get()));
    const bytes = Buffer.concat(parts.map(part => part.get('bytes')));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.type(image.mime).send(bytes);
  } catch {
    res.status(503).json({ error: 'FLOOR_PLAN_DB_UNAVAILABLE' });
  }
};
