import React, { useState, useRef, useEffect } from 'react';
import { usePlanTouchGestures } from '../utils/planTouchGestures.ts';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Building2,
  ExternalLink,
  X,
  AlertCircle,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { FirestoreBuildingDoc, FirestoreUnitTypeDoc } from '../schema/firestoreSchema.ts';
import { PlanConfirmationStatus, SitePlanCoordinate } from '../types/planConfig.ts';

export interface InteractiveSitePlanProps {
  sitePlanAsset?: string | null;
  coordinates?: SitePlanCoordinate[];
  buildings: FirestoreBuildingDoc[];
  unitTypes?: FirestoreUnitTypeDoc[];

  selectedBuilding?: string | null;
  highlightedBuildings?: string[];
  candidateBuildings?: string[];

  onSelectBuilding?: (buildingNumber: string) => void;
  onSelectUnitType?: (typeCode: string) => void;
  /** Backwards compatibility alias for onSelectUnitType */
  onSelectType?: (typeCode: string) => void;

  confirmationStatus?: PlanConfirmationStatus;

  // UI state & zoom controls
  highlightNotice?: string | null;
  onClearHighlight?: () => void;
  zoomLevel?: number;
  onZoomChange?: (zoom: number) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
}

export const InteractiveSitePlan: React.FC<InteractiveSitePlanProps> = ({
  sitePlanAsset,
  coordinates = [],
  buildings,
  unitTypes = [],
  selectedBuilding,
  highlightedBuildings = [],
  candidateBuildings = [],
  onSelectBuilding,
  onSelectUnitType,
  onSelectType,
  confirmationStatus = 'proposal',
  highlightNotice = null,
  onClearHighlight,
  zoomLevel = 1,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}) => {
  const [hoveredBuilding, setHoveredBuilding] = useState<string | null>(null);

  // Unify type selection callback
  const handleTypeClick = (typeCode: string) => {
    if (onSelectUnitType) {
      onSelectUnitType(typeCode);
    } else if (onSelectType) {
      onSelectType(typeCode);
    }
  };

  const hasTypeSelectionCallback = Boolean(onSelectUnitType || onSelectType);

  // Runtime geometry measurement refs and layout dimensions
  const viewportRef = useRef<HTMLDivElement>(null);
  usePlanTouchGestures(viewportRef, zoomLevel, onZoomChange, sitePlanAsset || "");
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [viewportDimensions, setViewportDimensions] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  const [geometryInfo, setGeometryInfo] = useState<{
    stageWidth: number;
    stageHeight: number;
    overlayWidth: number;
    overlayHeight: number;
    isAligned: boolean;
  } | null>(null);

  // Measure viewport container inner dimensions (stable outer border box minus borders)
  // This ensures scrollbars appearing/disappearing never cause fitWidth/fitHeight oscillation
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const measure = () => {
      // getBoundingClientRect gives border-box width/height which is INVARIANT to internal scrollbars
      const rect = vp.getBoundingClientRect();
      const w = Math.round(rect.width) - 2; // subtract 2px borders (1px left + 1px right)
      const h = Math.round(rect.height) - 2; // subtract 2px borders (1px top + 1px bottom)

      if (w > 0 && h > 0) {
        setViewportDimensions((prev) => {
          // Only update if dimensions changed by at least 3px to eliminate scrollbar toggle oscillations
          if (Math.abs(prev.width - w) < 3 && Math.abs(prev.height - h) < 3) {
            return prev;
          }
          return { width: w, height: h };
        });
      }
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    if (vp.parentElement) {
      ro.observe(vp.parentElement);
    }

    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Dynamic Stage Dimensions based on actual image aspect ratio (default 2048 / 1422 = ~1.440225)
  // FIT = entire image fits inside current viewer without distortion
  const [naturalDimensions, setNaturalDimensions] = useState<{
    width: number;
    height: number;
  }>({ width: 2048, height: 1422 });

  useEffect(() => {
    if (imgRef.current && imgRef.current.naturalWidth > 0 && imgRef.current.naturalHeight > 0) {
      setNaturalDimensions({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight,
      });
    }
  }, [sitePlanAsset]);

  const naturalW = naturalDimensions.width || 2048;
  const naturalH = naturalDimensions.height || 1422;
  const SITE_PLAN_ASPECT = naturalW / naturalH;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const padX = isMobile ? 12 : 24;
  const padY = isMobile ? 12 : 24;

  const availW = Math.max(100, (viewportDimensions.width || 360) - padX);
  const availH = Math.max(100, (viewportDimensions.height || 480) - padY);

  let fitWidth: number;
  let fitHeight: number;

  if (isMobile) {
    // Mobile: width-first fit, with height constraint for landscape or short screens
    fitWidth = availW;
    fitHeight = Math.round(availW / SITE_PLAN_ASPECT);
    if (availH > 150 && fitHeight > availH) {
      fitHeight = availH;
      fitWidth = Math.round(availH * SITE_PLAN_ASPECT);
    }
  } else {
    // PC / Desktop: Fit within BOTH available width and available height so entire image is 100% visible
    const scaleW = availW / naturalW;
    const scaleH = availH / naturalH;
    const fitScale = Math.min(scaleW, scaleH);
    fitWidth = Math.round(naturalW * fitScale);
    fitHeight = Math.round(naturalH * fitScale);
  }

  // Active Stage Dimensions: strictly scaled from Fit stage by zoomLevel
  const stageWidth = Math.round(fitWidth * zoomLevel);
  const stageHeight = Math.round(fitHeight * zoomLevel);

  // Debug Instrumentation (UX5): Expose update counters on window for automated verification
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        __SITE_PLAN_DEBUG__?: {
          zoomUpdates: number;
          fitWidthUpdates: number;
          stageWidthUpdates: number;
          history: Array<{
            timestamp: number;
            zoomLevel: number;
            fitWidth: number;
            fitHeight: number;
            stageWidth: number;
            stageHeight: number;
          }>;
          reset: () => void;
        };
      };
      if (!win.__SITE_PLAN_DEBUG__) {
        win.__SITE_PLAN_DEBUG__ = {
          zoomUpdates: 0,
          fitWidthUpdates: 0,
          stageWidthUpdates: 0,
          history: [],
          reset: () => {
            if (win.__SITE_PLAN_DEBUG__) {
              win.__SITE_PLAN_DEBUG__.zoomUpdates = 0;
              win.__SITE_PLAN_DEBUG__.fitWidthUpdates = 0;
              win.__SITE_PLAN_DEBUG__.stageWidthUpdates = 0;
              win.__SITE_PLAN_DEBUG__.history = [];
            }
          },
        };
      }
      win.__SITE_PLAN_DEBUG__.zoomUpdates++;
      win.__SITE_PLAN_DEBUG__.history.push({
        timestamp: Date.now(),
        zoomLevel,
        fitWidth,
        fitHeight,
        stageWidth,
        stageHeight,
      });
    }
  }, [zoomLevel]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        __SITE_PLAN_DEBUG__?: { fitWidthUpdates: number };
      };
      if (win.__SITE_PLAN_DEBUG__) {
        win.__SITE_PLAN_DEBUG__.fitWidthUpdates++;
      }
    }
  }, [fitWidth]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        __SITE_PLAN_DEBUG__?: { stageWidthUpdates: number };
      };
      if (win.__SITE_PLAN_DEBUG__) {
        win.__SITE_PLAN_DEBUG__.stageWidthUpdates++;
      }
    }
  }, [stageWidth]);

  // Geometry check for exact overlay alignment
  const checkGeometry = () => {
    if (!stageRef.current || !overlayRef.current) return;
    const stageRect = stageRef.current.getBoundingClientRect();
    const overlayRect = overlayRef.current.getBoundingClientRect();

    const deltaWidth = Math.abs(stageRect.width - overlayRect.width);
    const deltaHeight = Math.abs(stageRect.height - overlayRect.height);
    const isAligned = deltaWidth <= 1 && deltaHeight <= 1;

    setGeometryInfo({
      stageWidth: Math.round(stageRect.width),
      stageHeight: Math.round(stageRect.height),
      overlayWidth: Math.round(overlayRect.width),
      overlayHeight: Math.round(overlayRect.height),
      isAligned,
    });
  };

  useEffect(() => {
    checkGeometry();
  }, [stageWidth, stageHeight]);

  // Initial scroll position reset on mount only
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0;
      viewportRef.current.scrollTop = 0;
    }
  }, []);

  // Explicit reset handler only for 화면맞춤 button
  const handleResetZoomClick = () => {
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0;
      viewportRef.current.scrollTop = 0;
    }
    if (onResetZoom) {
      onResetZoom();
    }
  };

  // Find currently selected building metadata (fallback to first building if available)
  const currentBuilding =
    buildings.find((b) => b.buildingNumber === selectedBuilding) ||
    buildings[0] ||
    null;

  // Dong quick selector list ref & view alignment
  const dongListRef = useRef<HTMLDivElement>(null);

  const alignViewportToBuilding = (bldgNum: string) => {
    const coord = coordinates.find((c) => c.buildingNumber === bldgNum);
    const vp = viewportRef.current;
    if (vp && coord) {
      if (vp.scrollWidth > vp.clientWidth || vp.scrollHeight > vp.clientHeight) {
        const px = coord.normalizedX * stageWidth;
        const py = coord.normalizedY * stageHeight;
        const posX = px - vp.clientWidth / 2;
        const posY = py - vp.clientHeight / 2;
        vp.scrollLeft = Math.max(0, posX);
        vp.scrollTop = Math.max(0, posY);
      }
    }
  };

  const handleBuildingSelect = (bldgNum: string) => {
    if (onSelectBuilding) {
      onSelectBuilding(bldgNum);
    }
    alignViewportToBuilding(bldgNum);
  };

  // Keep selected dong button visible in the horizontal scroll list
  useEffect(() => {
    if (selectedBuilding) {
      const btn = document.getElementById(`site-dong-btn-${selectedBuilding}`);
      if (btn && dongListRef.current) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedBuilding]);

  // Building count summaries
  const totalBuildingsCount = buildings.length;
  const terraceBuildingsCount = buildings.filter((b) => b.isTerraceHouse).length;
  const generalBuildingsCount = totalBuildingsCount - terraceBuildingsCount;

  return (
    <div id="interactive-site-plan-wrapper" className="space-y-3 sm:space-y-4">
      {/* Top Controls & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm sm:text-base font-bold text-slate-900">
            {totalBuildingsCount > 0 ? `주동 배치도 (${totalBuildingsCount}개 주동)` : '단지 배치도'}
          </h3>
        </div>

        {/* Zoom Controls: [-] [화면맞춤] [+] */}
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5 shrink-0 self-end sm:self-auto">
          <button
            id="site-zoom-out-btn"
            onClick={onZoomOut}
            disabled={!onZoomOut || zoomLevel <= 1}
            className="min-h-[34px] min-w-[34px] p-1.5 rounded hover:bg-white text-slate-700 flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors"
            title="배치도 축소"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            id="site-zoom-reset-btn"
            onClick={handleResetZoomClick}
            disabled={!onResetZoom}
            className="min-h-[34px] px-2.5 rounded hover:bg-white text-slate-700 flex items-center gap-1 cursor-pointer text-xs font-bold transition-colors disabled:opacity-40"
            title="배치도 화면맞춤 (1.0x)"
          >
            <RotateCcw className="w-3 h-3 text-slate-400" />
            <span>{zoomLevel === 1 ? '화면맞춤' : `${Math.round(zoomLevel * 100)}%`}</span>
          </button>
          <button
            id="site-zoom-in-btn"
            onClick={onZoomIn}
            disabled={!onZoomIn || zoomLevel >= 2.5}
            className="min-h-[34px] min-w-[34px] p-1.5 rounded hover:bg-white text-slate-700 flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors"
            title="배치도 확대"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Multi-dong Highlight Notice Banner (e.g. from Unit Plan '배치도에서 보기') */}
      {highlightNotice && (
        <div
          id="site-plan-highlight-banner"
          className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs sm:text-sm animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-semibold">{highlightNotice}</span>
          </div>
          {onClearHighlight && (
            <button
              id="clear-highlight-btn"
              onClick={onClearHighlight}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>강조 해제</span>
            </button>
          )}
        </div>
      )}

      {/* Site Plan Viewport Container with Synchronized Zoom & Pan */}
      <div
        id="interactive-site-plan-viewport"
        ref={viewportRef}
        data-zoom={zoomLevel}
        data-fit-width={fitWidth}
        data-fit-height={fitHeight}
        data-stage-width={stageWidth}
        data-stage-height={stageHeight}
        data-geometry-status={geometryInfo?.isAligned ? 'aligned' : 'checking'}
        data-overlay-width={geometryInfo?.overlayWidth}
        data-overlay-height={geometryInfo?.overlayHeight}
        className="relative border border-slate-200 rounded-xl overflow-auto bg-slate-950 h-[50vh] sm:h-[65vh] lg:h-[70vh] min-h-[320px] max-h-[750px] w-full max-w-full select-none"
        style={{
          overscrollBehavior: 'contain',
          touchAction: onZoomChange ? 'none' : 'pan-x pan-y',
        }}
      >
        {/* Scroll Content: At zoom=1 centered, at zoom>1 left-top aligned */}
        <div
          id="site-plan-scroll-content"
          className={`min-w-full min-h-full flex ${
            zoomLevel === 1 ? 'justify-center items-center' : 'justify-start items-start'
          }`}
          style={{
            minWidth: '100%',
            minHeight: '100%',
            width: zoomLevel === 1 ? '100%' : 'max-content',
            height: zoomLevel === 1 ? '100%' : 'max-content',
            margin: 0,
          }}
        >
          {/* Exact Aspect-Ratio (2048 / 1422) ImageStage with REAL DOM Layout Width/Height */}
          <div
            id="site-plan-image-stage"
            ref={stageRef}
            className="relative shrink-0 select-none leading-none"
            style={{
              position: 'relative',
              width: `${stageWidth}px`,
              height: `${stageHeight}px`,
              maxWidth: 'none',
              maxHeight: 'none',
              flex: 'none',
              margin: 0,
              transition: 'none',
              animation: 'none',
            }}
          >
            {/* Base Site Plan Image: Stretches 100% to imageStage with exact aspect ratio */}
            <img
              id="interactive-site-plan-img"
              ref={imgRef}
              src={sitePlanAsset || null}
              alt="단지 배치도"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full block select-none pointer-events-none"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                display: 'block',
                maxWidth: 'none',
                maxHeight: 'none',
                userSelect: 'none',
                WebkitUserDrag: 'none' as any,
                transition: 'none',
                animation: 'none',
                filter: 'none',
              }}
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  setNaturalDimensions({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                  });
                }
                checkGeometry();
              }}
            />

            {/* Absolute Markers Overlay Layer (Exact 1:1 Scale With ImageStage) */}
            {coordinates.length > 0 && (
              <div
                id="interactive-markers-overlay"
                ref={overlayRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  maxWidth: 'none',
                  maxHeight: 'none',
                  transition: 'none',
                  animation: 'none',
                }}
              >
                {coordinates.map((coord) => {
                  const isSelected = selectedBuilding === coord.buildingNumber;
                  const isHighlighted = highlightedBuildings.includes(coord.buildingNumber);
                  const isCandidate = candidateBuildings.includes(coord.buildingNumber);
                  const isHovered = hoveredBuilding === coord.buildingNumber;

                  // Determine z-index and styles based on state
                  let zIndex = 10;
                  let badgeClass =
                    'bg-slate-900/85 hover:bg-slate-900 text-white border-white/70 shadow-xs';

                  if (coord.isTerraceHouse) {
                    badgeClass =
                      'bg-slate-900/90 text-emerald-300 border-emerald-400 shadow-xs';
                  }

                  if (isCandidate) {
                    zIndex = 25;
                    badgeClass =
                      'bg-amber-500 text-slate-950 border-amber-200 border-dashed animate-pulse font-extrabold shadow-md';
                  } else if (isHighlighted && !isSelected) {
                    zIndex = 20;
                    badgeClass =
                      'bg-blue-600 text-white border-white ring-2 ring-blue-300 ring-offset-1 ring-offset-slate-950 animate-pulse font-extrabold shadow-md';
                  }

                  if (isSelected) {
                    zIndex = 30;
                    badgeClass =
                      'bg-blue-600 text-white border-white ring-2 sm:ring-4 ring-blue-300/90 ring-offset-2 ring-offset-slate-950 font-black shadow-2xl';
                  }

                  return (
                    <div
                      key={coord.buildingNumber}
                      id={`marker-anchor-${coord.buildingNumber}`}
                      style={{
                        position: 'absolute',
                        left: `${coord.normalizedX * 100}%`,
                        top: `${coord.normalizedY * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        zIndex,
                      }}
                      className="pointer-events-auto"
                    >
                      {/* Touch-friendly hitbox */}
                      <button
                        id={`marker-btn-${coord.buildingNumber}`}
                        onClick={() => handleBuildingSelect(coord.buildingNumber)}
                        onMouseEnter={() => setHoveredBuilding(coord.buildingNumber)}
                        onMouseLeave={() => setHoveredBuilding(null)}
                        className="group relative -m-2 p-2 flex items-center justify-center cursor-pointer outline-hidden focus:outline-hidden min-w-[30px] min-h-[30px] md:min-w-[44px] md:min-h-[44px]"
                        title={`${coord.buildingNumber} 선택`}
                        aria-label={`${coord.buildingNumber} 선택`}
                      >
                        {/* Compact Visual Pill Badge (mobile <=768px: 18px ~25% reduction, desktop: 26px, selected: 32~34px) */}
                        <span
                          className={`inline-flex items-center justify-center rounded-full font-bold border transition-all duration-150 ${
                            isSelected
                              ? 'min-w-[32px] md:min-w-[34px] h-[32px] md:h-[34px] px-1 md:px-1.5 font-black shadow-xl'
                              : 'min-w-[18px] md:min-w-[26px] h-[18px] md:h-[26px] px-0.5 md:px-1 font-extrabold'
                          } ${badgeClass} ${
                            isHovered && !isSelected ? 'ring-2 ring-white/90 shadow-md' : ''
                          }`}
                        >
                          <span
                            className={
                              isSelected
                                ? (coord.label || coord.buildingNumber.replace('동', '')).length >= 4
                                  ? 'text-[8.5px] md:text-[10px] tracking-tight leading-none'
                                  : 'text-[10px] md:text-xs leading-none'
                                : (coord.label || coord.buildingNumber.replace('동', '')).length >= 4
                                ? 'text-[5.5px] md:text-[8px] tracking-tighter leading-none'
                                : 'text-[7.5px] md:text-[9.5px] tracking-tight leading-none'
                            }
                          >
                            {coord.label || coord.buildingNumber.replace('동', '')}
                          </span>
                        </span>

                        {/* Tooltip on Hover or Candidate notice */}
                        {(isHovered || (isCandidate && !isSelected)) && (
                          <div
                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-slate-900 text-white text-[10px] sm:text-xs font-semibold rounded-md shadow-lg border border-slate-700 whitespace-nowrap z-40 pointer-events-none animate-in fade-in"
                          >
                            <div className="flex items-center gap-1">
                              <span>{coord.buildingNumber}</span>
                              {coord.isTerraceHouse && (
                                <span className="text-emerald-400 font-normal">(테라스동)</span>
                              )}
                              {isCandidate && (
                                <span className="text-amber-300 font-bold">(후보 · 미확정)</span>
                              )}
                            </div>
                            {/* Triangle indicator */}
                            <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900 mx-auto mt-0.5"></div>
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dong Quick Selection Button Bar (Mobile & PC Unified) */}
      {buildings.length > 0 && (
        <div
          id="site-plan-dong-selector-bar"
          className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 space-y-2"
        >
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>동 선택 ({buildings.length}개 주동)</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              {selectedBuilding ? (
                <span className="text-blue-600 font-bold">{selectedBuilding} 선택됨</span>
              ) : (
                '동을 선택하세요'
              )}
            </span>
          </div>

          {/* Dong Buttons List: horizontal scroll on mobile, flex-wrap on tablet/desktop */}
          <div
            id="site-plan-dong-buttons-list"
            ref={dongListRef}
            className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent sm:flex-wrap"
            style={{
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {buildings.map((b) => {
              const isSelected = selectedBuilding === b.buildingNumber;
              const isHighlighted = highlightedBuildings.includes(b.buildingNumber);

              return (
                <button
                  key={b.buildingNumber}
                  id={`site-dong-btn-${b.buildingNumber}`}
                  onClick={() => handleBuildingSelect(b.buildingNumber)}
                  className={`shrink-0 min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-300 ring-offset-1'
                      : isHighlighted
                      ? 'bg-blue-50 text-blue-700 border-blue-300 font-extrabold'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300 hover:text-blue-600'
                  }`}
                  title={`${b.displayName || b.buildingNumber} 선택`}
                  aria-pressed={isSelected}
                >
                  <span>{b.displayName || b.buildingNumber}</span>
                  {b.isTerraceHouse && (
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                        isSelected
                          ? 'bg-blue-700 text-emerald-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      테라스
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Dong Type Info Card (Concise) */}
      {currentBuilding && (
        <div
          id="selected-dong-info-card"
          className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5 space-y-2"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
            <h4 className="text-sm font-bold text-slate-900">
              {currentBuilding.displayName}
            </h4>
            {currentBuilding.isTerraceHouse && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                테라스
              </span>
            )}
          </div>

          {currentBuilding.unitTypesShown.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 sm:gap-2" id="selected-dong-type-buttons">
              {currentBuilding.unitTypesShown.map((typeCode) => (
                <button
                  key={typeCode}
                  id={`dong-type-chip-${typeCode}`}
                  onClick={() => handleTypeClick(typeCode)}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-blue-50 text-slate-800 hover:text-blue-700 font-bold text-xs border border-slate-200 hover:border-blue-300 transition-all cursor-pointer shadow-2xs flex items-center gap-1 group"
                  title={`${typeCode} 평면도 보기`}
                >
                  <span>{typeCode}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-2 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="font-semibold">배치 확인 중</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom summary text */}
      <div className="text-center text-xs text-slate-500 pt-1">
        {totalBuildingsCount > 0 ? `총 ${totalBuildingsCount}개 주동 ${terraceBuildingsCount > 0 ? `(일반동 ${generalBuildingsCount}개 + 테라스동 ${terraceBuildingsCount}개)` : ''} · 조합자료 기준 (변경 가능 / 최종 확정안 아님)` : '동별 배정 정보 미확인 · 원본 배치도'}
      </div>
    </div>
  );
};
