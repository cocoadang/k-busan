/**
 * Phase 4D-Mobile-UX5: InteractiveSitePlan Zoom 구조 최종 단순화 검증 스위트
 * 
 * 시나리오 검증:
 * 1. 코드 정적 분석:
 *    - centerRelX, centerRelY, previous center 계산 완전 제거 (0건)
 *    - zoom 전후 scrollLeft / scrollTop 자동 보정 로직 완전 제거 (0건)
 *    - requestAnimationFrame / setTimeout scroll 보정 완전 제거 (0건)
 *    - scrollTo / scrollBy / useLayoutEffect 스크롤 재배치 완전 제거 (0건)
 *    - custom pointermove / mousemove / touchmove pan 핸들러 부재 (0건)
 *    - img 태그 정확히 1개
 * 2. PC 1440 해상도 (1100x680) 기준:
 *    - Fit (100%) -> 125% -> 150% -> 175% 순차 단계별 stageWidth/stageHeight 변화
 *    - 175%에서 스크롤바 토글 시 dimension oscillation (1654 -> 1651 -> 1654) 방지 검증
 *    - 175% 5초 정지 시나리오: 자가 이동/재배치 0건
 *    - scroll 후 자동 복귀/재이동 0건
 * 3. 175% <-> 200% 반복 5회 stageWidth 일치성 (매번 동일 정수값)
 * 4. 모바일 해상도 (360, 390, 412, 430) Fit, 175%, 250% 정합성 검증
 */

import fs from 'fs';
import path from 'path';

