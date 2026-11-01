import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  MapPin,
  Split,
  Scale,
} from 'lucide-react';
import { RedevelopmentProject } from '../types/redevelopment.ts';
import { ProjectPlanConfig } from '../types/planConfig.ts';
import { getProjectPlanConfig } from '../data/projects/planRegistry.ts';
import { usePlanTouchGestures } from '../utils/planTouchGestures.ts';
import { InteractiveSitePlan } from './InteractiveSitePlan.tsx';
import { UnitTypeComparison } from './UnitTypeComparison.tsx';
import { FirestoreUnitTypeDoc } from '../schema/firestoreSchema.ts';

interface UnitPlanViewProps {
  projects: RedevelopmentProject[];
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
}

/**
 * Helper to dynamically determine initial/default group and type from project plan config
 */
function getDefaultGroupAndType(config: ProjectPlanConfig | null): { groupCode: string; typeCode: string } {
  if (!config || !config.capabilities?.hasUnitPlans || !config.areaGroups || config.areaGroups.length === 0) {
    return { groupCode: '', typeCode: '' };
  }
  // Select group with highest totalUnits (or first group)
  const sorted = [...config.areaGroups].sort((a, b) => (b.totalUnits || 0) - (a.totalUnits || 0));
  const primaryGroup = sorted[0] || config.areaGroups[0];
  const primaryType = primaryGroup.types?.[0] || config.unitTypes?.[0]?.typeCode || '';
  return { groupCode: primaryGroup.groupCode, typeCode: primaryType };
}

