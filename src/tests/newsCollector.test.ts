import { curateNewsDocuments } from '../analyzer/relatednessGate';
import test from 'node:test';
import assert from 'node:assert/strict';
import { NewsCollector } from '../collector/newsCollector';
import { REDEVELOPMENT_SEED_PROJECTS } from '../registry/redevelopmentRegistry';
const project = REDEVELOPMENT_SEED_PROJECTS[0];
test('all aliases, recent query, newest beyond original four, entities and deduplication', async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (url: any) => {
    calls.push(decodeURIComponent(String(url)));
    const items = Array.from({length: 8}, (_, i) => `<item><title><![CDATA[촉진3구역 &nbsp; &#xAC00;]]></title><description><![CDATA[사업 &amp; 계획]]></description><link>https://example.com/${i}</link><pubDate>${new Date(Date.UTC(2026,9,i+1)).toUTCString()}</pubDate></item>`).join('');
    return new Response(`<rss><channel>${items}<item><link>https://example.com/bad</link><pubDate>invalid</pubDate></item></channel></rss>`, {headers:{'content-type':'application/xml'}});
  }) as typeof fetch;
  try {
    const collector = new NewsCollector();
    const result = await collector.fetchForProject(project);
    assert.equal(result.error, undefined);
    assert.equal(result.items.length, 8);
    assert.equal(result.items[0].sourceUrl, 'https://example.com/7');
    assert.equal(result.items[0].title, '촉진3구역 가');
    for(const alias of project.aliases) assert.ok(calls[0].includes(alias));
    assert.ok(calls[0].includes('when:7d'));
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = original; }
});
test('invalid upstream RSS records an error', async () => {
 const original = globalThis.fetch;
 globalThis.fetch = (async () => new Response('<html/>', {headers:{'content-type':'application/xml'}})) as typeof fetch;
 try { assert.match((await new NewsCollector().fetchForProject(project)).error!, /INVALID_RSS/); }
 finally {globalThis.fetch = original;}
});
test('timeout remains active while reading response body', async () => {
 const original = globalThis.fetch;
 globalThis.fetch = (async (_url: any, options: any) => ({ok:true,status:200,headers:new Headers({'content-type':'application/xml'}),text:() => new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted'))))})) as typeof fetch;
 try { const result = await new NewsCollector().fetchForProject(project, {timeoutMs:10}); assert.match(result.error!, /aborted/); }
 finally {globalThis.fetch = original;}
});

test('news display merges RSS redirect duplicates and excludes unrelated documents', () => {
 const base = { title: '촉진3구역 재개발 사업시행인가', content: '촉진3구역 정비사업', sourceName: '신문', publishedAt: '2026-10-01T10:00:00Z', matchedProjectIds: [project.id], relatedness: 'relevant' };
 const docs = curateNewsDocuments([
  {...base, url:'https://a'}, {...base, url:'https://b'},
  {...base, relatedness:'irrelevant'}, {...base, relatedness:'uncertain'},
  {...base, title:'미아3구역 재개발', content:'다른 지역 소식'},
  {...base, publishedAt:'2026-10-02T10:00:00Z'},
 ], [project]);
 assert.equal(docs.length, 2);
 assert.equal(docs[0].publishedAt, '2026-10-02T10:00:00Z');
 assert.deepEqual(docs[1].matchedProjectIds, [project.id]);
});
test('collector skips same article with a different RSS URL before AI analysis', async () => {
 const original = globalThis.fetch;
 globalThis.fetch = (async () => new Response('<rss><channel>' + ['a','b'].map(id => `<item><title>촉진3구역 재개발</title><source>신문</source><link>https://example.com/${id}</link><pubDate>Thu, 01 Oct 2026 10:00:00 GMT</pubDate></item>`).join('') + '</channel></rss>', {headers:{'content-type':'application/xml'}})) as typeof fetch;
 try { assert.equal((await new NewsCollector().fetchForProject(project)).items.length, 1); }
 finally { globalThis.fetch = original; }
});

test('Gwacheon 8/9 uses separate precise queries and deduplicates overlapping results', async () => {
 const gc = REDEVELOPMENT_SEED_PROJECTS.find(p => p.id === 'gwacheon-89')!;
 const collector = new NewsCollector();
 const queries = collector.buildSearchQueries(gc);
 assert.equal(queries.length,6);
 assert.ok(queries.every(q => !q.includes(' OR ')));
 assert.ok(queries.some(q => q.includes('"8단지"')));
 assert.ok(queries.some(q => q.includes('"9단지"')));
 const original = globalThis.fetch;
 globalThis.fetch = (async () => new Response('<rss><channel><item><title>과천주공 8·9단지 재건축 관리처분인가</title><link>https://example.com/gc89</link><pubDate>Wed, 14 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>', {headers:{'content-type':'application/xml'}})) as typeof fetch;
 try {assert.equal((await collector.fetchForProject(gc)).items.length,1);}
 finally {globalThis.fetch=original;}
 const docs = curateNewsDocuments([
  {title:'과천주공 8·9단지 재건축 관리처분인가',content:'',matchedProjectIds:[gc.id],publishedAt:'2026-10-14',relatedness:'relevant'},
  {title:'과천 축제 개최',content:'',matchedProjectIds:[gc.id],publishedAt:'2026-10-14',relatedness:'relevant'}
 ],[gc]);
 assert.equal(docs.length,1);
});

test('portal reprints collapse but later litigation milestones remain separate', () => {
 const p=REDEVELOPMENT_SEED_PROJECTS.find(p=>p.id==='udong-3')!;
 const base={content:'우동3구역 재개발',matchedProjectIds:[p.id],relatedness:'relevant',publishedAt:'2026-07-14T07:00:00Z'};
 const docs=curateNewsDocuments([
  {...base,title:'해운대 우동3구역 재개발 놓고 해운정사측 크게 반발 - 헤럴드경제',sourceName:'헤럴드경제',url:'https://a'},
  {...base,title:'해운대 우동3구역 재개발 놓고 해운정사측 크게 반발 - Daum',sourceName:'Daum',url:'https://b'},
  {...base,title:'해운대 우동3구역 재개발 놓고 해운정사측 크게 반발 - v.daum.net',sourceName:'v.daum.net',url:'https://c'},
  {...base,title:'우동3구역-해운정사 맞소송전 재개발 갈등',publishedAt:'2026-09-10T07:00:00Z',url:'https://d'}
 ],[p]);
 assert.equal(docs.length,2);
 assert.equal(docs.find(d=>d.publishedAt===base.publishedAt).relatedReports.length,3);
});
test('same-day metro feasibility reports group; award and later tender stay separate', () => {
 const p=REDEVELOPMENT_SEED_PROJECTS.find(p=>p.id==='gwacheon-10')!;
 const base={content:'',matchedProjectIds:[p.id],relatedness:'relevant',publishedAt:'2026-09-01T07:00:00Z'};
 const docs=curateNewsDocuments([
  {...base,title:'과천주공10단지 재건축조합 과천역 연결통로 타당성 검토 업체 선정 - 하우징헤럴드',sourceName:'하우징헤럴드',url:'https://a'},
  {...base,title:'과천주공10단지 재건축조합 과천역 지하철 연결통로 타당성 검토 용역업체 선정 입찰공고 - 한국주택경제신문',sourceName:'한국주택경제신문',url:'https://b'},
  {...base,title:'과천주공10단지 재건축조합 과천역 연결통로 타당성 검토 업체 선정완료',url:'https://c'},
  {...base,title:'과천주공10단지 재건축조합 과천역 연결통로 타당성 검토 용역 입찰 재공고',publishedAt:'2026-09-02T07:00:00Z',url:'https://d'}
 ],[p]);
 assert.equal(docs.length,3);
 assert.equal(docs.find(d=>d.relatedReports.length===2).relatedReports.length,2);
});
