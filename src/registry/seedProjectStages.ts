/**
 * Seed 구역별 현재 법정 단계 / 다음 단계 (redevelopmentRegistry의 stage·nextStage 값).
 *
 * 값은 resolveProjectStatutoryStage(id) (진행이력 Historical Events SSOT 기반)의 결과와 같아야 한다.
 * 레지스트리가 모듈 로드 시 이력 데이터 전체(~95KB)를 끌어오지 않도록 결과만 여기에 둔다
 * (브라우저 첫 화면 번들에서 이력 데이터를 빼기 위함).
 * src/tests/seedProjectStages.test.ts 가 resolver 결과와의 일치 및 누락 여부를 검증하므로,
 * 새 구역을 추가하거나 진행이력을 바꿔 테스트가 실패하면 테스트 메시지의 값으로 이 표를 갱신한다.
 */
export const SEED_PROJECT_STAGES: Readonly<Record<string, { readonly currentStage: string; readonly nextStage: string }>> = {
  'chokjin-3': { currentStage: '관리처분계획인가 완료 (변경인가)', nextStage: '이주' },
  'udong-3': { currentStage: '관리처분계획인가 완료', nextStage: '이주' },
  'samik-beach': { currentStage: '사업시행계획(변경)인가 완료', nextStage: '관리처분계획인가' },
  'gwacheon-5': { currentStage: '관리처분계획인가 완료', nextStage: '이주' },
  'gwacheon-89': { currentStage: '관리처분계획인가 완료', nextStage: '이주' },
  'gwacheon-10': { currentStage: '통합심의 조건부 의결 (사업시행인가 준비)', nextStage: '사업시행인가' },
};