export const UnitPlanView: React.FC<UnitPlanViewProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
}) => {
  // 1. Single Entry Point: ProjectPlanConfig resolution via planRegistry
  const planConfig: ProjectPlanConfig | null = getProjectPlanConfig(selectedProjectId);
  const capabilities = planConfig?.capabilities;
  const displayName =
    planConfig?.displayName ||
    projects.find((p) => p.id === selectedProjectId)?.name ||
    selectedProjectId;

  const unitTypes: FirestoreUnitTypeDoc[] = planConfig?.unitTypes || [];
  const areaGroups = planConfig?.areaGroups || [];
  const buildings = planConfig?.buildings || [];
  const coordinates = planConfig?.coordinates || [];
  const sitePlan = planConfig?.sitePlan || null;
  const planVersion = planConfig?.planVersion || null;

  // 2. Initial state determination
  const initialDefaults = getDefaultGroupAndType(planConfig);

  // Area Group selection
  const [selectedGroupCode, setSelectedGroupCode] = useState<string>(initialDefaults.groupCode);
  // Selected Unit Type
  const [selectedTypeCode, setSelectedTypeCode] = useState<string>(initialDefaults.typeCode);
  // Duplex / Multi-level floor selection: '1F' | '2F' | 'B1' | 'both'
  const [duplexFloorView, setDuplexFloorView] = useState<string>('1F');
  // Zoom level for floor plan & site plan
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  // View mode: 'site_layout' (단지 전체 배치도, 기본 진입), 'unit_plan' (단위세대 평면), 'type_compare' (타입 비교)
  const [viewMode, setViewMode] = useState<'site_layout' | 'unit_plan' | 'type_compare'>('site_layout');
  // Selected types for side-by-side comparison (max 3) - Always initialized to empty array (Phase 4E-6)
  const [selectedCompareTypes, setSelectedCompareTypes] = useState<string[]>([]);

  // Building selection and cross-link highlighting
  const [selectedDong, setSelectedDong] = useState<string>(
    (planConfig?.capabilities?.hasBuildingMappings && planConfig?.buildings?.[0]?.buildingNumber) || ''
  );
  const [highlightedBuildings, setHighlightedBuildings] = useState<string[]>([]);
  const [candidateHighlightBuildings, setCandidateHighlightBuildings] = useState<string[]>([]);
  const [highlightNotice, setHighlightNotice] = useState<string | null>(null);

  // Floor plan viewport ref, image ref, and container & image dimensions
  const floorViewportRef = useRef<HTMLDivElement>(null);
  usePlanTouchGestures(floorViewportRef, zoomLevel, setZoomLevel, `${viewMode}:${selectedProjectId}:${selectedTypeCode}`);
  const planImgRef = useRef<HTMLImageElement>(null);
  const prevPlanZoomRef = useRef<number>(zoomLevel);
  const [floorContainerDim, setFloorContainerDim] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [planImgNaturalSize, setPlanImgNaturalSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Reset ALL project-dependent selections and state when selectedProjectId changes (Phase 4E-6 State Isolation)
  useEffect(() => {
    const cfg = getProjectPlanConfig(selectedProjectId);
    const defaults = getDefaultGroupAndType(cfg);

    setSelectedGroupCode(defaults.groupCode);
    setSelectedTypeCode(defaults.typeCode);
    setSelectedDong(
      (cfg?.capabilities?.hasBuildingMappings && cfg?.buildings?.[0]?.buildingNumber) || ''
    );
    setHighlightedBuildings([]);
    setCandidateHighlightBuildings([]);
    setHighlightNotice(null);
    setSelectedCompareTypes([]); // Always empty array on project change
    setZoomLevel(1);
    setDuplexFloorView('1F');
    setPlanImgNaturalSize({ width: 0, height: 0 });

    if (floorViewportRef.current) {
      floorViewportRef.current.scrollLeft = 0;
      floorViewportRef.current.scrollTop = 0;
    }
  }, [selectedProjectId]);

  // Measure floor plan viewport container
  useEffect(() => {
    const vp = floorViewportRef.current;
    if (!vp) return;

    const measure = () => {
      const w = vp.clientWidth;
      const h = vp.clientHeight;
      if (w > 0 && h > 0) {
        setFloorContainerDim({ width: w, height: h });
      }
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [viewMode, selectedTypeCode, duplexFloorView]);

  // Reset zoom and scroll on type change, duplex floor change, or tab switch
  useEffect(() => {
    setZoomLevel(1);
    if (floorViewportRef.current) {
      floorViewportRef.current.scrollLeft = 0;
      floorViewportRef.current.scrollTop = 0;
    }
  }, [selectedTypeCode, duplexFloorView, viewMode]);

  // Available groups & current active group
  const currentGroup =
    areaGroups.find((g) => g.groupCode === selectedGroupCode) ||
    areaGroups[0] ||
    null;

  // Types in current group
  const typesInGroup = currentGroup?.types || [];

  // Selected Unit Type doc
  const currentUnitDoc: FirestoreUnitTypeDoc | undefined =
    unitTypes.find((u) => u.typeCode === selectedTypeCode) ||
    (typesInGroup.length > 0 ? unitTypes.find((u) => u.typeCode === typesInGroup[0]) : undefined) ||
    unitTypes[0];

  // Check if type-level unit counts are verified or unverified placeholders (e.g. samik-beach supply allocation is unverified)
  const isTypeUnitsUnverified =
    capabilities?.hasSupplyAllocation === false ||
    planConfig?.availability?.supplyAllocation === 'source_not_available' ||
    (currentUnitDoc?.units === 0 && currentUnitDoc?.verificationStatus === 'unverified');

  const isDocUnitsUnverified = (doc?: FirestoreUnitTypeDoc): boolean => {
    if (capabilities?.hasSupplyAllocation === false) return true;
    if (planConfig?.availability?.supplyAllocation === 'source_not_available') return true;
    if (!doc) return isTypeUnitsUnverified;
    if (doc.verificationStatus === 'unverified') return true;
    if (doc.units === 0 && doc.verificationStatus !== 'verified') return true;
    return false;
  };

  const formatUnitCount = (units: number | undefined | null, doc?: FirestoreUnitTypeDoc): string => {
    const unverified = isDocUnitsUnverified(doc || currentUnitDoc);
    if (unverified || units === undefined || units === null || (units === 0 && unverified)) {
      return '세대수 미확인';
    }
    return `${units.toLocaleString()}세대`;
  };

  const formatGroupUnitsOrTypes = (grp: { types?: string[]; totalUnits?: number }): string => {
    if (isTypeUnitsUnverified) {
      const typeCount = grp.types?.length || grp.totalUnits || 0;
      return `${typeCount}개 타입`;
    }
    return `${(grp.totalUnits || 0).toLocaleString()}세대`;
  };

  const handleGroupSelect = (groupCode: string) => {
    setSelectedGroupCode(groupCode);
    const grp = areaGroups.find((g) => g.groupCode === groupCode);
    if (grp && grp.types.length > 0) {
      setSelectedTypeCode(grp.types[0]);
    }
    setZoomLevel(1);
    setDuplexFloorView('1F');
  };

  const handleTypeSelect = (typeCode: string) => {
    setSelectedTypeCode(typeCode);
    setZoomLevel(1);
    setDuplexFloorView('1F');
  };

  // Dong selection and bi-directional cross-link handlers
  const handleDongSelect = (dongNum: string) => {
    setSelectedDong(dongNum);
  };

  const handleClearHighlight = () => {
    setHighlightedBuildings([]);
    setCandidateHighlightBuildings([]);
    setHighlightNotice(null);
  };

  const handleGoToSitePlanForType = (typeCode: string) => {
    const matchedUnit = unitTypes.find((u) => u.typeCode === typeCode);
    if (!matchedUnit) return;

    if (matchedUnit.buildingNumbers && matchedUnit.buildingNumbers.length > 0) {
      setHighlightedBuildings(matchedUnit.buildingNumbers);
      setCandidateHighlightBuildings([]);
      setSelectedDong(matchedUnit.buildingNumbers[0]);
      setHighlightNotice(
        `${typeCode} 타입 배치 주동 (총 ${matchedUnit.buildingNumbers.length}개 동: ${matchedUnit.buildingNumbers.join(', ')})`
      );
    } else if (matchedUnit.candidateBuildingNumbers && matchedUnit.candidateBuildingNumbers.length > 0) {
      setHighlightedBuildings([]);
      setCandidateHighlightBuildings(matchedUnit.candidateBuildingNumbers);
      setSelectedDong(matchedUnit.candidateBuildingNumbers[0]);
      setHighlightNotice(
        `${typeCode} 타입: ${matchedUnit.candidateBuildingNumbers.join(', ')} 후보동 (배치 미확정)`
      );
    } else {
      setHighlightedBuildings([]);
      setCandidateHighlightBuildings([]);
      setHighlightNotice(
        `${typeCode} 타입: 도면/배치도상 세부 배치 확인 필요`
      );
    }
    setViewMode('site_layout');
    setZoomLevel(1);
  };

  const handleSelectTypeFromDong = (typeCode: string) => {
    const matchedUnit = unitTypes.find((u) => u.typeCode === typeCode);
    if (matchedUnit) {
      setSelectedGroupCode(matchedUnit.areaGroup);
      setSelectedTypeCode(matchedUnit.typeCode);
      setViewMode('unit_plan');
      setZoomLevel(1);
      setDuplexFloorView('1F');
    }
  };

  // Type Comparison handlers
  const handleToggleCompareType = (typeCode: string) => {
    setSelectedCompareTypes((prev) => {
      if (prev.includes(typeCode)) {
        return prev.filter((t) => t !== typeCode);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, typeCode];
    });
  };

  const handleRemoveCompareType = (typeCode: string) => {
    setSelectedCompareTypes((prev) => prev.filter((t) => t !== typeCode));
  };

  const handleClearCompareTypes = () => {
    setSelectedCompareTypes([]);
  };

  const PLAN_ZOOM_LEVELS = [1, 1.25, 1.5, 1.75, 2.0, 2.5];

  const handleZoomIn = () => {
    setZoomLevel((prev) => {
      const next = PLAN_ZOOM_LEVELS.find((lvl) => lvl > prev + 0.05);
      return next !== undefined ? next : 2.5;
    });
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const prevLevels = PLAN_ZOOM_LEVELS.filter((lvl) => lvl < prev - 0.05);
      return prevLevels.length > 0 ? prevLevels[prevLevels.length - 1] : 1;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    if (floorViewportRef.current) {
      floorViewportRef.current.scrollLeft = 0;
      floorViewportRef.current.scrollTop = 0;
    }
  };

  // Natural image load measurement
  const handlePlanImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setPlanImgNaturalSize({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    }
  };

  // Floor plan fit calculation
  const floorAvailW = floorContainerDim.width || 360;
  const floorAvailH = floorContainerDim.height || 480;
  const isMobilePlan = typeof window !== 'undefined' && window.innerWidth < 640;
  const planPadX = isMobilePlan ? 12 : 24;
  const planPadY = isMobilePlan ? 12 : 24;
  const usablePlanW = Math.max(100, floorAvailW - planPadX);
  const usablePlanH = Math.max(100, floorAvailH - planPadY);

  const natPlanW = planImgNaturalSize.width > 0 ? planImgNaturalSize.width : 1600;
  const natPlanH = planImgNaturalSize.height > 0 ? planImgNaturalSize.height : 1200;
  const planAspect = natPlanW / natPlanH;

  let planFitWidth: number;
  let planFitHeight: number;

  if (isMobilePlan) {
    planFitWidth = usablePlanW;
    planFitHeight = Math.round(usablePlanW / planAspect);
    if (usablePlanH > 150 && planFitHeight > usablePlanH) {
      planFitHeight = usablePlanH;
      planFitWidth = Math.round(usablePlanH * planAspect);
    }
  } else {
    const scaleW = usablePlanW / natPlanW;
    const scaleH = usablePlanH / natPlanH;
    const fitScale = Math.min(scaleW, scaleH);
    planFitWidth = Math.round(natPlanW * fitScale);
    planFitHeight = Math.round(natPlanH * fitScale);
  }

  const planStageWidth = Math.round(planFitWidth * zoomLevel);
  const planStageHeight = Math.round(planFitHeight * zoomLevel);

  // Relative center preservation when zooming floor plan
  useEffect(() => {
    const vp = floorViewportRef.current;
    const prevZoom = prevPlanZoomRef.current;
    prevPlanZoomRef.current = zoomLevel;

    if (!vp || planFitWidth <= 0) return;

    if (zoomLevel === 1) {
      vp.scrollLeft = 0;
      vp.scrollTop = 0;
      return;
    }

    if (prevZoom > 0 && prevZoom !== zoomLevel) {
      const oldW = Math.round(planFitWidth * prevZoom);
      const oldH = Math.round(planFitHeight * prevZoom);
      const newW = Math.round(planFitWidth * zoomLevel);
      const newH = Math.round(planFitHeight * zoomLevel);

      const centerRelX = (vp.scrollLeft + vp.clientWidth / 2) / oldW;
      const centerRelY = (vp.scrollTop + vp.clientHeight / 2) / oldH;

      const targetLeft = centerRelX * newW - vp.clientWidth / 2;
      const targetTop = centerRelY * newH - vp.clientHeight / 2;

      requestAnimationFrame(() => {
        if (vp) {
          const maxLeft = Math.max(0, newW - vp.clientWidth);
          const maxTop = Math.max(0, newH - vp.clientHeight);
          vp.scrollLeft = Math.max(0, Math.min(maxLeft, targetLeft));
          vp.scrollTop = Math.max(0, Math.min(maxTop, targetTop));
        }
      });
    }
  }, [zoomLevel, planFitWidth, planFitHeight]);

  const isDuplex = !!(currentUnitDoc?.sourceAsset?.isDuplex || currentUnitDoc?.sourceAsset?.isMultiLevel);

  // Asset paths for current unit
  const primaryAssetPath =
    currentUnitDoc?.sourceAsset?.primaryAssetPath ||
    currentUnitDoc?.sourceAsset?.assetPath ||
    currentUnitDoc?.sourceAsset?.imageUrl ||
    null;

  const secondaryAssetPath =
    currentUnitDoc?.sourceAsset?.secondaryAssetPath ||
    currentUnitDoc?.sourceAsset?.secondaryImageUrl ||
    null;

  const tertiaryAssetPath =
    currentUnitDoc?.sourceAsset?.tertiaryAssetPath ||
    currentUnitDoc?.sourceAsset?.tertiaryImageUrl ||
    null;

  const unitFloors: Array<{ floorId: string; label: string; assetPath: string }> = (() => {
    if (currentUnitDoc?.sourceAsset?.floors && currentUnitDoc.sourceAsset.floors.length > 0) {
      return currentUnitDoc.sourceAsset.floors.map((f) => ({
        floorId: f.floorId,
        label: f.label,
        assetPath: f.assetPath,
      }));
    }
    const list: Array<{ floorId: string; label: string; assetPath: string }> = [];
    if (primaryAssetPath) {
      list.push({
        floorId: '1F',
        label: currentUnitDoc?.sourceAsset?.floor1Label || '1F (하층 도면)',
        assetPath: primaryAssetPath,
      });
    }
    if (secondaryAssetPath) {
      list.push({
        floorId: '2F',
        label: currentUnitDoc?.sourceAsset?.floor2Label || '2F (상층 도면)',
        assetPath: secondaryAssetPath,
      });
    }
    if (tertiaryAssetPath) {
      list.push({
        floorId: 'B1',
        label: currentUnitDoc?.sourceAsset?.floor3Label || 'B1 (지하1층 도면)',
        assetPath: tertiaryAssetPath,
      });
    }
    return list;
  })();

  const activeFloor = unitFloors.find((f) => f.floorId === duplexFloorView) || unitFloors[0];
  const activePlanSrc = isDuplex && duplexFloorView !== 'both'
    ? (activeFloor?.assetPath || primaryAssetPath)
    : (duplexFloorView === '2F' && secondaryAssetPath ? secondaryAssetPath : primaryAssetPath);

  // Capability checks
  const canShowSitePlan = !!(capabilities?.hasSitePlan && sitePlan?.assetPath);
  const canShowUnitPlans = !!(capabilities?.hasUnitPlans && unitTypes.length > 0 && currentGroup);
  const canShowComparison = !!(capabilities?.hasUnitComparison && unitTypes.length > 0);

  return (
    <div id="unit-plan-view-container" className="space-y-3 sm:space-y-5 w-full max-w-full overflow-hidden">
      {/* 1. Project Selector Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-2.5 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600 shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900">단지계획 및 단위세대 평면</h2>
          </div>
          <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto min-w-0" id="project-filter-buttons">
            {projects.map((p) => {
              const isSelected = selectedProjectId === p.id;
              const pConfig = getProjectPlanConfig(p.id);
              const pDisplayName = pConfig?.displayName || p.name;
              const isPrepared = !!(pConfig?.capabilities?.hasSitePlan || pConfig?.capabilities?.hasUnitPlans);

              return (
                <button
                  key={p.id}
                  id={`plan-project-btn-${p.id}`}
                  onClick={() => onSelectProject(p.id)}
                  className={`min-h-[40px] sm:min-h-[36px] px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center text-center whitespace-nowrap overflow-hidden ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{pDisplayName}</span>
                  {!isPrepared && (
                    <span className="hidden sm:inline-block ml-1 text-[10px] font-normal opacity-70">
                      (준비중)
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Unified Plan Content Area */}
      <div className="space-y-3 sm:space-y-5">
        {/* Top Header & Sub-tabs */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-xs space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  단지계획
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {displayName}
                  {planVersion?.totalSupplySummary?.totalUnits ? (
                    ` · 총 ${planVersion.totalSupplySummary.totalUnits.toLocaleString()}세대`
                  ) : planVersion?.totalUnitsInPlanSet ? (
                    ` · 총 ${planVersion.totalUnitsInPlanSet.toLocaleString()}세대`
                  ) : isTypeUnitsUnverified ? (
                    ' · 타입별 공급세대수 공식 미확인'
                  ) : !capabilities?.hasSitePlan && !capabilities?.hasUnitPlans ? (
                    ' · 사업계획 자료 준비중'
                  ) : null}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(() => {
                  const status = (planConfig?.documentStatus || planVersion?.confirmationStatus as string) || 'unknown';
                  const evidenceRef = planVersion?.totalSupplySummary?.evidenceSourceId || planVersion?.evidenceSourceId;
                  const evidenceSource = evidenceRef
                    ? planConfig?.evidenceSources?.find((s) => s.sourceId === evidenceRef)
                    : planConfig?.evidenceSources?.[0];

                  return (
                    <>
                      {status === 'proposal' && (
                        <>
                          <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] sm:text-xs font-semibold">
                            {planVersion?.sourceType === 'association' ? '조합자료 기준' : '제안안 기준'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 text-[10px] sm:text-xs font-semibold">
                            최종 확정안 아님
                          </span>
                        </>
                      )}
                      {status === 'approved' && (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] sm:text-xs font-semibold">
                          승인된 계획 기준
                        </span>
                      )}
                      {(status === 'final' || status === 'confirmed') && (
                        <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800 text-[10px] sm:text-xs font-semibold">
                          최종 확인 자료
                        </span>
                      )}
                      {status === 'unknown' && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 text-[10px] sm:text-xs font-semibold">
                          {capabilities?.hasSitePlan || capabilities?.hasUnitPlans ? '확인 필요' : '자료 준비중'}
                        </span>
                      )}
                      {evidenceSource && (
                        <span
                          className="px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-600 text-[10px] sm:text-xs font-medium"
                          title={evidenceSource.evidenceNotes || evidenceSource.issuer}
                        >
                          출처: {evidenceSource.issuer || evidenceSource.title}
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Three Core Sub-Tabs */}
            <div
              className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 w-full sm:w-auto"
              style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
            >
              <button
                id="tab-btn-site-layout"
                onClick={() => {
                  setViewMode('site_layout');
                  setZoomLevel(1);
                }}
                className={`min-h-[40px] px-1 sm:px-4 py-2 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer whitespace-nowrap overflow-visible ${
                  viewMode === 'site_layout'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                style={{ textOverflow: 'clip' }}
              >
                <MapPin className="w-4 h-4 shrink-0 hidden sm:inline-block" />
                <span className="whitespace-nowrap overflow-visible">전체 배치도</span>
              </button>
              <button
                id="tab-btn-unit-plan"
                onClick={() => {
                  setViewMode('unit_plan');
                  setZoomLevel(1);
                }}
                className={`min-h-[40px] px-1 sm:px-4 py-2 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer whitespace-nowrap overflow-visible ${
                  viewMode === 'unit_plan'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                style={{ textOverflow: 'clip' }}
              >
                <Layers className="w-4 h-4 shrink-0 hidden sm:inline-block" />
                <span className="whitespace-nowrap overflow-visible">단위세대 평면</span>
              </button>
              <button
                id="tab-btn-type-compare"
                onClick={() => {
                  setViewMode('type_compare');
                  setZoomLevel(1);
                }}
                className={`min-h-[40px] px-1 sm:px-4 py-2 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer whitespace-nowrap overflow-visible ${
                  viewMode === 'type_compare'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                style={{ textOverflow: 'clip' }}
              >
                <Scale className="w-4 h-4 shrink-0 hidden sm:inline-block" />
                <span className="whitespace-nowrap overflow-visible">타입 비교</span>
                {selectedCompareTypes.length > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 ${
                      viewMode === 'type_compare'
                        ? 'bg-blue-800 text-white'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {selectedCompareTypes.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 1. Master Site Layout Mode */}
        {viewMode === 'site_layout' && (
          <div id="master-site-layout-panel" className="bg-white rounded-xl border border-slate-200 p-3 sm:p-5 shadow-xs">
            {canShowSitePlan ? (
              <InteractiveSitePlan
                sitePlanAsset={sitePlan?.assetPath || null}
                coordinates={capabilities?.hasInteractiveCoordinates && coordinates ? coordinates : []}
                buildings={buildings}
                selectedBuilding={selectedDong}
                onSelectBuilding={handleDongSelect}
                highlightedBuildings={highlightedBuildings}
                candidateBuildings={candidateHighlightBuildings}
                highlightNotice={highlightNotice}
                onClearHighlight={handleClearHighlight}
                onSelectType={handleSelectTypeFromDong}
                unitTypes={unitTypes}
                zoomLevel={zoomLevel}
                onZoomChange={setZoomLevel}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onResetZoom={handleResetZoom}
              />
            ) : (
              <div id="site-plan-empty-state" className="p-8 sm:p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <MapPin className="w-8 h-8" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1">
                  배치도 자료 준비중
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
                  {displayName} 공식 단지배치도 자료가 확보되는 대로 업데이트될 예정입니다.
                </p>
                {planConfig?.notices && planConfig.notices.length > 0 && (
                  <div className="max-w-md mx-auto bg-slate-50 rounded-lg p-3 text-left border border-slate-200 space-y-1">
                    {planConfig.notices.map((notice, idx) => (
                      <p key={idx} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <span className="text-slate-400">•</span>
                        <span>{notice}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. Unit Floor Plan Mode */}
        {viewMode === 'unit_plan' && (
          <div className="space-y-4 sm:space-y-6">
            {canShowUnitPlans ? (
              <>
                {/* Step 1: 면적군 선택 */}
                <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                        면적군 선택
                      </h4>
                    </div>
                    {currentGroup && (
                      <span className="text-[11px] text-slate-500">
                        선택: <strong className="text-blue-600 font-bold">{currentGroup.name}</strong> ({formatGroupUnitsOrTypes(currentGroup)})
                      </span>
                    )}
                  </div>

                  {/* Mobile: Horizontal scrollable track */}
                  <div className="sm:hidden -mx-3.5 px-3.5 overflow-x-auto pb-1.5 flex gap-1.5 scrollbar-none snap-x">
                    {areaGroups.map((grp) => {
                      const isSelected = selectedGroupCode === grp.groupCode;
                      return (
                        <button
                          key={grp.groupCode}
                          id={`area-group-mobile-btn-${grp.groupCode}`}
                          onClick={() => handleGroupSelect(grp.groupCode)}
                          className={`min-h-[44px] min-w-[76px] px-2.5 py-1.5 rounded-xl text-center transition-all cursor-pointer border shrink-0 snap-start flex flex-col justify-center ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="text-xs font-bold leading-tight">{grp.name}</div>
                          <div
                            className={`text-[10px] font-semibold mt-0.5 ${
                              isSelected ? 'text-blue-100' : 'text-blue-600'
                            }`}
                          >
                            {formatGroupUnitsOrTypes(grp)}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Desktop & Tablet: Responsive Grid */}
                  <div className="hidden sm:grid sm:grid-cols-7 lg:grid-cols-13 gap-1.5" id="area-group-selector">
                    {areaGroups.map((grp) => {
                      const isSelected = selectedGroupCode === grp.groupCode;
                      return (
                        <button
                          key={grp.groupCode}
                          id={`area-group-btn-${grp.groupCode}`}
                          onClick={() => handleGroupSelect(grp.groupCode)}
                          className={`min-h-[48px] p-1.5 rounded-lg text-center transition-all cursor-pointer border flex flex-col justify-center ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="text-xs font-bold">{grp.name}</div>
                          <div
                            className={`text-[10px] font-semibold mt-0.5 ${
                              isSelected ? 'text-blue-100' : 'text-blue-600'
                            }`}
                          >
                            {formatGroupUnitsOrTypes(grp)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Unit Type Selector */}
                <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                        {currentGroup?.name} 타입 선택
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      선택: <strong className="text-blue-600 font-bold">{selectedTypeCode}</strong> {isTypeUnitsUnverified ? '· 세대수 미확인' : `(${currentUnitDoc?.units ?? 0}세대)`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2" id="type-selector-pills">
                    {typesInGroup.map((type) => {
                      const isSelected = selectedTypeCode === type;
                      const doc = unitTypes.find((u) => u.typeCode === type);
                      const isUnverified = isDocUnitsUnverified(doc);
                      const unitsCount = doc?.units ?? 0;
                      const features = doc?.specialFeatures || [];

                      return (
                        <button
                          key={type}
                          id={`type-btn-${type}`}
                          onClick={() => handleTypeSelect(type)}
                          className={`min-h-[42px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center justify-between sm:justify-start gap-1.5 min-w-0 ${
                            isSelected
                              ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                          title={`${type} ${isUnverified ? '세대수 미확인' : `${unitsCount}세대`}`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm font-bold">{type}</span>
                            {features.map((feat) => (
                              <span
                                key={feat}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                                  isSelected ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {feat}
                              </span>
                            ))}
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                              isSelected
                                ? 'bg-slate-700 text-slate-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isUnverified ? '세대수 미확인' : `${unitsCount}세대`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 3: Floor Plan Display */}
                <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-5 shadow-xs space-y-3 min-w-0">
                  {/* Header Directly Above Image */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        {displayName} {selectedTypeCode}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${
                          isTypeUnitsUnverified
                            ? 'bg-slate-100 text-slate-600 border border-slate-200'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {formatUnitCount(currentUnitDoc?.units, currentUnitDoc)}
                      </span>
                    </div>

                    {/* Floor Switcher & Zoom Controls */}
                    <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto shrink-0">
                      {isDuplex && unitFloors.length > 1 && (
                        <div className="flex items-center gap-0.5 bg-blue-50 border border-blue-200 rounded-lg p-0.5" id="duplex-floor-tabs">
                          {unitFloors.map((fl) => (
                            <button
                              key={fl.floorId}
                              id={`duplex-floor-${fl.floorId.toLowerCase()}-btn`}
                              onClick={() => setDuplexFloorView(fl.floorId)}
                              className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-all ${
                                duplexFloorView === fl.floorId
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'text-blue-900 hover:bg-blue-100/80'
                              }`}
                            >
                              {fl.floorId}
                            </button>
                          ))}
                          <button
                            id="duplex-floor-both-btn"
                            onClick={() => setDuplexFloorView('both')}
                            className={`px-2 py-1 rounded text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
                              duplexFloorView === 'both'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-blue-900 hover:bg-blue-100/80'
                            }`}
                          >
                            <Split className="w-3 h-3 shrink-0" />
                            <span>병렬</span>
                          </button>
                        </div>
                      )}

                      {/* Compact Zoom Toolbar */}
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                        <button
                          id="plan-zoom-out-btn"
                          onClick={handleZoomOut}
                          disabled={zoomLevel <= 1}
                          className="min-h-[34px] min-w-[34px] p-1.5 rounded hover:bg-white text-slate-700 flex items-center justify-center cursor-pointer disabled:opacity-40"
                          title="축소"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id="plan-zoom-reset-btn"
                          onClick={handleResetZoom}
                          className="min-h-[34px] px-2.5 rounded hover:bg-white text-slate-700 flex items-center gap-1 cursor-pointer text-xs font-bold"
                          title="화면맞춤"
                        >
                          <RotateCcw className="w-3 h-3 text-slate-400" />
                          <span>{zoomLevel === 1 ? '화면맞춤' : `${Math.round(zoomLevel * 100)}%`}</span>
                        </button>
                        <button
                          id="plan-zoom-in-btn"
                          onClick={handleZoomIn}
                          disabled={zoomLevel >= 2.5}
                          className="min-h-[34px] min-w-[34px] p-1.5 rounded hover:bg-white text-slate-700 flex items-center justify-center cursor-pointer disabled:opacity-40"
                          title="확대"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Floor Plan Viewport: Fit to width & height, real zoom, overflow-auto panning */}
                  <div
                    id="floor-plan-viewport"
                    ref={floorViewportRef}
                    data-zoom={zoomLevel}
                    data-fit-width={planFitWidth}
                    data-fit-height={planFitHeight}
                    data-stage-width={planStageWidth}
                    data-stage-height={planStageHeight}
                    className="relative border border-slate-200 rounded-xl overflow-auto bg-slate-100/80 p-2 sm:p-4 h-[55vh] sm:h-[68vh] lg:h-[72vh] min-h-[340px] max-h-[760px] w-full max-w-full select-none"
                    style={{
                      touchAction: 'none',
                      overscrollBehavior: 'contain',
                    }}
                  >
                    <div
                      id="floor-plan-scroll-content"
                      className={`min-w-full min-h-full flex ${
                        zoomLevel === 1 ? 'justify-center items-center m-auto' : 'justify-start items-start'
                      }`}
                      style={{
                        minWidth: '100%',
                        minHeight: '100%',
                        width: zoomLevel === 1 ? '100%' : 'max-content',
                        height: zoomLevel === 1 ? '100%' : 'max-content',
                      }}
                    >
                      {isDuplex && duplexFloorView === 'both' ? (
                        <div
                          id="floor-plan-duplex-both-stage"
                          className={`relative shrink-0 select-none grid gap-3 sm:gap-4 p-1 ${
                            unitFloors.length >= 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'
                          }`}
                          style={{
                            width: `${planStageWidth}px`,
                            minHeight: `${planStageHeight}px`,
                            maxWidth: 'none',
                            maxHeight: 'none',
                            flex: 'none',
                          }}
                        >
                          {unitFloors.map((fl, idx) => (
                            <div
                              key={fl.floorId || idx}
                              id={`floor-plan-both-${fl.floorId.toLowerCase()}`}
                              className="bg-white rounded-xl border border-slate-200 p-2 sm:p-3 shadow-xs flex flex-col space-y-2 min-w-0"
                            >
                              <span
                                className={`text-xs font-bold ${
                                  idx === 0
                                    ? 'text-blue-700'
                                    : idx === 1
                                    ? 'text-purple-700'
                                    : 'text-emerald-700'
                                }`}
                              >
                                {fl.label}
                              </span>
                              <div className="flex-1 flex items-center justify-center min-h-[220px] bg-slate-50 rounded-lg overflow-hidden border border-slate-100 p-1">
                                {fl.assetPath ? (
                                  <img
                                    src={fl.assetPath}
                                    alt={`${selectedTypeCode} ${fl.label}`}
                                    className="w-full h-full object-contain block mx-auto rounded select-none pointer-events-none"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <span className="text-xs text-slate-400">도면 이미지가 없습니다</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center w-full p-1 min-w-0">
                          {isDuplex && (
                            <div className="mb-2 text-xs font-bold text-slate-700 flex items-center gap-1.5 bg-white/90 px-3 py-1 rounded-full border border-slate-200 shadow-2xs">
                              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                              <span>{selectedTypeCode} {activeFloor?.label || (duplexFloorView === '2F' ? '2F (상층 도면)' : '1F (하층 도면)')}</span>
                            </div>
                          )}
                          <div
                            id="floor-plan-image-stage"
                            className="relative shrink-0 select-none leading-none rounded-xl border border-slate-300 shadow-xs bg-white overflow-hidden"
                            style={{
                              position: 'relative',
                              width: `${planStageWidth}px`,
                              height: `${planStageHeight}px`,
                              maxWidth: 'none',
                              maxHeight: 'none',
                              flex: 'none',
                            }}
                          >
                            {activePlanSrc ? (
                              <img
                                id={`plan-asset-img-${selectedTypeCode}`}
                                ref={planImgRef}
                                src={activePlanSrc}
                                alt={`${currentUnitDoc?.typeName || selectedTypeCode} 평면도`}
                                className="w-full h-full object-contain block select-none pointer-events-none"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  display: 'block',
                                  maxWidth: 'none',
                                  maxHeight: 'none',
                                }}
                                referrerPolicy="no-referrer"
                                onLoad={handlePlanImageLoad}
                              />
                            ) : (
                              <div className="w-full h-full min-h-[300px] flex items-center justify-center text-slate-400 text-xs">
                                도면 이미지가 없습니다
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 4: 핵심 정보 (평면 기본 특징) */}
                <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                      평면 기본 특징
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">전용면적</span>
                      <strong className="text-slate-900 text-sm font-bold">
                        {currentUnitDoc?.netAreaM2 != null ? `${currentUnitDoc.netAreaM2}㎡` : '미확인'} ({currentUnitDoc?.areaGroup}㎡군)
                      </strong>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">세대수</span>
                      <strong className={`text-sm font-bold ${isTypeUnitsUnverified ? 'text-slate-700' : 'text-blue-700'}`}>
                        {formatUnitCount(currentUnitDoc?.units, currentUnitDoc)}
                      </strong>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">특화 설계</span>
                      <strong className="text-slate-900 font-semibold">
                        {currentUnitDoc?.specialFeatures && currentUnitDoc.specialFeatures.length > 0
                          ? currentUnitDoc.specialFeatures.join(', ')
                          : currentUnitDoc?.netAreaM2 == null ? '확인 필요' : '일반 평면'}
                      </strong>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">구조 형태</span>
                      <strong className="text-slate-900 font-semibold">
                        {isDuplex ? '복층 설계 (내부계단)' : currentUnitDoc?.netAreaM2 == null ? '원본 도면 참조' : '단층 설계'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Step 5: 공급계획 */}
                {currentUnitDoc?.allocation && (
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        조합자료상 공급계획
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        {isTypeUnitsUnverified && currentUnitDoc.allocation.totalUnits === 0
                          ? '총 세대수 미확인'
                          : `총 ${currentUnitDoc.allocation.totalUnits.toLocaleString()}세대`}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <span className="text-slate-500 block text-[11px] mb-0.5">조합원</span>
                        <strong
                          className={`text-sm font-bold ${
                            isTypeUnitsUnverified && currentUnitDoc.allocation.memberUnits === 0
                              ? 'text-slate-600 font-semibold'
                              : 'text-blue-700'
                          }`}
                        >
                          {isTypeUnitsUnverified && currentUnitDoc.allocation.memberUnits === 0
                            ? '미확인'
                            : `${currentUnitDoc.allocation.memberUnits.toLocaleString()}세대`}
                        </strong>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <span className="text-slate-500 block text-[11px] mb-0.5">일반분양</span>
                        <strong
                          className={`text-sm font-bold ${
                            isTypeUnitsUnverified && currentUnitDoc.allocation.generalSaleUnits === 0
                              ? 'text-slate-600 font-semibold'
                              : 'text-emerald-700'
                          }`}
                        >
                          {isTypeUnitsUnverified && currentUnitDoc.allocation.generalSaleUnits === 0
                            ? '미확인'
                            : `${currentUnitDoc.allocation.generalSaleUnits.toLocaleString()}세대`}
                        </strong>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <span className="text-slate-500 block text-[11px] mb-0.5">보류시설</span>
                        <strong
                          className={`text-sm font-bold ${
                            isTypeUnitsUnverified && currentUnitDoc.allocation.reservedUnits === 0
                              ? 'text-slate-600 font-semibold'
                              : 'text-slate-700'
                          }`}
                        >
                          {isTypeUnitsUnverified && currentUnitDoc.allocation.reservedUnits === 0
                            ? '미확인'
                            : `${currentUnitDoc.allocation.reservedUnits.toLocaleString()}세대`}
                        </strong>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-normal">
                      {isTypeUnitsUnverified
                        ? '※ 관리처분계획인가 전 단계로 타입별 세부 공급 세대수는 공식 미확인 상태입니다.'
                        : '※ 본 배분은 조합자료 기준 계획안이며 변경될 수 있습니다.'}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div id="unit-plan-empty-state" className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Layers className="w-8 h-8" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1">
                  단위세대 평면 자료 준비중
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
                  {displayName} 공식 평면도 자료가 확보되는 대로 업데이트될 예정입니다.
                </p>
                {planConfig?.notices && planConfig.notices.length > 0 && (
                  <div className="max-w-md mx-auto bg-slate-50 rounded-lg p-3 text-left border border-slate-200 space-y-1">
                    {planConfig.notices.map((notice, idx) => (
                      <p key={idx} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <span className="text-slate-400">•</span>
                        <span>{notice}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. Type Comparison Mode */}
        {viewMode === 'type_compare' && (
          <div>
            {canShowComparison ? (
              <UnitTypeComparison
                unitTypes={unitTypes}
                areaGroups={areaGroups}
                recommendedPresets={planConfig?.recommendedComparisons || []}
                selectedCompareTypes={selectedCompareTypes}
                onToggleCompareType={handleToggleCompareType}
                onRemoveCompareType={handleRemoveCompareType}
                onClearCompareTypes={handleClearCompareTypes}
                onGoToSitePlan={handleGoToSitePlanForType}
                onSelectTypeForDetail={handleSelectTypeFromDong}
              />
            ) : (
              <div id="type-compare-empty-state" className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Scale className="w-8 h-8" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1">
                  타입 비교 준비중
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                  평면 자료 확보 후 타입 비교를 제공할 예정입니다.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Common Bottom Notice */}
        <div className="text-center text-xs text-slate-500 py-1">
          {planConfig?.notices && planConfig.notices.length > 0
            ? `※ ${planConfig.notices[0]}`
            : '※ 본 자료는 계획안으로 향후 인허가 과정에서 변경될 수 있습니다.'}
        </div>
      </div>
    </div>
  );
};
