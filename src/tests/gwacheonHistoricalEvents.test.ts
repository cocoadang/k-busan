import test from 'node:test';
import assert from 'node:assert/strict';
import { GWACHEON_HISTORICAL_EVENTS, mergeGwacheonHistory } from '../data/gwacheonHistoricalEvents.ts';
import { resolveProjectStatutoryStage } from '../utils/redevelopmentStages.ts';

test('official baseline counts, safety flags and no planned milestones', () => {
  assert.equal(new Set(GWACHEON_HISTORICAL_EVENTS.map(e => e.id)).size, 21);
  for (const [id, count] of [['gwacheon-5',7],['gwacheon-89',8],['gwacheon-10',6]] as const) {
    assert.equal(GWACHEON_HISTORICAL_EVENTS.filter(e => e.projectId === id).length,count);
  }
  assert.ok(GWACHEON_HISTORICAL_EVENTS.every(e => e.isHistorical && e.alreadyDispatched && !e.telegramEligibleByRecency));
  assert.ok(GWACHEON_HISTORICAL_EVENTS.every(e => !/예정|철거 완료|이주 완료/.test(e.eventType)));
});
test('existing runtime data preserves baseline and latest metadata without duplicate IDs', () => {
  const original = GWACHEON_HISTORICAL_EVENTS[0];
  const runtime = {...original, summary:'runtime metadata'};
  const merged = mergeGwacheonHistory([runtime]);
  assert.equal(merged.length,21);
  assert.equal(merged.find(e => e.id === original.id)?.summary,'runtime metadata');
});
test('management approval and conditional integrated review resolve separately', () => {
  for (const id of ['gwacheon-5','gwacheon-89']) {
    const stage = resolveProjectStatutoryStage(id,[]);
    assert.match(stage.currentStage,/관리처분/);
    assert.equal(stage.hasDemolitionEvidence,false);
  }
  const ten = resolveProjectStatutoryStage('gwacheon-10',[]);
  assert.equal(ten.currentStage,'통합심의 조건부 의결 (사업시행인가 준비)');
  assert.equal(ten.nextStage,'사업시행인가');
});
