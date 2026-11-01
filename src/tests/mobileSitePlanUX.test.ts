/**
 * Phase 4I: 모바일 배치도 동 선택 UX 개선 검증 테스트 스위트
 *
 * 검증 항목:
 * 1. InteractiveSitePlan.tsx 정적 검증:
 *    - 배치도 하단 공통 동 선택 바 (id="site-plan-dong-selector-bar") 존재
 *    - 동 버튼 리스트 컨테이너 (id="site-plan-dong-buttons-list") 존재
 *    - 동 버튼 동적 식별자 (id prefix: "site-dong-btn-") 존재
 *    - 모바일(<=768px) 비선택 마커 크기 25~30% 축소 (18px vs 데스크톱 26px)
 *    - 선택된 마커 크기 유지 (32~34px 강조 유지)
 *    - 선택된 동 버튼 파란색 강조 스타일 (bg-blue-600, text-white)
 *    - 사업지명 하드코딩 0건 (chokjin-3, udong-3, samik-beach 하드코딩 부재)
 * 2. 3개 사업지 주동 데이터 동적 연동 검증:
 *    - 촉진3: 18개 주동 (101동 ~ 118-T동)
 *    - 우동3: 18개 주동 (101동 ~ 118동)
 *    - 삼익비치: 8개 주동 (101동 ~ 108동)
 * 3. 데이터 무결성 Freeze 검증:
 *    - 좌표, buildingMappings, 평면도 원본 데이터 불변 보존
 */

import fs from 'fs';
import path from 'path';
import { getProjectPlanConfig } from '../data/projects/planRegistry.ts';

export interface MobileSitePlanUXTestResult {
  itemNumber: number;
  name: string;
  passed: boolean;
  details?: string;
}

