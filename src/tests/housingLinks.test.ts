import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getHousingLink,getHousingMapLink,getHousingApartmentLink} from '../utils/housingLinks';
test('Chokjin project links to its own lineage rather than another apartment',()=>{
 const url=new URL(getHousingLink('chokjin-3')!.href);
 assert.equal(url.searchParams.get('view'),'REDEVELOPMENT');
 assert.equal(url.searchParams.get('lineage'),'chokjin3_redevelopment');
 assert.equal(url.searchParams.get('complex'),null);
});
test('Samik project links to the existing Samick apartment asset; unrelated projects stay unlinked',()=>{
 const url=new URL(getHousingLink('samik-beach')!.href);
 assert.equal(url.searchParams.get('complex'),'busan_samick_beach');
 for (const id of ['gwacheon-5','gwacheon-89','gwacheon-10','udong-3','unknown']) assert.equal(getHousingLink(id),null);
});

import { HOUSING_DESTINATIONS } from '../data/housingDestinations';
import { parseDashboardHash, formatDashboardHash } from '../components/Phase3Dashboard';

test('map menu has a shareable route without changing the existing default or project route', () => {
 assert.deepEqual(parseDashboardHash('#/housing/chokjin-3'), {tab:'housing',projectId:'chokjin-3'});
 assert.equal(formatDashboardHash('housing','samik-beach'),'#/housing/samik-beach');
 assert.equal(parseDashboardHash('').tab,'plans');
 assert.deepEqual(parseDashboardHash('#/status/samik-beach'),{tab:'status',projectId:'samik-beach'});
});

test('all 31 apartment destinations point to registered price selections; each region opens the map', () => {
 assert.equal(HOUSING_DESTINATIONS.length,31);
 assert.equal(new Set(HOUSING_DESTINATIONS.map(c=>c.id)).size,31);
 const regions=new Set(HOUSING_DESTINATIONS.map(c=>c.region)); assert.equal(regions.size,13);
 for(const c of HOUSING_DESTINATIONS){
  const url=new URL(getHousingApartmentLink(c.id)!);
  assert.equal(url.origin,'https://k-housing-5he2zcaska-du.a.run.app');
  assert.equal(url.searchParams.get('view'),'ANALYSIS');
  assert.equal(url.searchParams.get('complex'),c.id);
 }
 for(const region of regions){const u=new URL(getHousingMapLink(region));assert.equal(u.searchParams.get('view'),'MAP');assert.equal(u.searchParams.get('region'),region);}
 assert.equal(new URL(getHousingMapLink()).searchParams.get('region'),null);
 assert.equal(getHousingApartmentLink('udong-3'),null);
 assert.equal(getHousingApartmentLink('chokjin-3'),null);
 assert.equal(getHousingApartmentLink('unknown'),null);
});
