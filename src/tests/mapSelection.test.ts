import test from 'node:test';import assert from 'node:assert/strict';
import {mapSelectionFromHash,mapSelectionHash} from '../housing/mapSelection';
test('shared project and apartment URLs restore the selected place; all view stays unselected',()=>{
 assert.equal(mapSelectionFromHash('#/housing/samik-beach'),'samik-beach');
 assert.equal(mapSelectionFromHash('#/housing/udong-3'),'udong-3');
 for(const id of ['busan_samick_beach','busan_centum_park_1','busan_centum_park_2']){
  const hash=mapSelectionHash(id,'#/housing/samik-beach');
  assert.equal(mapSelectionFromHash(hash),id);
 }
 assert.equal(mapSelectionFromHash(mapSelectionHash(null,'#/housing/samik-beach')),null);
 assert.equal(mapSelectionFromHash('#/status/samik-beach'),null);
 assert.equal(mapSelectionFromHash('#/housing/unknown?place=unknown'),null);
 assert.equal(mapSelectionHash('udong-3','#/housing/samik-beach'),'#/housing/udong-3');
});
