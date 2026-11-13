import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getHousingLink} from '../utils/housingLinks';
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
