import test from 'node:test';
import assert from 'node:assert/strict';
import { REDEVELOPMENT_SEED_PROJECTS, defaultRegistry } from '../registry/redevelopmentRegistry';
import { AssociationNoticeCollector } from '../collector/associationCollector';
import { NewsCollector } from '../collector/newsCollector';
import { TelegramNotifier } from '../notifier/telegramNotifier';
import { relatedReportKey } from '../analyzer/relatednessGate';
import { CollectionPipeline } from '../pipeline/collectionPipeline';
import { GeminiAnalyzer } from '../analyzer/geminiAnalyzer';
import type { ExtractedEvent, RedevelopmentProject } from '../types/redevelopment';

const active = defaultRegistry.getAllActiveProjects();
const event = (projectId: string): ExtractedEvent => ({
  id: `evt-${projectId}`, projectId, eventType: '총회', category: '총회', title: '정기총회 개최', summary: '요약',
  importance: 4, confidence: 0.9, eventDate: '2026-10-10', primarySourceUrl: 'https://example.com/a', primarySourceTier: 'news',
  sources: [], reasoningSummary: '', telegramCandidate: true, createdAt: '2026-10-10', updatedAt: '2026-10-10',
});

test('registry: all six seed projects remain active', () => {
  assert.equal(REDEVELOPMENT_SEED_PROJECTS.length, 6);
  assert.equal(active.length, 6);
});

test('registry: Telegram header name comes from registry shortName → name for every active project', () => {
  const notifier = new TelegramNotifier({ customSender: async () => ({ success: true }) });
  for (const p of active) {
    const expected = p.shortName || p.name;
    assert.ok(notifier.formatEventMessage(event(p.id), p).startsWith(`[${expected}] `), p.id);
    // Without the project argument the notifier resolves the same entry from the registry.
    assert.ok(notifier.formatEventMessage(event(p.id)).startsWith(`[${expected}] `), p.id);
    // A changed registry value is reflected without code changes.
    assert.ok(notifier.formatEventMessage(event(p.id), { ...p, shortName: '테스트구역' }).startsWith('[테스트구역] '), p.id);
  }
  assert.deepEqual(
    Object.fromEntries(active.filter(p => p.shortName).map(p => [p.id, p.shortName])),
    { 'chokjin-3': '촉진3구역', 'udong-3': '우동3구역', 'samik-beach': '삼익비치' },
  );
});

test('registry: association board is configured (and requested) only where the registry says', async () => {
  const configured = active.filter(p => p.associationBoard).map(p => p.id);
  assert.deepEqual(configured, ['chokjin-3']);
  for (const p of active) {
    let calls = 0; const urls: string[] = [];
    const collector = new AssociationNoticeCollector((async (u: any) => { calls++; urls.push(String(u)); return new Response('', { status: 502 }); }) as typeof fetch);
    const r = await collector.fetchForProject(p, { maxPages: 1 });
    assert.equal(r.configured, Boolean(p.associationBoard), p.id);
    assert.equal(calls > 0, Boolean(p.associationBoard), p.id);
    if (p.associationBoard) assert.equal(urls[0], p.associationBoard.listUrl);
  }
  // Pipeline consults the same registry field.
  const pipeline: any = new CollectionPipeline();
  const asked: string[] = [];
  pipeline.cityBoardCollector = { fetchForProjects: async () => ({ items: [] }) };
  pipeline.gwacheonBoardCollector = { fetchForProjects: async () => ({ items: [] }) };
  pipeline.newsCollector = { fetchForProject: async () => ({ items: [] }) };
  pipeline.officialCollector = { fetchForProject: async () => ({ items: [], sourceName: 'test' }) };
  pipeline.associationCollector = { fetchForProject: async (p: RedevelopmentProject) => { asked.push(p.id); return { items: [] }; } };
  pipeline.geminiAnalyzer = new GeminiAnalyzer({ dryRunMode: true });
  await pipeline.run({ projects: active, enableOfficialApi: false });
  assert.deepEqual(asked.sort(), configured);
});

test('registry: news queries use newsSearchTerms when set, alias OR search otherwise', () => {
  const news = new NewsCollector();
  for (const p of active) {
    const queries = news.buildSearchQueries(p);
    if (p.newsSearchTerms) {
      assert.deepEqual(queries, [...p.newsSearchTerms.map(q => `${q} when:7d`), ...p.newsSearchTerms]);
    } else {
      assert.equal(queries.length, 2, p.id);
      assert.ok(p.aliases.every(a => queries[1].includes(`"${a.replace(/"/g, '')}"`)), p.id);
    }
  }
});

test('registry: related-report grouping rules are read from the project entry', () => {
  const doc = { title: '과천주공10단지 과천역 연결통로 타당성 검토 용역 입찰공고', publishedAt: '2026-09-01T07:00:00Z' };
  const gc10 = active.find(p => p.id === 'gwacheon-10')!;
  assert.ok(relatedReportKey(doc, [gc10])?.includes('station-passage-feasibility-procurement'));
  assert.equal(relatedReportKey(doc, [{ ...gc10, relatedReportRules: undefined }]), undefined);
  const other = active.find(p => p.id === 'gwacheon-5')!;
  assert.equal(relatedReportKey(doc, [other]), undefined);
  assert.ok(relatedReportKey(doc, [{ ...other, relatedReportRules: gc10.relatedReportRules }])?.includes('"gwacheon-5"'));
});
