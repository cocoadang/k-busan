import React, { useState } from 'react';
import {
  X,
  Scale,
  Check,
  AlertCircle,
  Maximize2,
  Info,
} from 'lucide-react';
import { FirestoreUnitTypeDoc } from '../schema/firestoreSchema.ts';
import type { AreaGroupDefinition, RecommendedComparisonPreset } from '../types/planConfig.ts';

export type { RecommendedComparisonPreset };

export interface UnitTypeComparisonProps {
  unitTypes: FirestoreUnitTypeDoc[];
  areaGroups?: AreaGroupDefinition[];
  recommendedPresets?: RecommendedComparisonPreset[];
  selectedCompareTypes: string[];
  onToggleCompareType: (typeCode: string) => void;
  onRemoveCompareType: (typeCode: string) => void;
  onClearCompareTypes: () => void;
  onGoToSitePlan?: (typeCode: string) => void;
  onSelectTypeForDetail?: (typeCode: string) => void;
}

export const UnitTypeComparison: React.FC<UnitTypeComparisonProps> = ({
  unitTypes,
  recommendedPresets,
  selectedCompareTypes,
  onToggleCompareType,
  onRemoveCompareType,
  onClearCompareTypes,
}) => {
  // Maximum selection warning banner
  const [maxWarning, setMaxWarning] = useState<string | null>(null);
  // Duplex floor switcher per type card: Record<typeCode, string>
  const [duplexFloorViews, setDuplexFloorViews] = useState<Record<string, string>>({});
  // Lightbox modal for enlarged floor plan image
  const [enlargedImage, setEnlargedImage] = useState<{
    src: string;
    alt: string;
    typeCode: string;
    floor?: string;
  } | null>(null);

  // Currently compared unit type documents
  const comparedDocs = selectedCompareTypes
    .map((code) => unitTypes.find((u) => u.typeCode === code))
    .filter((doc): doc is FirestoreUnitTypeDoc => doc !== undefined);

  // Handle clicking a type in selector
  const handleTypeClick = (typeCode: string) => {
    if (selectedCompareTypes.includes(typeCode)) {
      onRemoveCompareType(typeCode);
      setMaxWarning(null);
    } else {
      if (selectedCompareTypes.length >= 3) {
        setMaxWarning('최대 3개까지 비교할 수 있습니다.');
        setTimeout(() => setMaxWarning(null), 3000);
        return;
      }
      onToggleCompareType(typeCode);
      setMaxWarning(null);
    }
  };

  // Helper for duplex floor view
  const getDuplexView = (typeCode: string) => duplexFloorViews[typeCode] || '1F';
  const setDuplexView = (typeCode: string, floor: string) => {
    setDuplexFloorViews((prev) => ({ ...prev, [typeCode]: floor }));
  };

  return (
    <div id="unit-type-comparison-container" className="space-y-4 sm:space-y-5 w-full max-w-full">
      {/* 1. Comparison Header & Type Selector Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Scale className="w-4 h-4 text-blue-600" />
              <span>평면 타입 비교</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                선택: {selectedCompareTypes.length} / 3개
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              비교할 타입을 최대 3개까지 선택하여 원본 평면도를 나란히 비교할 수 있습니다.
            </p>
          </div>

          {selectedCompareTypes.length > 0 && (
            <button
              id="clear-compare-selection-btn"
              onClick={onClearCompareTypes}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors self-start sm:self-auto cursor-pointer"
            >
              선택 초기화
            </button>
          )}
        </div>

        {/* Max selection warning alert */}
        {maxWarning && (
          <div
            id="max-compare-warning-banner"
            className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{maxWarning}</span>
          </div>
        )}

        {/* Unit Type Selection Grid (4-columns on mobile, multi-columns on desktop) */}
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">비교할 타입 선택 (최대 3개):</span>
            <span className="text-slate-400 text-[11px]">총 {unitTypes.length}개 타입</span>
          </div>

          <div
            id="compare-type-grid"
            className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5 sm:gap-2 pt-1"
          >
            {unitTypes.map((u) => {
              const isSelected = selectedCompareTypes.includes(u.typeCode);

              return (
                <button
                  key={u.typeCode}
                  id={`compare-select-type-${u.typeCode}`}
                  onClick={() => handleTypeClick(u.typeCode)}
                  className={`min-h-[40px] px-1 py-2 rounded-xl text-center border transition-all cursor-pointer flex items-center justify-center gap-1 relative ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs font-black ring-2 ring-blue-300 ring-offset-1'
                      : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-slate-800 font-bold'
                  }`}
                  title={`${u.typeCode} 비교 ${isSelected ? '해제' : '선택'}`}
                >
                  <span className="text-xs sm:text-sm truncate">{u.typeCode}</span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Side-by-Side Comparison Cards Area (2-cols for 2 types, 3-cols for 3 types; 1-col stacked on mobile) */}
      {selectedCompareTypes.length > 0 ? (
        <div className="space-y-4">
          <div
            id="comparison-cards-grid"
            className={`grid gap-4 ${
              comparedDocs.length === 2
                ? 'grid-cols-1 md:grid-cols-2'
                : comparedDocs.length === 3
                ? 'grid-cols-1 md:grid-cols-3'
                : 'grid-cols-1 max-w-xl mx-auto'
            }`}
          >
            {comparedDocs.map((unit) => {
              const isDuplex = !!(unit.sourceAsset?.isDuplex || unit.sourceAsset?.isMultiLevel);
              const unitFloors = unit.sourceAsset?.floors || [
                {
                  floorId: '1F',
                  label: unit.sourceAsset?.floor1Label || '1F (하층)',
                  assetPath: unit.sourceAsset?.primaryAssetPath || unit.sourceAsset?.imageUrl || unit.sourceAsset?.assetPath || '',
                },
                ...(unit.sourceAsset?.secondaryAssetPath
                  ? [{
                      floorId: '2F',
                      label: unit.sourceAsset?.floor2Label || '2F (상층)',
                      assetPath: unit.sourceAsset?.secondaryAssetPath,
                    }]
                  : []),
                ...(unit.sourceAsset?.tertiaryAssetPath
                  ? [{
                      floorId: 'B1',
                      label: unit.sourceAsset?.floor3Label || 'B1 (지하1층)',
                      assetPath: unit.sourceAsset?.tertiaryAssetPath,
                    }]
                  : []),
              ];
              const currentFloor = getDuplexView(unit.typeCode);
              const activeFloorItem = unitFloors.find((f) => f.floorId === currentFloor) || unitFloors[0];
              const floorPlanSrc = isDuplex
                ? (activeFloorItem?.assetPath || null)
                : (unit.sourceAsset?.primaryAssetPath || unit.sourceAsset?.imageUrl || unit.sourceAsset?.assetPath || null);

              return (
                <div
                  key={unit.typeCode}
                  id={`compare-card-${unit.typeCode}`}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs flex flex-col"
                >
                  {/* Card Header: 타입명, 전용면적, X remove button */}
                  <div className="p-3 sm:p-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <h4 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                        {unit.typeCode}
                      </h4>
                      <span className="text-xs sm:text-sm font-semibold text-slate-600">
                        전용 {unit.netAreaM2 ? `${unit.netAreaM2}㎡` : `${unit.areaGroup}㎡군`}
                      </span>
                    </div>
                    <button
                      onClick={() => onRemoveCompareType(unit.typeCode)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                      title={`${unit.typeCode} 비교에서 제거`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Floor Plan Image Section with Duplex toggle & Lightbox */}
                  <div className="p-3 sm:p-4 space-y-2 flex-1 flex flex-col">
                    {/* Duplex Switcher */}
                    {isDuplex && unitFloors.length > 1 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">복층/다층 구분:</span>
                        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                          {unitFloors.map((fl) => (
                            <button
                              key={fl.floorId}
                              id={`card-floor-${fl.floorId.toLowerCase()}-${unit.typeCode}`}
                              onClick={() => setDuplexView(unit.typeCode, fl.floorId)}
                              className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                                currentFloor === fl.floorId
                                  ? 'bg-blue-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {fl.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tappable Floor Plan Image to Lightbox */}
                    <div
                      onClick={() => {
                        if (!floorPlanSrc) return;
                        setEnlargedImage({
                          src: floorPlanSrc,
                          alt: `${unit.typeCode} 평면도`,
                          typeCode: unit.typeCode,
                          floor: isDuplex ? currentFloor : undefined,
                        });
                      }}
                      className="group relative flex-1 min-h-[240px] sm:min-h-[320px] bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center p-2.5 cursor-pointer overflow-hidden hover:bg-slate-100/80 transition-colors"
                      title="탭하여 평면도 크게 보기"
                    >
                      {floorPlanSrc ? (
                        <img
                          id={`compare-plan-img-${unit.typeCode}`}
                          src={floorPlanSrc}
                          alt={`${unit.typeCode} 원본 평면도`}
                          referrerPolicy="no-referrer"
                          className="w-full h-auto max-h-[320px] object-contain block mx-auto select-none pointer-events-none"
                        />
                      ) : (
                        <div className="w-full h-[200px] flex items-center justify-center text-slate-400 text-xs">
                          도면 이미지가 없습니다
                        </div>
                      )}
                      <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 bg-slate-900/80 text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow-sm">
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>확대보기</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty state when no types selected */
        <div
          id="compare-empty-state"
          className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs space-y-3"
        >
          <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <Scale className="w-6 h-6" />
          </div>
          <h4 className="text-base sm:text-lg font-bold text-slate-800">
            비교할 평면 타입을 선택해주세요
          </h4>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            상단 그리드에서 비교하고 싶은 타입을 선택하면 (최대 3개),
            평면도를 한 화면에서 나란히 확인하고 확대하여 볼 수 있습니다.
          </p>

          {recommendedPresets && recommendedPresets.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              {recommendedPresets.map((preset, idx) => {
                const colors = [
                  'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200',
                  'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200',
                  'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200',
                  'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200',
                ];
                const colorClass = colors[idx % colors.length];
                return (
                  <button
                    key={preset.id || preset.label}
                    onClick={() => {
                      onClearCompareTypes();
                      preset.typeCodes.forEach((code) => onToggleCompareType(code));
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${colorClass}`}
                    title={preset.description}
                  >
                    {preset.label} 추천 비교
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lightbox Modal for Enlarged Floor Plan Image */}
      {enlargedImage && (
        <div
          id="floor-plan-lightbox-modal"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in"
          onClick={() => setEnlargedImage(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base text-slate-900">
                  {enlargedImage.typeCode} 원본 평면도
                </span>
                {enlargedImage.floor && (
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold">
                    {enlargedImage.floor} 도면
                  </span>
                )}
                <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold">
                  조합자료 기준
                </span>
              </div>
              <button
                id="close-lightbox-btn"
                onClick={() => setEnlargedImage(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 sm:p-4 overflow-auto flex items-center justify-center bg-slate-950/5 min-h-[300px]">
              {enlargedImage.src ? (
                <img
                  src={enlargedImage.src}
                  alt={enlargedImage.alt}
                  referrerPolicy="no-referrer"
                  className="max-w-full h-auto max-h-[75vh] object-contain block mx-auto rounded-lg shadow-sm"
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
