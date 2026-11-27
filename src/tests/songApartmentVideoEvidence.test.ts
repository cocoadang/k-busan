import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdditionalSongEvidence, songVideoUrl } from '../components/SongApartmentVideoEvidence.tsx';
import catalog from '../housing/songApartmentCatalog.json';
import evidence from '../housing/songApartmentVideoEvidence.json';

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
