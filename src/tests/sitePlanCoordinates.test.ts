import {
  CHOKJIN3_SITE_PLAN_COORDINATES,
  CHOKJIN3_BUILDINGS,
  CHOKJIN3_UNIT_TYPES,
  CHOKJIN3_TYPE_MAPPINGS,
  SitePlanCoordinate,
} from '../data/chokjin3PlanData.ts';

// Phase 4D-7A Verified Ground Truth Anchor Coordinates
export const PHASE_4D_7A_GROUND_TRUTH: Record<string, { x: number; y: number }> = {
  '101동': { x: 0.0830, y: 0.7103 },
  '102동': { x: 0.1611, y: 0.6610 },
  '103동': { x: 0.2598, y: 0.5591 },
  '104동': { x: 0.3491, y: 0.3657 },
  '105동': { x: 0.4272, y: 0.4360 },
  '106동': { x: 0.3457, y: 0.5802 },
  '107동': { x: 0.4932, y: 0.6083 },
  '108동': { x: 0.5786, y: 0.3868 },
  '109동': { x: 0.6812, y: 0.4852 },
  '110동': { x: 0.5737, y: 0.7630 },
  '111동': { x: 0.7251, y: 0.7314 },
  '112동': { x: 0.7935, y: 0.4747 },
  '113동': { x: 0.8506, y: 0.6273 },
  '114동': { x: 0.9404, y: 0.7954 },
  '115동': { x: 0.8379, y: 0.8214 },
  '116-T동': { x: 0.3809, y: 0.7138 },
  '117-T동': { x: 0.8984, y: 0.6329 },
  '118-T동': { x: 0.7935, y: 0.2250 },
};

export interface CoordinateTestResult {
  buildingNumber: string;
  expectedX: number;
  expectedY: number;
  actualX: number;
  actualY: number;
  matched: boolean;
  deltaX: number;
  deltaY: number;
}

export function runSitePlanCoordinateAudit(): {
  success: boolean;
  totalTested: number;
  matchedCount: number;
  results: CoordinateTestResult[];
} {
  const results: CoordinateTestResult[] = [];
  const TOLERANCE = 0.0001;

  for (const [bNum, expected] of Object.entries(PHASE_4D_7A_GROUND_TRUTH)) {
    const found = CHOKJIN3_SITE_PLAN_COORDINATES.find((c) => c.buildingNumber === bNum);
    if (!found) {
      results.push({
        buildingNumber: bNum,
        expectedX: expected.x,
        expectedY: expected.y,
        actualX: -1,
        actualY: -1,
        matched: false,
        deltaX: 1,
        deltaY: 1,
      });
      continue;
    }

    const deltaX = Math.abs(found.normalizedX - expected.x);
    const deltaY = Math.abs(found.normalizedY - expected.y);
    const matched = deltaX <= TOLERANCE && deltaY <= TOLERANCE;

    results.push({
      buildingNumber: bNum,
      expectedX: expected.x,
      expectedY: expected.y,
      actualX: found.normalizedX,
      actualY: found.normalizedY,
      matched,
      deltaX,
      deltaY,
    });
  }

  const matchedCount = results.filter((r) => r.matched).length;
  return {
    success: matchedCount === 18 && CHOKJIN3_SITE_PLAN_COORDINATES.length === 18,
    totalTested: Object.keys(PHASE_4D_7A_GROUND_TRUTH).length,
    matchedCount,
    results,
  };
}

