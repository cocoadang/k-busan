import { ProjectSelector } from './ProjectSelector.tsx';
import { getProjectPlanConfig } from '../data/projects/planRegistry.ts';
import React, { useState, useMemo } from 'react';
import {
  Users,
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Info,
  Building,
  Table,
  Layers,
  Sparkles,
  Calendar,
  AlertCircle,
  TrendingUp,
  FileCheck,
} from 'lucide-react';
import {
  UserSubscriptionProfile,
  AnnouncementRule,
  BenchmarkProjectRecord,
} from '../types/subscription.ts';
import {
  ANNOUNCEMENT_RULES,
  BENCHMARK_PROJECTS,
  SUBSCRIPTION_PRESETS,
  generateFuturePlanComparisonRows,
} from '../data/subscriptionBenchmarkData.ts';
import {
  calculateGeneralSupplyScore,
  evaluateSubscriptionEligibility,
  calculateResidencePeriod,
} from '../utils/subscriptionCalculator.ts';
import { MultiProfileComparisonView } from './MultiProfileComparisonView.tsx';

export const SubscriptionStrategyView: React.FC = () => {
  // Strategy sub-navigation view mode (Phase 5B multi-profile comparison is default)
  const [activeStrategyMode, setActiveStrategyMode] = useState<
    'multi' | 'single' | 'types' | 'db' | 'all'
  >('multi');

  // 1. Target Announcement Rule selector for residence & rule evaluation
  const [selectedRuleId, setSelectedRuleId] = useState<string>('rule-summit-namcheon-2025');
  const activeRule: AnnouncementRule =
    ANNOUNCEMENT_RULES[selectedRuleId] || ANNOUNCEMENT_RULES['rule-summit-namcheon-2025'];

  // 2. User Profile State (initialized to newlywed preset)
  const [profile, setProfile] = useState<UserSubscriptionProfile>(
    SUBSCRIPTION_PRESETS[0].profile
  );

  // Active preset tracking
  const [activePresetId, setActivePresetId] = useState<string>('preset-newlywed');

  // 3. Benchmark project tab for Recent DB section
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState<string>('summit-namcheon');
  const activeBenchmark: BenchmarkProjectRecord =
    BENCHMARK_PROJECTS.find((p) => p.id === selectedBenchmarkId) || BENCHMARK_PROJECTS[0];

  // 4. Future Project Plan Comparison selector
  const [selectedFutureProject, setSelectedFutureProject] = useState<string>('chokjin-3');

  const isGwacheonPlan = selectedFutureProject.startsWith('gwacheon-');
  const futurePlanConfig = getProjectPlanConfig(selectedFutureProject);

  // Residence analysis
  const residenceInfo = useMemo(() => {
    return calculateResidencePeriod(profile.busanTransferDate, activeRule.announcementDate);
  }, [profile.busanTransferDate, activeRule.announcementDate]);

  // Comprehensive eligibility analysis
  const analysis = useMemo(() => {
    return evaluateSubscriptionEligibility(profile, activeRule);
  }, [profile, activeRule]);

  // General score breakdown
  const scoreBreakdown = useMemo(() => {
    return calculateGeneralSupplyScore(profile);
  }, [profile]);

  // Future plan comparison rows
  const comparisonRows = useMemo(() => {
    if (selectedFutureProject.startsWith('gwacheon-')) return [];
    const draftRule =
      selectedFutureProject === 'chokjin-3'
        ? ANNOUNCEMENT_RULES['rule-chokjin-3-draft']
        : selectedFutureProject === 'udong-3'
        ? ANNOUNCEMENT_RULES['rule-udong-3-draft']
        : ANNOUNCEMENT_RULES['rule-samik-beach-draft'];
    return generateFuturePlanComparisonRows(selectedFutureProject, profile, draftRule);
  }, [selectedFutureProject, profile]);

  // Preset selector handler
  const handleApplyPreset = (presetId: string) => {
    const found = SUBSCRIPTION_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setProfile({ ...found.profile });
      setActivePresetId(presetId);
    }
  };

  // Profile update helpers
  const updateProfile = (field: keyof UserSubscriptionProfile, value: any) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setActivePresetId(''); // custom modified
  };

  return (
    <div id="subscription-strategy-container" className="space-y-6 pb-12">
      {/* 0. Strategy Feature Mode Sub-navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        <button
          id="strategy-subtab-multi"
          onClick={() => setActiveStrategyMode('multi')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
            activeStrategyMode === 'multi'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>다중 프로필 병렬 비교 (Phase 5B)</span>
        </button>

        <button
          id="strategy-subtab-single"
          onClick={() => setActiveStrategyMode('single')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
            activeStrategyMode === 'single'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>단일 조건 정밀 진단</span>
        </button>

        <button
          id="strategy-subtab-types"
          onClick={() => setActiveStrategyMode('types')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
            activeStrategyMode === 'types'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Table className="w-4 h-4" />
          <span>사업지 평면별 공급 비교</span>
        </button>

        <button
          id="strategy-subtab-db"
          onClick={() => setActiveStrategyMode('db')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
            activeStrategyMode === 'db'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>최근 부산 실적 DB</span>
        </button>

        <button
          id="strategy-subtab-all"
          onClick={() => setActiveStrategyMode('all')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer shrink-0 ${
            activeStrategyMode === 'all'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          <span>전체 통합 뷰</span>
        </button>
      </div>

      {/* Mode 1: Phase 5B Multi-Profile Comparison */}
      {(activeStrategyMode === 'multi' || activeStrategyMode === 'all') && (
        <MultiProfileComparisonView />
      )}

      {/* Mode 2: Phase 5A Single-Profile Detailed Diagnosis */}
      {(activeStrategyMode === 'single' || activeStrategyMode === 'all') && (
        <div className="space-y-8">
      {/* 1. Header Banner & Strict Objective Principle */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Phase 5A 청약전략 분석 모듈</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              사용자 조건별 청약경로 · 공급방식 · 실적 병렬 비교
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
              본 서비스는 <strong>특정 청약을 추천하거나 당첨 확률을 예측하지 않으며</strong>, 입력된 사용자 조건을 바탕으로 신청 가능한 청약 경로(특별공급 및 일반공급 가점/추첨)와 최근 부산 주요 단지의 실제 접수 실적을 객관적으로 대조합니다.
            </p>
          </div>

          {/* Announcement Rule selector for reference baseline */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 min-w-[260px] shrink-0">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              판정 기준 모집공고 (Rule Version)
            </label>
            <select
              id="announcement-rule-select"
              value={selectedRuleId}
              onChange={(e) => setSelectedRuleId(e.target.value)}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="rule-summit-namcheon-2025">
                써밋 리미티드 남천 (2025-07-31 공고 기준)
              </option>
              <option value="rule-luel-centum-2025">
                르엘 리버파크 센텀 (2025-07-11 공고 기준)
              </option>
              <option value="rule-venueve-haeundae-2025">
                베뉴브 해운대 (2025-09-19 공고 기준)
              </option>
              <option value="rule-chokjin-3-draft">
                촉진3구역 (2026-06-30 예상 공고안)
              </option>
              <option value="rule-udong-3-draft">
                우동3구역 (2026-09-30 예상 공고안)
              </option>
              <option value="rule-samik-beach-draft">
                삼익비치 (2027-03-31 예상 공고안)
              </option>
            </select>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 font-mono">
              <span>공고일: {activeRule.announcementDate}</span>
              <span>해당지역 요건: 부산 {activeRule.busanResidenceRequirementMonths}개월</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed User Profile Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-slate-700" />
            <span>1. 사용자 조건 설정</span>
          </h2>
          <span className="text-xs text-slate-500">
            각 항목 수정 시 하단 자격 판정 및 가점이 자동 갱신됩니다.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1) 거주지역 및 부산 전입일 */}
          <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <label className="block text-xs font-bold text-slate-800">
              거주지역 및 부산 전입일
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                id="input-residence-region"
                value={profile.residenceRegion}
                onChange={(e) => updateProfile('residenceRegion', e.target.value)}
                className="w-full min-w-0 text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="busan">부산광역시</option>
                <option value="ulsan_gyeongnam">울산 / 경상남도</option>
                <option value="other">기타 타지역</option>
              </select>

              <input
                id="input-busan-transfer-date"
                type="date"
                value={profile.busanTransferDate}
                onChange={(e) => updateProfile('busanTransferDate', e.target.value)}
                className="w-full min-w-0 text-xs border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {/* Automatic residence calculation badge */}
            <div className="mt-2 text-xs p-2 bg-white rounded border border-slate-200">
              <div className="flex items-center justify-between font-medium">
                <span className="text-slate-600">공고일 기준 거주기간:</span>
                <span className="font-bold text-blue-700">{residenceInfo.residenceText}</span>
              </div>
              <div className="mt-1 text-[11px]">
                {analysis.residenceAnalysis.meetsLocalRequirement ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                    해당지역(부산 {activeRule.busanResidenceRequirementMonths}개월) 1순위 충족
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 inline" />
                    부산 거주기간 미달 (기타지역 접수)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2) 세대주 및 무주택 기간 */}
          <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <label className="block text-xs font-bold text-slate-800">
              세대주 여부 및 주택 소유 현황
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-700 bg-white p-2 rounded border border-slate-300 min-w-0 cursor-pointer">
                <input
                  id="input-is-householder"
                  type="checkbox"
                  checked={profile.isHouseholder}
                  onChange={(e) => updateProfile('isHouseholder', e.target.checked)}
                  className="rounded text-blue-600 shrink-0"
                />
                <span className="font-semibold truncate">세대주</span>
              </label>

              <select
                id="input-is-homeless"
                value={profile.isHomeless ? 'homeless' : 'homeowner'}
                onChange={(e) => {
                  const isH = e.target.value === 'homeless';
                  updateProfile('isHomeless', isH);
                  if (isH) {
                    updateProfile('ownedHouseCount', 0);
                  } else {
                    updateProfile('ownedHouseCount', 1);
                  }
                }}
                className="w-full min-w-0 text-xs border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 font-semibold truncate focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="homeless">무주택자</option>
                <option value="homeowner">유주택자 (1주택 이상)</option>
              </select>
            </div>

            {profile.isHomeless ? (
              <div className="flex items-center justify-between gap-1.5 text-xs bg-white p-2 rounded border border-slate-200 min-w-0">
                <span className="text-slate-600 shrink-0 whitespace-nowrap">무주택 기간:</span>
                <select
                  id="input-homeless-years"
                  value={profile.homelessYears}
                  onChange={(e) => updateProfile('homelessYears', Number(e.target.value))}
                  className="min-w-0 flex-1 text-xs border border-slate-300 rounded px-2 py-1 bg-white font-bold truncate focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={0}>1년 미만 (2점)</option>
                  {Array.from({ length: 14 }, (_, i) => i + 1).map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}년 이상 ~ {yr + 1}년 미만 ({(yr + 1) * 2}점)
                    </option>
                  ))}
                  <option value={15}>15년 이상 (32점 만점)</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-1.5 text-xs bg-white p-2 rounded border border-slate-200 min-w-0">
                <span className="text-slate-600 shrink-0 whitespace-nowrap">보유 주택수:</span>
                <select
                  id="input-owned-house-count"
                  value={profile.ownedHouseCount}
                  onChange={(e) => updateProfile('ownedHouseCount', Number(e.target.value))}
                  className="min-w-0 flex-1 text-xs border border-slate-300 rounded px-2 py-1 bg-white font-bold truncate focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={1}>1주택 (처분조건 추첨 가능)</option>
                  <option value={2}>2주택 이상 (1순위 제한)</option>
                </select>
              </div>
            )}
          </div>

          {/* 3) 혼인 여부 및 기간 */}
          <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <label className="block text-xs font-bold text-slate-800">
              혼인 상태 및 혼인 기간
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                id="input-marriage-status"
                value={profile.marriageStatus}
                onChange={(e) => updateProfile('marriageStatus', e.target.value)}
                className="w-full min-w-0 text-xs border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="married">기혼 (혼인 중)</option>
                <option value="single">미혼 (단독/1인)</option>
                <option value="divorced_or_widowed">이혼 / 사별</option>
              </select>

              {profile.marriageStatus === 'married' ? (
                <select
                  id="input-marriage-years"
                  value={profile.marriageYears}
                  onChange={(e) => updateProfile('marriageYears', Number(e.target.value))}
                  className="w-full min-w-0 text-xs border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 font-bold truncate focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {Array.from({ length: 7 }, (_, i) => i + 1).map((yr) => (
                    <option key={yr} value={yr}>
                      혼인 {yr}년차 (신혼특공 대상)
                    </option>
                  ))}
                  <option value={8}>혼인 8년 이상 (신혼특공 제외)</option>
                </select>
              ) : (
                <div className="text-xs text-slate-400 p-1.5 text-center bg-white rounded border border-slate-200">
                  해당 없음
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-500 bg-white p-2 rounded border border-slate-200">
              {profile.marriageStatus === 'married' && profile.marriageYears <= 7
                ? '혼인신고일 기준 7년 이내로 신혼부부 특별공급 요건 충족'
                : '신혼특공은 혼인 7년 이내 무주택세대구성원 대상'}
            </div>
          </div>

          {/* 4) 자녀수 및 신생아 요건 */}
          <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <label className="block text-xs font-bold text-slate-800">
              자녀 수 및 신생아 요건
            </label>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs bg-white p-2 rounded border border-slate-200 min-w-0">
                <span className="text-slate-600 shrink-0 whitespace-nowrap">미성년 자녀:</span>
                <select
                  id="input-minor-children-count"
                  value={profile.minorChildrenCount}
                  onChange={(e) => updateProfile('minorChildrenCount', Number(e.target.value))}
                  className="min-w-0 flex-1 text-xs border border-slate-300 rounded px-2 py-1 bg-white font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={0}>0명</option>
                  <option value={1}>1명</option>
                  <option value={2}>2명 (다자녀 완화 충족)</option>
                  <option value={3}>3명 (다자녀 고배점)</option>
                  <option value={4}>4명 이상</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 bg-white p-2 rounded border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors min-w-0">
                <input
                  id="input-has-newborn"
                  type="checkbox"
                  checked={profile.hasNewborn}
                  onChange={(e) => updateProfile('hasNewborn', e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 shrink-0"
                />
                <span className="font-semibold text-slate-800 whitespace-nowrap">2년내 신생아·태아</span>
              </label>
            </div>

            <div className="text-[11px] text-slate-500 bg-white p-2 rounded border border-slate-200">
              {profile.hasNewborn
                ? '신생아 특별공급 및 신혼/생애최초 20% 우선배정 신청 요건 충족'
                : '공고일 기준 2년 이내 출생(임신/입양 포함) 자녀 보유 시 신생아 특공 가능'}
            </div>
          </div>

          {/* 5) 생애최초 요건 및 소득세 납부 */}
          <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <label className="block text-xs font-bold text-slate-800">
              생애최초 주택구입 요건
            </label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs text-slate-800 bg-white p-2 rounded border border-slate-200 cursor-pointer min-w-0">
                <input
                  id="input-is-first-life-ever"
                  type="checkbox"
                  checked={profile.isFirstLifeEver}
                  onChange={(e) => updateProfile('isFirstLifeEver', e.target.checked)}
                  className="rounded text-blue-600 shrink-0"
                />
                <span className="leading-snug">세대원 전원 과거 주택 소유 이력 없음</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-800 bg-white p-2 rounded border border-slate-200 cursor-pointer min-w-0">
                <input
                  id="input-tax-paid-5years"
                  type="checkbox"
                  checked={profile.taxPaid5Years}
                  onChange={(e) => updateProfile('taxPaid5Years', e.target.checked)}
                  className="rounded text-blue-600 shrink-0"
                />
                <span className="leading-snug">5개년 이상 소득세 납부 실적 완료</span>
              </label>
            </div>
          </div>

          {/* 6) 청약통장 가입기간 및 예치금 */}
          <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <label className="block text-xs font-bold text-slate-800">
              청약통장 가입기간 및 예치금
            </label>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <div className="flex-1 min-w-[170px] flex items-center justify-between gap-1.5 text-xs bg-white p-2 rounded border border-slate-200 min-w-0">
                <span className="text-slate-600 shrink-0 whitespace-nowrap">가입기간:</span>
                <select
                  id="input-bankbook-months"
                  value={profile.bankbookMonths}
                  onChange={(e) => updateProfile('bankbookMonths', Number(e.target.value))}
                  className="min-w-0 flex-1 text-xs border border-slate-300 rounded px-1.5 py-1 bg-white font-bold truncate focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={3}>3개월 (1순위 미달)</option>
                  <option value={6}>6개월 (1순위 충족, 2점)</option>
                  <option value={12}>1년 이상 (3점)</option>
                  <option value={36}>3년 이상 (5점)</option>
                  <option value={60}>5년 이상 (7점)</option>
                  <option value={120}>10년 이상 (12점)</option>
                  <option value={180}>15년 이상 (17점 만점)</option>
                </select>
              </div>

              <div className="flex-1 min-w-[170px] flex items-center justify-between gap-1.5 text-xs bg-white p-2 rounded border border-slate-200 min-w-0">
                <span className="text-slate-600 shrink-0 whitespace-nowrap">예치금:</span>
                <select
                  id="input-deposit-amount"
                  value={profile.depositAmount}
                  onChange={(e) => updateProfile('depositAmount', Number(e.target.value))}
                  className="min-w-0 flex-1 text-xs border border-slate-300 rounded px-1.5 py-1 bg-white font-bold truncate focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={300}>300만원 (85㎡ 이하)</option>
                  <option value={600}>600만원 (102㎡ 이하)</option>
                  <option value={1000}>1,000만원 (135㎡ 이하)</option>
                  <option value={1500}>1,500만원 (모든 면적)</option>
                </select>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 bg-white p-2 rounded border border-slate-200 flex items-center justify-between">
              <span>통장 가점:</span>
              <span className="font-bold text-blue-700">{scoreBreakdown.bankbookScore}점 / 17점</span>
            </div>
          </div>

          {/* 7) 부양가족 수 및 노부모 부양 */}
          <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <label className="block text-xs font-bold text-slate-800">
              부양가족 수 (본인 제외)
            </label>
            <div className="flex items-center justify-between gap-1.5 text-xs bg-white p-2 rounded border border-slate-200 min-w-0">
              <span className="text-slate-600 shrink-0 whitespace-nowrap">부양가족수:</span>
              <select
                id="input-dependent-count"
                value={profile.dependentCount}
                onChange={(e) => updateProfile('dependentCount', Number(e.target.value))}
                className="min-w-0 flex-1 text-xs border border-slate-300 rounded px-2 py-1 bg-white font-bold truncate focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={0}>0명 (5점)</option>
                <option value={1}>1명 (10점)</option>
                <option value={2}>2명 (15점)</option>
                <option value={3}>3명 (20점)</option>
                <option value={4}>4명 (25점)</option>
                <option value={5}>5명 (30점)</option>
                <option value={6}>6명 이상 (35점 만점)</option>
              </select>
            </div>
            <div className="text-[11px] text-slate-500 bg-white p-2 rounded border border-slate-200 flex items-center justify-between">
              <span>부양가족 가점:</span>
              <span className="font-bold text-blue-700">{scoreBreakdown.dependentScore}점 / 35점</span>
            </div>
          </div>

          {/* 8) 65세 이상 직계존속 부양 여부 및 기간 */}
          <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <label className="block text-xs font-bold text-slate-800">
              만 65세 이상 노부모 부양
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-slate-800 bg-white p-2 rounded border border-slate-200 cursor-pointer min-w-0">
                <input
                  id="input-supports-elderly"
                  type="checkbox"
                  checked={profile.supportsElderlyOver65}
                  onChange={(e) => updateProfile('supportsElderlyOver65', e.target.checked)}
                  className="rounded text-blue-600 shrink-0"
                />
                <span className="leading-snug">만 65세 이상 직계존속 부양 중</span>
              </label>

              {profile.supportsElderlyOver65 && (
                <div className="flex items-center justify-between gap-1.5 text-xs bg-white p-2 rounded border border-slate-200 min-w-0">
                  <span className="text-slate-600 shrink-0 whitespace-nowrap">계속 등재·부양 기간:</span>
                  <select
                    id="input-elderly-support-years"
                    value={profile.elderlySupportYears}
                    onChange={(e) =>
                      updateProfile('elderlySupportYears', Number(e.target.value))
                    }
                    className="min-w-0 flex-1 text-xs border border-slate-300 rounded px-2 py-1 bg-white font-bold truncate focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={1}>1년 (노부모특공 3년 미달)</option>
                    <option value={2}>2년 (노부모특공 3년 미달)</option>
                    <option value={3}>3년 이상 (노부모특공 충족)</option>
                    <option value={4}>4년 이상 (충족)</option>
                    <option value={5}>5년 이상 (충족)</option>
                  </select>
                </div>
              )}
            </div>
            <div className="text-[11px] text-slate-500 bg-white p-2 rounded border border-slate-200">
              노부모특공은 세대주만 신청 가능하며 3년 이상 동일등본 부양 필수
            </div>
          </div>

          {/* 9) 소득 및 자산 요건 */}
          <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <label className="block text-xs font-bold text-slate-800">
              소득 및 자산 요건
            </label>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-1.5 text-xs bg-white p-2 rounded border border-slate-200 min-w-0">
                <span className="text-slate-600 shrink-0 whitespace-nowrap">소득 분위:</span>
                <select
                  id="input-income-tier"
                  value={profile.incomeTier}
                  onChange={(e) => updateProfile('incomeTier', e.target.value)}
                  className="min-w-0 flex-1 text-xs border border-slate-300 rounded px-2 py-1 bg-white font-bold truncate focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="under_100">100% 이하 (우선공급군)</option>
                  <option value="under_140">140% 이하 (일반/맞벌이군)</option>
                  <option value="under_160">160% 이하 (추첨군)</option>
                  <option value="under_200">200% 이하 (신생아 완화)</option>
                  <option value="over_limit">기준 초과 (특공 불가)</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-800 bg-white p-2 rounded border border-slate-200 cursor-pointer min-w-0">
                <input
                  id="input-asset-satisfied"
                  type="checkbox"
                  checked={profile.assetSatisfied}
                  onChange={(e) => updateProfile('assetSatisfied', e.target.checked)}
                  className="rounded text-blue-600 shrink-0"
                />
                <span className="leading-snug">자산 요건 충족 (부동산 3.31억원 이하 등)</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Section 3: Eligibility Qualification Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600" />
            <span>2. 청약경로별 자격 판정 카드</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            기준 공고: {activeRule.projectName}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: 신혼부부 */}
          <div
            id="eligibility-card-newlywed"
            className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between shadow-sm transition-all ${
              analysis.newlywed.eligible
                ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-400/50'
                : 'bg-white border-slate-200 opacity-90'
            }`}
          >
            <div>
              <div className="flex items-center justify-between flex-wrap gap-1.5 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  특별공급 (18%)
                </span>
                {analysis.newlywed.eligible ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 신청가능
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    <XCircle className="w-3.5 h-3.5 text-slate-500" /> 신청불가
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">신혼부부</h3>
              <p
                className={`text-xs leading-relaxed ${
                  analysis.newlywed.eligible ? 'text-emerald-900 font-medium' : 'text-rose-600 font-semibold'
                }`}
              >
                {analysis.newlywed.reason}
              </p>
            </div>
            {analysis.newlywed.details.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                {analysis.newlywed.details.map((d, i) => (
                  <div key={i} className="flex items-start gap-1">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: 생애최초 */}
          <div
            id="eligibility-card-firstlife"
            className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between shadow-sm transition-all ${
              analysis.firstLife.eligible
                ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-400/50'
                : 'bg-white border-slate-200 opacity-90'
            }`}
          >
            <div>
              <div className="flex items-center justify-between flex-wrap gap-1.5 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  특별공급 (9%)
                </span>
                {analysis.firstLife.eligible ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 신청가능
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    <XCircle className="w-3.5 h-3.5 text-slate-500" /> 신청불가
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">생애최초</h3>
              <p
                className={`text-xs leading-relaxed ${
                  analysis.firstLife.eligible ? 'text-emerald-900 font-medium' : 'text-rose-600 font-semibold'
                }`}
              >
                {analysis.firstLife.reason}
              </p>
            </div>
            {analysis.firstLife.details.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                {analysis.firstLife.details.map((d, i) => (
                  <div key={i} className="flex items-start gap-1">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 3: 신생아 */}
          <div
            id="eligibility-card-newborn"
            className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between shadow-sm transition-all ${
              analysis.newborn.status === 'not_applicable'
                ? 'bg-slate-50/70 border-slate-300 opacity-90'
                : analysis.newborn.eligible
                ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-400/50'
                : 'bg-white border-slate-200 opacity-90'
            }`}
          >
            <div>
              <div className="flex items-center justify-between flex-wrap gap-1.5 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  특별공급 (신생아)
                </span>
                {analysis.newborn.status === 'not_applicable' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">
                    <Info className="w-3.5 h-3.5 text-amber-600" /> 제도 미적용 (not_applicable)
                  </span>
                ) : analysis.newborn.eligible ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 신청가능
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    <XCircle className="w-3.5 h-3.5 text-slate-500" /> 신청불가
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">신생아</h3>
              <p
                className={`text-xs leading-relaxed ${
                  analysis.newborn.status === 'not_applicable'
                    ? 'text-amber-800 font-medium'
                    : analysis.newborn.eligible
                    ? 'text-emerald-900 font-medium'
                    : 'text-rose-600 font-semibold'
                }`}
              >
                {analysis.newborn.reason}
              </p>
            </div>
            {analysis.newborn.details.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                {analysis.newborn.details.map((d, i) => (
                  <div key={i} className="flex items-start gap-1">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 4: 다자녀 */}
          <div
            id="eligibility-card-multichild"
            className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between shadow-sm transition-all ${
              analysis.multiChild.eligible
                ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-400/50'
                : 'bg-white border-slate-200 opacity-90'
            }`}
          >
            <div>
              <div className="flex items-center justify-between flex-wrap gap-1.5 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  특별공급 (10%)
                </span>
                {analysis.multiChild.eligible ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 신청가능
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    <XCircle className="w-3.5 h-3.5 text-slate-500" /> 신청불가
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">다자녀가구</h3>
              <p
                className={`text-xs leading-relaxed ${
                  analysis.multiChild.eligible ? 'text-emerald-900 font-medium' : 'text-rose-600 font-semibold'
                }`}
              >
                {analysis.multiChild.reason}
              </p>
            </div>
            {analysis.multiChild.details.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                {analysis.multiChild.details.map((d, i) => (
                  <div key={i} className="flex items-start gap-1">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 5: 노부모부양 */}
          <div
            id="eligibility-card-elderlyparent"
            className={`rounded-xl border p-4 sm:p-5 flex flex-col justify-between shadow-sm transition-all ${
              analysis.elderlyParent.eligible
                ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-400/50'
                : 'bg-white border-slate-200 opacity-90'
            }`}
          >
            <div>
              <div className="flex items-center justify-between flex-wrap gap-1.5 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  특별공급 (3%)
                </span>
                {analysis.elderlyParent.eligible ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 신청가능
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    <XCircle className="w-3.5 h-3.5 text-slate-500" /> 신청불가
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">노부모부양</h3>
              <p
                className={`text-xs leading-relaxed ${
                  analysis.elderlyParent.eligible ? 'text-emerald-900 font-medium' : 'text-rose-600 font-semibold'
                }`}
              >
                {analysis.elderlyParent.reason}
              </p>
            </div>
            {analysis.elderlyParent.details.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                {analysis.elderlyParent.details.map((d, i) => (
                  <div key={i} className="flex items-start gap-1">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 6: 일반공급 (가점 / 추첨) */}
          <div
            id="eligibility-card-generalsupply"
            className="rounded-xl border p-4 sm:p-5 flex flex-col justify-between shadow-sm bg-blue-50/40 border-blue-300 ring-1 ring-blue-400/50"
          >
            <div>
              <div className="flex items-center justify-between flex-wrap gap-1.5 mb-2">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                  일반공급 (1순위)
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-blue-600 text-white">
                  가점 {scoreBreakdown.totalScore}점 / 84점
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">일반공급 가점 및 추첨</h3>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                {analysis.generalSupply.reason}
              </p>
            </div>

            <div className="mt-3 pt-3 border-t border-blue-200 text-[11px] text-slate-700 space-y-1.5">
              <div className="grid grid-cols-3 gap-1 bg-white/80 p-2 rounded border border-blue-200 font-mono text-center">
                <div>
                  <span className="text-slate-500 block text-[10px]">무주택</span>
                  <span className="font-bold text-blue-800">{scoreBreakdown.homelessScore}점</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">부양가족</span>
                  <span className="font-bold text-blue-800">{scoreBreakdown.dependentScore}점</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">통장기간</span>
                  <span className="font-bold text-blue-800">{scoreBreakdown.bankbookScore}점</span>
                </div>
              </div>
              <div className="text-[11px] text-blue-900 font-medium">
                • {analysis.generalSupply.lotteryCategory}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
      )}

      {/* Mode 3: Plan Comparison by Type */}
      {(activeStrategyMode === 'types' || activeStrategyMode === 'all') && (
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Table className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">
                3. 향후 사업지 계획 타입별 공급방식 & 과거 유사 실적 비교
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {isGwacheonPlan ? '과천 사업지는 입주자모집공고가 확보되지 않아 공급방식·배정세대·신청자격을 판정하지 않습니다.' : '85㎡ 이하(가점 40% + 추첨 60%) 및 초과(추첨 100%) 공급방식은 해당 공고 규칙에 따라 동적 판정됩니다.'}
            </p>
          </div>

          {/* Project selector for future plans */}
          <div className="flex flex-col items-start gap-2">
            <span className="text-xs font-bold text-slate-600">대상 사업지:</span>
            <ProjectSelector selectedId={selectedFutureProject} onSelect={setSelectedFutureProject} idPrefix="strategy-project" />
          </div>
        </div>

        {isGwacheonPlan ? <div className="space-y-3" id="gwacheon-strategy-plan">
          <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
            {futurePlanConfig?.displayName} · 사용자 제공 도면 기준입니다. 부산 공고의 자격·지역우선·가점/추첨 규칙은 적용하지 않습니다. 아래 타입의 일반분양 여부와 세대수는 모집공고 확인이 필요합니다.
          </p>
          <div className="overflow-x-auto border border-slate-200 rounded-lg"><table className="w-full text-left text-xs">
            <thead className="bg-slate-50"><tr>{['확보 타입', '면적군', '공급방식', '일반분양 세대수', '신청자격'].map(label => <th key={label} className="p-3 whitespace-nowrap">{label}</th>)}</tr></thead>
            <tbody>{futurePlanConfig?.unitTypes?.map(unit => <tr key={unit.typeCode} className="border-t border-slate-200">
              <td className="p-3 font-bold">{unit.typeCode}</td><td className="p-3">{unit.areaGroup}㎡군 (정확한 전용면적 미확인)</td>
              <td className="p-3">모집공고 확인 필요</td><td className="p-3">미확인</td><td className="p-3">판정 보류</td>
            </tr>)}</tbody>
          </table></div>
        </div> : <>
        {/* Future Plan Comparison Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <th className="py-2.5 px-3 whitespace-nowrap">타입</th>
                <th className="py-2.5 px-3 whitespace-nowrap">전용면적</th>
                <th className="py-2.5 px-3 whitespace-nowrap">공급방식</th>
                <th className="py-2.5 px-3 whitespace-nowrap">배정세대</th>
                <th className="py-2.5 px-3 whitespace-nowrap">신청가능 여부 (사용자 조건)</th>
                <th className="py-2.5 px-3 whitespace-nowrap">과거 유사 실적 / 경쟁률 (참조)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {comparisonRows.map((row, idx) => {
                const isUnder85 = row.exclusiveArea <= 85;
                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                      {row.typeCode}
                    </td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      {row.exclusiveArea}㎡
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          isUnder85
                            ? 'bg-slate-100 text-slate-700 border border-slate-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}
                      >
                        {row.supplyMethod}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      {row.quota}세대
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="space-y-0.5">
                        {row.eligibilityStatus.canApplySpecial ? (
                          <div className="flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>
                              특공 가능 ({row.eligibilityStatus.specialTypes.join(', ')})
                            </span>
                          </div>
                        ) : (
                          <div className="text-slate-400 text-[11px]">특공 대상 아님</div>
                        )}
                        <div className="flex items-center gap-1 text-blue-700 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>
                            일반 1순위 가능 ({isUnder85 ? `가점 ${scoreBreakdown.totalScore}점 + 추첨` : '추첨 100%'})
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {row.historicalBenchmark ? (
                        <div className="text-[11px]">
                          <span className="font-semibold text-slate-800">
                            {row.historicalBenchmark.benchmarkProjectName}{' '}
                            {row.historicalBenchmark.benchmarkTypeCode}
                          </span>
                          <span className="text-blue-600 font-bold ml-1.5 font-mono">
                            {row.historicalBenchmark.compRatio}:1
                          </span>
                          {row.historicalBenchmark.pointsAvg !== null ? (
                            <span className="text-slate-500 ml-1.5 font-mono">
                              (평균 {row.historicalBenchmark.pointsAvg}점)
                            </span>
                          ) : row.historicalBenchmark.pointsMin !== null ? (
                            <span className="text-slate-500 ml-1.5 font-mono">
                              (최저 {row.historicalBenchmark.pointsMin}점)
                            </span>
                          ) : (
                            <span className="text-slate-400 ml-1.5">(추첨 100%)</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>}
      </div>
      )}

      {/* Mode 4: Recent Busan Historical DB */}
      {(activeStrategyMode === 'db' || activeStrategyMode === 'all') && (
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">
                4. 최근 부산 실적 데이터베이스 (공식 청약 실적)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              공식 발표된 청약홈 및 입주자모집공고 접수 결과만 수록되어 있으며, 미공개 값은 임의 추정 없이 '-'로 보존됩니다.
            </p>
          </div>

          {/* Benchmark complex switcher */}
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-50 shrink-0">
            {BENCHMARK_PROJECTS.map((bench) => (
              <button
                key={bench.id}
                id={`bench-tab-${bench.id}`}
                onClick={() => setSelectedBenchmarkId(bench.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  selectedBenchmarkId === bench.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {bench.name}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Benchmark Metadata */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-bold text-slate-900 text-sm mr-2">{activeBenchmark.name}</span>
            <span className="text-slate-500">{activeBenchmark.location}</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-slate-600 text-[11px]">
            <span>공고일: {activeBenchmark.announcementDate}</span>
            <span>총 {activeBenchmark.totalUnits}세대</span>
            <span>일반 {activeBenchmark.generalSupplyTotalUnits}세대</span>
            <span>특공 {activeBenchmark.specialSupplyTotalUnits}세대</span>
          </div>
        </div>

        {/* 1) 특별공급 접수 실적 테이블 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              특별공급 타입별 접수 현황
            </h3>
            <span className="text-[11px] text-slate-400">다자녀 / 신혼 / 생애최초 / 노부모</span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-2 px-3">타입</th>
                  <th className="py-2 px-3">면적</th>
                  <th className="py-2 px-3 text-center">특공 총배정</th>
                  <th className="py-2 px-3 text-center">총 접수</th>
                  <th className="py-2 px-3 text-center">평균 경쟁률</th>
                  <th className="py-2 px-3">신혼부부 (배정/접수)</th>
                  <th className="py-2 px-3">생애최초 (배정/접수)</th>
                  <th className="py-2 px-3">다자녀 (배정/접수)</th>
                  <th className="py-2 px-3">노부모부양 (배정/접수)</th>
                  <th className="py-2 px-3">신생아 (배정/접수)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800 font-mono">
                {activeBenchmark.types.map((t, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-bold text-slate-900">{t.typeCode}</td>
                    <td className="py-2 px-3">{t.exclusiveArea}㎡</td>
                    <td className="py-2 px-3 text-center font-bold">
                      {t.specialSupply.totalQuota > 0 ? `${t.specialSupply.totalQuota}세대` : '-'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {t.specialSupply.totalApps !== null && t.specialSupply.totalApps > 0
                        ? `${t.specialSupply.totalApps}건`
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-emerald-700">
                      {t.specialSupply.avgCompRatio > 0
                        ? `${t.specialSupply.avgCompRatio}:1`
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      {t.specialSupply.newlywed
                        ? `${t.specialSupply.newlywed.quota ?? '-'}세대 / ${t.specialSupply.newlywed.totalApps ?? '-'}건 (${t.specialSupply.newlywed.compRatio !== null ? t.specialSupply.newlywed.compRatio + ':1' : '-'})`
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      {t.specialSupply.firstLife
                        ? `${t.specialSupply.firstLife.quota ?? '-'}세대 / ${t.specialSupply.firstLife.totalApps ?? '-'}건 (${t.specialSupply.firstLife.compRatio !== null ? t.specialSupply.firstLife.compRatio + ':1' : '-'})`
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      {t.specialSupply.multiChild
                        ? `${t.specialSupply.multiChild.quota ?? '-'}세대 / ${t.specialSupply.multiChild.totalApps ?? '-'}건 (${t.specialSupply.multiChild.compRatio !== null ? t.specialSupply.multiChild.compRatio + ':1' : '-'})`
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      {t.specialSupply.elderlyParent
                        ? `${t.specialSupply.elderlyParent.quota ?? '-'}세대 / ${t.specialSupply.elderlyParent.totalApps ?? '-'}건 (${t.specialSupply.elderlyParent.compRatio !== null ? t.specialSupply.elderlyParent.compRatio + ':1' : '-'})`
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-slate-600 font-sans">
                      {t.specialSupply.newborn === 'not_applicable' ? (
                        <span className="text-[11px] text-amber-700 font-medium">제도 미적용</span>
                      ) : t.specialSupply.newborn ? (
                        `${t.specialSupply.newborn.quota ?? '-'}세대 / ${t.specialSupply.newborn.totalApps ?? '-'}건`
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2) 일반공급 접수 및 당첨가점 실적 테이블 */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              일반공급 1순위 경쟁률 및 당첨 가점 실적
            </h3>
            <span className="text-[11px] text-slate-400">
              85㎡ 초과 추첨 100% 평형은 가점 대상 제외
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-2 px-3">타입</th>
                  <th className="py-2 px-3">공급방식</th>
                  <th className="py-2 px-3 text-center">공급세대수</th>
                  <th className="py-2 px-3 text-center">해당지역 접수</th>
                  <th className="py-2 px-3 text-center">경쟁률</th>
                  <th className="py-2 px-3 text-center">가점 최저</th>
                  <th className="py-2 px-3 text-center">가점 최고</th>
                  <th className="py-2 px-3 text-center">가점 평균</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800 font-mono">
                {activeBenchmark.types.map((t, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-bold text-slate-900">{t.typeCode}</td>
                    <td className="py-2 px-3 font-sans">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${
                          t.supplyCategory === 'under85'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {t.supplyMethodDescription}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center font-bold">
                      {t.generalSupply.quota !== null ? `${t.generalSupply.quota}세대` : '-'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {t.generalSupply.localApps !== null ? `${t.generalSupply.localApps.toLocaleString()}명` : '-'}
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-blue-700">
                      {t.generalSupply.compRatio !== null ? `${t.generalSupply.compRatio}:1` : '-'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {t.generalSupply.pointsMin !== null ? `${t.generalSupply.pointsMin}점` : '-'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {t.generalSupply.pointsMax !== null ? `${t.generalSupply.pointsMax}점` : '-'}
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-slate-900">
                      {t.generalSupply.pointsAvg !== null ? `${t.generalSupply.pointsAvg}점` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            출처: {activeBenchmark.officialSourceNote}
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
