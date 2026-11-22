import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdditionalSongEvidence, SongApartmentVideoEvidence, songVideoUrl } from '../components/SongApartmentVideoEvidence.tsx';
import catalog from '../housing/songApartmentCatalog.json';
import evidence from '../housing/songApartmentVideoEvidence.json';

test('video evidence renders six timestamped comparisons with distinct scope labels', () => {
  const html = renderToStaticMarkup(createElement(SongApartmentVideoEvidence));
  assert.match(html, /영상에서 확인한 입지 비교/);
  assert.match(html, /현재 시세나 사업 진행 상황을 뜻하지 않습니다/);
  const expected = [
    ['고덕그라시움', 'FzzzDjMTsiM', 177, '2:57'],
    ['마포래미안푸르지오', 'FzzzDjMTsiM', 192, '3:12'],
    ['과천 래미안슈르', 'FzzzDjMTsiM', 208, '3:28'],
    ['도곡한신', 'n93cgDEmK5k', 131, '2:11'],
    ['이촌한가람', 'n93cgDEmK5k', 257, '4:17'],
    ['디에이치퍼스티어아이파크', 'n93cgDEmK5k', 240, '4:00'],
  ] as const;
  for (const [name, id, sec, stamp] of expected) {
    assert.ok(html.includes(`href="https://www.youtube.com/watch?v=${id}&amp;t=${sec}s"`));
    assert.ok(html.includes(`${name} 발언 보기 (${stamp})`));
  }
  assert.equal(html.split('영상 근거 확인 · 실거래 검색 미반영').length - 1, 5);
  assert.equal(html.split('기존 검색 단지 · 추가 영상 근거').length - 1, 1);
  assert.doesNotMatch(html, /data-price|만 원|비교에 추가/);
});

test('video-only comparisons never add an alias or price-search record', () => {
  const listings = new Set(catalog.apartments.map(apt => apt.name));
  for (const { comparisons } of evidence) for (const item of comparisons) {
    if (item.priceSearchName) {
      assert.ok(listings.has(item.priceSearchName));
    } else {
      assert.ok(!listings.has(item.name));
    }
    assert.ok(!('aliases' in item));
    assert.ok(!('price' in item));
  }
});

test('Raemian Sur keeps its original source and receives only the verified additional link', () => {
  const primary = catalog.apartments.find(apt => apt.name === '래미안슈르');
  assert.ok(primary);
  assert.equal(songVideoUrl(primary.videoId, primary.time), 'https://www.youtube.com/watch?v=TL_WqYQsUJw&t=82s');
  const html = renderToStaticMarkup(createElement(AdditionalSongEvidence, { apartmentName: '래미안슈르' }));
  assert.match(html, /FzzzDjMTsiM&amp;t=208s/);
  assert.match(html, /조용한 주거환경/);
  assert.equal(renderToStaticMarkup(createElement(AdditionalSongEvidence, { apartmentName: '고덕그라시움' })), '');
});