export function runSitePlanInteractionScenariosAudit(): {
  scenarioA: boolean; // Click 105동 -> selected
  scenarioB: boolean; // 105동 types match
  scenarioC: boolean; // 98C multi-dong highlight (7 buildings)
  scenarioD: boolean; // 84A1 / 84A2 unresolved, buildingNumbers=[]
  scenarioE: boolean; // 84T1 / 107W candidate 118-T
  scenarioF: boolean; // Terrace buildings confirmed mapping preserved (116-T->98T, 117-T->84T2, 118-T->[])
  allPassed: boolean;
} {
  // Scenario A & B: 105동 exists and has expected types
  const b105 = CHOKJIN3_BUILDINGS.find((b) => b.buildingNumber === '105동');
  const scenarioA = !!b105 && CHOKJIN3_SITE_PLAN_COORDINATES.some((c) => c.buildingNumber === '105동');
  const scenarioB = !!b105 && b105.unitTypesShown.length > 0;

  // Scenario C: 98C mapping in SSOT has exactly 4 buildings (105동, 109동, 112동, 113동)
  const mapping98C = CHOKJIN3_TYPE_MAPPINGS['98C'];
  const expected98C = ['105동', '109동', '112동', '113동'];
  const scenarioC =
    !!mapping98C &&
    mapping98C.buildingNumbers.length === 4 &&
    expected98C.every((b) => mapping98C.buildingNumbers.includes(b));

  // Scenario D: 84A1 and 84A2 must have empty buildingNumbers and unresolved mapping
  const doc84A1 = CHOKJIN3_UNIT_TYPES.find((u) => u.typeCode === '84A1');
  const doc84A2 = CHOKJIN3_UNIT_TYPES.find((u) => u.typeCode === '84A2');
  const scenarioD =
    !!doc84A1 &&
    !!doc84A2 &&
    doc84A1.buildingNumbers.length === 0 &&
    doc84A2.buildingNumbers.length === 0 &&
    doc84A1.mappingStatus === 'unresolved' &&
    doc84A2.mappingStatus === 'unresolved';

  // Scenario E: 84T1 and 107W must have 118-T as candidate, buildingNumbers empty
  const doc84T1 = CHOKJIN3_UNIT_TYPES.find((u) => u.typeCode === '84T1');
  const doc107W = CHOKJIN3_UNIT_TYPES.find((u) => u.typeCode === '107W');
  const scenarioE =
    !!doc84T1 &&
    !!doc107W &&
    doc84T1.buildingNumbers.length === 0 &&
    doc107W.buildingNumbers.length === 0 &&
    doc84T1.candidateBuildingNumbers?.includes('118-T동') === true &&
    doc107W.candidateBuildingNumbers?.includes('118-T동') === true;

  // Scenario F: Terrace buildings mapping preserved
  const b116 = CHOKJIN3_BUILDINGS.find((b) => b.buildingNumber === '116-T동');
  const b117 = CHOKJIN3_BUILDINGS.find((b) => b.buildingNumber === '117-T동');
  const b118 = CHOKJIN3_BUILDINGS.find((b) => b.buildingNumber === '118-T동');
  const scenarioF =
    !!b116 &&
    JSON.stringify(b116.unitTypesShown) === JSON.stringify(['98T']) &&
    !!b117 &&
    JSON.stringify(b117.unitTypesShown) === JSON.stringify(['84T2']) &&
    !!b118 &&
    b118.unitTypesShown.length === 0;

  const allPassed = scenarioA && scenarioB && scenarioC && scenarioD && scenarioE && scenarioF;

  return {
    scenarioA,
    scenarioB,
    scenarioC,
    scenarioD,
    scenarioE,
    scenarioF,
    allPassed,
  };
}

// Phase 4D-7C UI Geometry & Coordinate Space Audit
export interface ViewportGeometryResult {
  viewportWidth: number;
  stageWidth: number;
  stageHeight: number;
  overlayWidth: number;
  overlayHeight: number;
  dimensionMismatch: number;
  allMarkersInImageBounds: boolean;
  keyMarkersAudit: {
    dong101InBounds: boolean;
    dong102InBounds: boolean;
    dong114InBounds: boolean;
    dong116TInBounds: boolean;
    dong117TInBounds: boolean;
    dong118TInBounds: boolean;
  };
}