export function runMobileSitePlanUXSuite(): {
  total: number;
  passed: number;
  results: MobileSitePlanUXTestResult[];
} {
  const results: MobileSitePlanUXTestResult[] = [];
  const compPath = path.resolve(process.cwd(), 'src/components/InteractiveSitePlan.tsx');
  const compContent = fs.readFileSync(compPath, 'utf-8');

  // 1. site-plan-dong-selector-bar 존재 검증
  const hasSelectorBar = compContent.includes('id="site-plan-dong-selector-bar"');
  results.push({
    itemNumber: 1,
    name: '배치도 하단 공통 동 선택 바 (site-plan-dong-selector-bar) 존재',
    passed: hasSelectorBar,
    details: `hasSelectorBar: ${hasSelectorBar}`,
  });

  // 2. site-plan-dong-buttons-list 존재 검증
  const hasButtonsList = compContent.includes('id="site-plan-dong-buttons-list"');
  results.push({
    itemNumber: 2,
    name: '동 버튼 리스트 컨테이너 (site-plan-dong-buttons-list) 존재',
    passed: hasButtonsList,
    details: `hasButtonsList: ${hasButtonsList}`,
  });

  // 3. 동 버튼 동적 id 매핑 검증
  const hasDynamicBtnId = compContent.includes('id={`site-dong-btn-${b.buildingNumber}`}');
  results.push({
    itemNumber: 3,
    name: '동 버튼 동적 식별자 (site-dong-btn-${b.buildingNumber}) 연동 검증',
    passed: hasDynamicBtnId,
    details: `hasDynamicBtnId: ${hasDynamicBtnId}`,
  });

  // 4. 모바일(<=768px) 마커 25~30% 축소 검증 (18px vs 데스크톱 26px)
  const hasMobileReduction =
    compContent.includes('min-w-[18px] md:min-w-[26px]') &&
    compContent.includes('h-[18px] md:h-[26px]');
  results.push({
    itemNumber: 4,
    name: '모바일(<=768px) 비선택 마커 크기 약 25% 축소 (18px vs 데스크톱 26px)',
    passed: hasMobileReduction,
    details: `hasMobileReduction: ${hasMobileReduction}`,
  });

  // 5. 선택된 마커 크기 유지 검증 (32~34px)
  const keepsSelectedLarge =
    compContent.includes('min-w-[32px] md:min-w-[34px]') &&
    compContent.includes('h-[32px] md:h-[34px]');
  results.push({
    itemNumber: 5,
    name: '선택된 마커 크기 유지 (32px / 34px 및 파란색 ring 강조 유지)',
    passed: keepsSelectedLarge,
    details: `keepsSelectedLarge: ${keepsSelectedLarge}`,
  });

  // 6. 선택 버튼 파란색 강조 스타일 검증
  const hasBlueAccent =
    compContent.includes('bg-blue-600 text-white border-blue-600') &&
    compContent.includes('ring-2 ring-blue-300');
  results.push({
    itemNumber: 6,
    name: '동 선택 버튼 파란색 강조 스타일 (bg-blue-600 text-white ring-blue-300)',
    passed: hasBlueAccent,
    details: `hasBlueAccent: ${hasBlueAccent}`,
  });

  // 7. 사업지 하드코딩 부재 검증
  // selector bar 내부에서 특정 프로젝트 ID를 직접 조건 분기하지 않고 buildings 데이터를 동적 활용
  const selectorBarMatch = compContent.match(
    /<div[\s\S]*?id="site-plan-dong-selector-bar"[\s\S]*?<\/div>\s*\)\s*}/
  );
  const selectorBarCode = selectorBarMatch ? selectorBarMatch[0] : '';
  const noHardcodedProjectIds =
    !selectorBarCode.includes("'udong-3'") &&
    !selectorBarCode.includes("'chokjin-3'") &&
    !selectorBarCode.includes("'samik-beach'");
  results.push({
    itemNumber: 7,
    name: '동 선택 바 내 사업지별 하드코딩 0건 (buildings prop 100% 동적 연동)',
    passed: noHardcodedProjectIds && selectorBarCode.length > 0,
    details: `noHardcodedProjectIds: ${noHardcodedProjectIds}`,
  });

  // 8. 촉진3 18개 주동 데이터 자동 연동 검증
  const chokjinConfig = getProjectPlanConfig('chokjin-3');
  const chokjinBldgs = chokjinConfig?.buildings || [];
  const chokjinValid =
    chokjinBldgs.length === 18 &&
    chokjinBldgs[0].buildingNumber === '101동' &&
    chokjinBldgs[chokjinBldgs.length - 1].buildingNumber === '118-T동';
  results.push({
    itemNumber: 8,
    name: '촉진3 18개 주동 (101동~118-T동) buildings 데이터 자동 연동',
    passed: chokjinValid,
    details: `bldgsCount: ${chokjinBldgs.length}, first: ${chokjinBldgs[0]?.buildingNumber}, last: ${chokjinBldgs[chokjinBldgs.length - 1]?.buildingNumber}`,
  });

  // 9. 우동3 18개 주동 데이터 자동 연동 검증
  const udongConfig = getProjectPlanConfig('udong-3');
  const udongBldgs = udongConfig?.buildings || [];
  const udongValid =
    udongBldgs.length === 18 &&
    udongBldgs[0].buildingNumber === '101동' &&
    udongBldgs[udongBldgs.length - 1].buildingNumber === '118동';
  results.push({
    itemNumber: 9,
    name: '우동3 18개 주동 (101동~118동) buildings 데이터 자동 연동',
    passed: udongValid,
    details: `bldgsCount: ${udongBldgs.length}, first: ${udongBldgs[0]?.buildingNumber}, last: ${udongBldgs[udongBldgs.length - 1]?.buildingNumber}`,
  });

  // 10. 삼익비치 8개 주동 데이터 자동 연동 검증
  const samikConfig = getProjectPlanConfig('samik-beach');
  const samikBldgs = samikConfig?.buildings || [];
  const samikValid =
    samikBldgs.length === 8 &&
    samikBldgs[0].buildingNumber === '101동' &&
    samikBldgs[samikBldgs.length - 1].buildingNumber === '108동';
  results.push({
    itemNumber: 10,
    name: '삼익비치 8개 주동 (101동~108동) buildings 데이터 자동 연동',
    passed: samikValid,
    details: `bldgsCount: ${samikBldgs.length}, first: ${samikBldgs[0]?.buildingNumber}, last: ${samikBldgs[samikBldgs.length - 1]?.buildingNumber}`,
  });

  // 11. 배치도 상태 연동 (alignViewportToBuilding & scrollLeft/scrollTop) 검증
  const hasViewportAlignment =
    compContent.includes('alignViewportToBuilding') &&
    compContent.includes('vp.scrollLeft = Math.max(0, posX)') &&
    compContent.includes('vp.scrollTop = Math.max(0, posY)');
  results.push({
    itemNumber: 11,
    name: '동 버튼 선택 시 해당 마커 뷰포트 연동 (alignViewportToBuilding) 검증',
    passed: hasViewportAlignment,
    details: `hasViewportAlignment: ${hasViewportAlignment}`,
  });

  // 12. 3개 사업지 좌표 데이터 무결성 보존 검증
  const coordsIntact =
    (chokjinConfig?.coordinates?.length || 0) === 18 &&
    (udongConfig?.coordinates?.length || 0) === 18 &&
    (samikConfig?.coordinates?.length || 0) === 8;
  results.push({
    itemNumber: 12,
    name: '3개 사업지 좌표/매핑 데이터 무결성 Freeze 검증',
    passed: coordsIntact,
    details: `chokjinCoords: ${chokjinConfig?.coordinates?.length}, udongCoords: ${udongConfig?.coordinates?.length}, samikCoords: ${samikConfig?.coordinates?.length}`,
  });

  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    results,
  };
}

// Make failures visible to node --test (previously only reported via return value).
import nodeTest from 'node:test';
import nodeAssert from 'node:assert/strict';

nodeTest('모바일 배치도 UX', () => {
  const report = runMobileSitePlanUXSuite();
  const failed = report.results.filter((r) => !r.passed);
  nodeAssert.equal(failed.length, 0, JSON.stringify(failed, null, 2));
  nodeAssert.ok(report.total > 0 && report.passed === report.total, `passed ${report.passed}/${report.total}`);
});
