import test from 'node:test';
import assert from 'node:assert/strict';
import { REDEVELOPMENT_SEED_PROJECTS } from '../registry/redevelopmentRegistry.ts';
import { SEED_PROJECT_STAGES } from '../registry/seedProjectStages.ts';
import { resolveProjectStatutoryStage } from '../utils/redevelopmentStages.ts';

test('SEED_PROJECT_STAGES matches resolveProjectStatutoryStage for every seed project', () => {
  const expected = Object.fromEntries(REDEVELOPMENT_SEED_PROJECTS.map((p) => {
    const r = resolveProjectStatutoryStage(p.id);
    return [p.id, { currentStage: r.currentStage, nextStage: r.nextStage }];
  }));
  assert.deepEqual(
    { ...SEED_PROJECT_STAGES },
    expected,
    `src/registry/seedProjectStages.ts 를 다음 값으로 갱신하세요:\n${JSON.stringify(expected, null, 2)}`,
  );
});

test('registry stage/nextStage come from the snapshot', () => {
  for (const p of REDEVELOPMENT_SEED_PROJECTS) {
    assert.equal(p.stage, SEED_PROJECT_STAGES[p.id].currentStage, p.id);
    assert.equal(p.nextStage, SEED_PROJECT_STAGES[p.id].nextStage, p.id);
  }
});