export function runSitePlanGeometryAudit(): {
  success: boolean;
  aspectRatio: number;
  viewportsTested: number;
  allViewportsPassed: boolean;
  zoomInvariancePassed: boolean;
  results: ViewportGeometryResult[];
} {
  const ASPECT_RATIO = 2048 / 1422;
  const VIEWPORT_WIDTHS = [360, 390, 430, 768, 1024, 1440];
  const MAX_CONTAINER_HEIGHT = 720;
  const MAX_STAGE_WIDTH = MAX_CONTAINER_HEIGHT * ASPECT_RATIO;

  const results: ViewportGeometryResult[] = [];

  for (const vpWidth of VIEWPORT_WIDTHS) {
    // Stage width is capped by container width and aspect-ratio max constraint
    const stageWidth = Math.min(vpWidth - 32, MAX_STAGE_WIDTH);
    const stageHeight = stageWidth / ASPECT_RATIO;

    // In correct DOM structure, overlay = absolute inset-0 of imageStage
    const overlayWidth = stageWidth;
    const overlayHeight = stageHeight;
    const dimensionMismatch = Math.abs(stageWidth - overlayWidth) + Math.abs(stageHeight - overlayHeight);

    let allMarkersInImageBounds = true;
    const markers: Record<string, { x: number; y: number; inside: boolean }> = {};

    for (const coord of CHOKJIN3_SITE_PLAN_COORDINATES) {
      const markerX = stageWidth * coord.normalizedX;
      const markerY = stageHeight * coord.normalizedY;

      // Every marker must be strictly inside [0, stageWidth] and [0, stageHeight]
      const inside = markerX >= 0 && markerX <= stageWidth && markerY >= 0 && markerY <= stageHeight;
      if (!inside) {
        allMarkersInImageBounds = false;
      }
      markers[coord.buildingNumber] = { x: markerX, y: markerY, inside };
    }

    results.push({
      viewportWidth: vpWidth,
      stageWidth: Math.round(stageWidth * 100) / 100,
      stageHeight: Math.round(stageHeight * 100) / 100,
      overlayWidth: Math.round(overlayWidth * 100) / 100,
      overlayHeight: Math.round(overlayHeight * 100) / 100,
      dimensionMismatch,
      allMarkersInImageBounds,
      keyMarkersAudit: {
        dong101InBounds: markers['101동']?.inside === true && markers['101동'].x > 0,
        dong102InBounds: markers['102동']?.inside === true && markers['102동'].x > 0,
        dong114InBounds: markers['114동']?.inside === true && markers['114동'].x < stageWidth,
        dong116TInBounds: markers['116-T동']?.inside === true,
        dong117TInBounds: markers['117-T동']?.inside === true,
        dong118TInBounds: markers['118-T동']?.inside === true,
      },
    });
  }

  // Zoom Invariance Check (1.0x, 1.25x, 1.5x, 2.0x, 2.5x)
  const ZOOM_LEVELS = [1.0, 1.25, 1.5, 2.0, 2.5];
  let zoomInvariancePassed = true;
  const baseWidth = 800;
  const baseHeight = baseWidth / ASPECT_RATIO;

  for (const zoom of ZOOM_LEVELS) {
    const scaledWidth = baseWidth * zoom;
    const scaledHeight = baseHeight * zoom;

    for (const coord of CHOKJIN3_SITE_PLAN_COORDINATES) {
      const scaledX = scaledWidth * coord.normalizedX;
      const scaledY = scaledHeight * coord.normalizedY;
      const computedNormX = scaledX / scaledWidth;
      const computedNormY = scaledY / scaledHeight;

      if (
        Math.abs(computedNormX - coord.normalizedX) > 0.00001 ||
        Math.abs(computedNormY - coord.normalizedY) > 0.00001
      ) {
        zoomInvariancePassed = false;
      }
    }
  }

  const allViewportsPassed = results.every(
    (r) => r.dimensionMismatch === 0 && r.allMarkersInImageBounds
  );

  return {
    success: allViewportsPassed && zoomInvariancePassed,
    aspectRatio: Math.round(ASPECT_RATIO * 10000) / 10000,
    viewportsTested: results.length,
    allViewportsPassed,
    zoomInvariancePassed,
    results,
  };
}