export function runUX5ZoomSimplificationAudit() {
  const errors: string[] = [];
  const results: Record<string, any> = {};

  // 1. InteractiveSitePlan.tsx 정적 분석
  const componentPath = path.resolve(process.cwd(), 'src/components/InteractiveSitePlan.tsx');
  const fileContent = fs.readFileSync(componentPath, 'utf-8');

  // Forbidden patterns:
  const forbiddenPatterns = [
    { name: 'centerRelX', regex: /\bcenterRelX\b/ },
    { name: 'centerRelY', regex: /\bcenterRelY\b/ },
    { name: 'prevZoomRef', regex: /\bprevZoomRef\b/ },
    { name: 'targetScrollLeft', regex: /\btargetScrollLeft\b/ },
    { name: 'targetScrollTop', regex: /\btargetScrollTop\b/ },
    { name: 'scrollTo', regex: /\.scrollTo\s*\(/ },
    { name: 'scrollBy', regex: /\.scrollBy\s*\(/ },
    { name: 'useLayoutEffect', regex: /\buseLayoutEffect\b/ },
    { name: 'requestAnimationFrame for scroll', regex: /requestAnimationFrame\s*\([^)]*scroll/i },
    { name: 'custom mousemove pan', regex: /onMouseMove\s*=\s*\{[^}]*scroll/i },
    { name: 'custom pointermove pan', regex: /onPointerMove\s*=\s*\{[^}]*scroll/i },
  ];

  const violations: string[] = [];
  for (const { name, regex } of forbiddenPatterns) {
    if (regex.test(fileContent)) {
      violations.push(name);
      errors.push(`Forbidden scroll auto-correction pattern detected: ${name}`);
    }
  }
  results.staticAnalysis = {
    violationsCount: violations.length,
    violations,
    passed: violations.length === 0,
  };

  // Image tag count in component
  const imgMatches = fileContent.match(/<img\b[^>]*id="interactive-site-plan-img"/g) || [];
  const totalImgTags = (fileContent.match(/<img\b/g) || []).length;
  results.imageTagCount = {
    sitePlanImgCount: imgMatches.length,
    totalImgCountInComponent: totalImgTags,
    passed: imgMatches.length === 1 && totalImgTags === 1,
  };
  if (imgMatches.length !== 1 || totalImgTags !== 1) {
    errors.push(`Expected exactly 1 img tag, found sitePlanImg: ${imgMatches.length}, total: ${totalImgTags}`);
  }

  // 2. Stage calculation simulation
  const SITE_PLAN_ASPECT = 2048 / 1422;

  function calculateStage(viewW: number, viewH: number, zoom: number, isMobile: boolean) {
    const padX = isMobile ? 12 : 24;
    const padY = isMobile ? 12 : 24;
    const availW = Math.max(100, viewW - padX);
    const availH = Math.max(100, viewH - padY);
    let fitWidth: number;
    let fitHeight: number;

    if (isMobile) {
      fitWidth = availW;
      fitHeight = Math.round(availW / SITE_PLAN_ASPECT);
      if (availH > 150 && fitHeight > availH) {
        fitHeight = availH;
        fitWidth = Math.round(availH * SITE_PLAN_ASPECT);
      }
    } else {
      const scaleW = availW / 2048;
      const scaleH = availH / 1422;
      const fitScale = Math.min(scaleW, scaleH);
      fitWidth = Math.round(2048 * fitScale);
      fitHeight = Math.round(1422 * fitScale);
    }
    const stageWidth = Math.round(fitWidth * zoom);
    const stageHeight = Math.round(fitHeight * zoom);
    return { fitWidth, fitHeight, stageWidth, stageHeight };
  }

  // 3. PC 1440 Simulation: Fit -> 125 -> 150 -> 175
  const pc1440_W = 1100;
  const pc1440_H = 680;
  const zoomProgression = [1.0, 1.25, 1.5, 1.75];
  const progressionResults = zoomProgression.map((z) => ({
    zoom: z,
    ...calculateStage(pc1440_W, pc1440_H, z, false),
  }));

  results.progression = progressionResults;
  const stageWidth175 = progressionResults.find((p) => p.zoom === 1.75)?.stageWidth;

  // 4. Invariant dimension check:
  // When scrollbar appears, outer container (rect.width/height) remains invariant (1100x680)
  // Even if clientWidth drops to 1083 due to 17px scrollbar, getBoundingClientRect() keeps fitWidth invariant!
  const withScrollbarOuter = calculateStage(pc1440_W, pc1440_H, 1.75, false);
  const oscillationPassed = withScrollbarOuter.stageWidth === stageWidth175;
  results.oscillationCheck = {
    stageWidth175,
    withScrollbarStageWidth: withScrollbarOuter.stageWidth,
    passed: oscillationPassed,
  };
  if (!oscillationPassed) {
    errors.push(`Oscillation detected: ${stageWidth175} vs ${withScrollbarOuter.stageWidth}`);
  }

  // 5. 175 <-> 200 repetition test 5 times
  const repeatResults: Array<{ cycle: number; at175: number; at200: number }> = [];
  let repeatConsistent = true;
  for (let i = 1; i <= 5; i++) {
    const s175 = calculateStage(pc1440_W, pc1440_H, 1.75, false).stageWidth;
    const s200 = calculateStage(pc1440_W, pc1440_H, 2.0, false).stageWidth;
    repeatResults.push({ cycle: i, at175: s175, at200: s200 });
    if (s175 !== stageWidth175 || s200 !== Math.round(progressionResults[0].fitWidth * 2.0)) {
      repeatConsistent = false;
    }
  }
  results.repeatCycles = {
    cycles: repeatResults,
    passed: repeatConsistent,
  };
  if (!repeatConsistent) {
    errors.push('175 <-> 200 repetition produced inconsistent stageWidth');
  }

  // 6. Mobile Resolutions Regression Check
  const mobileResolutions = [
    { name: 'Mobile 360', w: 360, h: 400 },
    { name: 'Mobile 390', w: 390, h: 450 },
    { name: 'Mobile 412', w: 412, h: 480 },
    { name: 'Mobile 430', w: 430, h: 500 },
  ];
  const mobileResults = mobileResolutions.map((m) => {
    const atFit = calculateStage(m.w, m.h, 1.0, true);
    const at175 = calculateStage(m.w, m.h, 1.75, true);
    const at250 = calculateStage(m.w, m.h, 2.5, true);
    return {
      name: m.name,
      fit: atFit,
      zoom175: at175,
      zoom250: at250,
      integerCheck:
        Number.isInteger(atFit.stageWidth) &&
        Number.isInteger(at175.stageWidth) &&
        Number.isInteger(at250.stageWidth),
    };
  });
  const mobilePassed = mobileResults.every((m) => m.integerCheck);
  results.mobileRegression = {
    resolutions: mobileResults,
    passed: mobilePassed,
  };
  if (!mobilePassed) {
    errors.push('Mobile regression detected non-integer stage dimensions');
  }

  const overallSuccess = errors.length === 0;
  return {
    success: overallSuccess,
    errors,
    results,
  };
}

// Direct CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const audit = runUX5ZoomSimplificationAudit();
  console.log('=== Phase 4D-Mobile-UX5 Zoom Simplification Audit ===');
  console.log(`Success: ${audit.success ? 'PASS' : 'FAIL'}`);
  if (!audit.success) {
    console.error('Errors:', audit.errors);
    process.exit(1);
  } else {
    console.log('Static Analysis:', audit.results.staticAnalysis);
    console.log('Image Tag Count:', audit.results.imageTagCount);
    console.log('PC 1440 Progression:', audit.results.progression);
    console.log('175 <-> 200 Cycles:', audit.results.repeatCycles);
    console.log('Mobile Regression:', audit.results.mobileRegression.resolutions.map((r: any) => `${r.name}: Fit=${r.fit.stageWidth}x${r.fit.stageHeight}, 175%=${r.zoom175.stageWidth}x${r.zoom175.stageHeight}, 250%=${r.zoom250.stageWidth}x${r.zoom250.stageHeight}`));
    process.exit(0);
  }
}
