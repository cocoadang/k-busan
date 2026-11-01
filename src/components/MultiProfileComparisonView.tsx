import React, { useState, useMemo } from 'react';
import {
  Users,
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Edit3,
  Calendar,
  Building,
  Info,
  Layers,
  Sparkles,
  RotateCcw,
  Check,
  X,
} from 'lucide-react';
import {
  AnnouncementRule,
  MultiSubscriptionProfile,
  UserSubscriptionProfile,
} from '../types/subscription.ts';
import { ANNOUNCEMENT_RULES } from '../data/subscriptionBenchmarkData.ts';
import {
  DEFAULT_MULTI_PROFILES,
  createNewSubscriptionProfile,
  evaluateMultiProfiles,
  getNextProfileAlias,
  isDraftAnnouncementRule,
} from '../utils/multiProfileHelper.ts';

export const MultiProfileComparisonView: React.FC = () => {
  // 1. Target Announcement Rule Selection
  const [selectedRuleId, setSelectedRuleId] = useState<string>('rule-summit-namcheon-2025');
  const activeRule: AnnouncementRule =
    ANNOUNCEMENT_RULES[selectedRuleId] || ANNOUNCEMENT_RULES['rule-summit-namcheon-2025'];
  const isDraftNotice = useMemo(() => isDraftAnnouncementRule(activeRule), [activeRule]);

  // 2. Multi-Profile List State (Aliases: 프로필 A, 프로필 B, 프로필 C...)
  const [profiles, setProfiles] = useState<MultiSubscriptionProfile[]>(DEFAULT_MULTI_PROFILES);

  // 3. Editing Profile State (Modal / Drawer)
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<UserSubscriptionProfile | null>(null);

  // 4. Comparison Evaluation Results
  const comparisonResults = useMemo(() => {
    return evaluateMultiProfiles(profiles, activeRule);
  }, [profiles, activeRule]);

  // Add new profile with next alias ('프로필 D'...)
  const handleAddProfile = () => {
    const nextAlias = getNextProfileAlias(profiles.map((p) => p.alias));
    const newProfile = createNewSubscriptionProfile(nextAlias);
    setProfiles((prev) => [...prev, newProfile]);
  };

  // Delete profile (allow if at least 1 remaining)
  const handleDeleteProfile = (id: string) => {
    if (profiles.length <= 1) {
      return;
    }
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    if (editingProfileId === id) {
      setEditingProfileId(null);
      setEditingDraft(null);
    }
  };

  // Reset to default 3 profiles
  const handleResetDefaults = () => {
    setProfiles(DEFAULT_MULTI_PROFILES);
    setEditingProfileId(null);
    setEditingDraft(null);
  };

  // Open editor
  const handleOpenEdit = (profile: MultiSubscriptionProfile) => {
    setEditingProfileId(profile.id);
    setEditingDraft({ ...profile.profile });
  };

  // Save edited profile
  const handleSaveEdit = () => {
    if (!editingProfileId || !editingDraft) return;
    setProfiles((prev) =>
      prev.map((p) => (p.id === editingProfileId ? { ...p, profile: { ...editingDraft } } : p))
    );
    setEditingProfileId(null);
    setEditingDraft(null);
  };

  // Quick preset template apply in editor
  const handleApplyTemplate = (type: 'newlywed' | 'multichild' | 'elderly' | 'homeless') => {
    if (!editingDraft) return;
    if (type === 'newlywed') {
      setEditingDraft((prev) => ({
        ...prev!,
        marriageStatus: 'married',
        marriageYears: 3,
        minorChildrenCount: 1,
        isHomeless: true,
        homelessYears: 3,
        isFirstLifeEver: false,
        supportsElderlyOver65: false,
        incomeTier: 'under_140',
        bankbookMonths: 36,
      }));
    } else if (type === 'multichild') {
      setEditingDraft((prev) => ({
        ...prev!,
        marriageStatus: 'married',
        marriageYears: 7,
        minorChildrenCount: 3,
        hasNewborn: true,
        isHomeless: true,
        homelessYears: 7,
        isFirstLifeEver: false,
        supportsElderlyOver65: false,
        incomeTier: 'under_160',
        bankbookMonths: 84,
      }));
    } else if (type === 'elderly') {
      setEditingDraft((prev) => ({
        ...prev!,
        marriageStatus: 'married',
        marriageYears: 15,
        minorChildrenCount: 2,
        hasNewborn: false,
        isHomeless: true,
        homelessYears: 12,
        isHouseholder: true,
        supportsElderlyOver65: true,
        elderlySupportYears: 4,
        dependentCount: 4,
        incomeTier: 'under_140',
        bankbookMonths: 144,
      }));
    } else if (type === 'homeless') {
      setEditingDraft((prev) => ({
        ...prev!,
        marriageStatus: 'single',
        marriageYears: 0,
        minorChildrenCount: 0,
        hasNewborn: false,
        isHomeless: true,
        homelessYears: 15,
        isHouseholder: true,
        supportsElderlyOver65: false,
        dependentCount: 0,
        isFirstLifeEver: true,
        taxPaid5Years: true,
        incomeTier: 'under_100',
        bankbookMonths: 180,
      }));
    }
  };

  const editingProfileAlias = useMemo(() => {
    if (!editingProfileId) return '';
    return profiles.find((p) => p.id === editingProfileId)?.alias || '';
  }, [editingProfileId, profiles]);

  return (
    <div id="multi-profile-comparison-container" className="space-y-6">
      {/* 1. Header & Announcement Rule Selection */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold mb-2">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Phase 5B 다중 청약 프로필 병렬 비교</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              신청자 프로필별 자격 · 가점 · 거주기간 병렬 대조
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
              여러 신청자 조건(프로필 A, B, C...)을 동일한 모집공고 기준에 대입하여 5대 특별공급과 일반공급 가점/추첨 자격을 나란히 비교합니다.
              <strong> 특정 프로필이나 청약유형을 추천하거나 순위화하지 않으며</strong>, 각 조건별 자격 충족 여부와 근거를 객관적으로 제시합니다.
            </p>
          </div>

          {/* Announcement Rule selector */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 min-w-[280px] shrink-0">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              비교 기준 모집공고 (Rule Version)
            </label>
            <select
              id="multi-announcement-rule-select"
              value={selectedRuleId}
              onChange={(e) => setSelectedRuleId(e.target.value)}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <optgroup label="최근 실적 단지 (확정 공고)">
                <option value="rule-summit-namcheon-2025">
                  써밋 리미티드 남천 (2025-07-31 공고)
                </option>
                <option value="rule-luel-centum-2025">
                  르엘 리버파크 센텀 (2025-07-11 공고)
                </option>
                <option value="rule-venueve-haeundae-2025">
                  베뉴브 해운대 (2025-09-19 공고)
                </option>
              </optgroup>
              <optgroup label="향후 예정 사업지 (공고 등록 전 모델)">
                <option value="rule-chokjin-3-draft">
                  촉진3구역 (모집공고 예정 모델 · 2026)
                </option>
                <option value="rule-udong-3-draft">
                  우동3구역 (모집공고 예정 모델 · 2026)
                </option>
                <option value="rule-samik-beach-draft">
                  삼익비치 (모집공고 예정 모델 · 2027)
                </option>
              </optgroup>
            </select>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 font-mono">
              <span>공고일: {activeRule.announcementDate}</span>
              <span>우선공급: 부산 {activeRule.busanResidenceRequirementMonths}개월</span>
            </div>
          </div>
        </div>

        {/* Future Draft Announcement Notice Banner */}
        {isDraftNotice && (
          <div
            id="draft-notice-banner"
            className="mt-4 p-3.5 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2.5 text-xs text-amber-900"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">
                [모집공고 등록 전 · 자격 미확정 안내]
              </span>{' '}
              선택하신 <strong>{activeRule.projectName}</strong>은(는) 현재 입주자모집공고 정식 등록 전 상태입니다.
              표시된 특별공급 및 일반공급 자격은 예상 사업계획 규정에 따른 시뮬레이션이며,
              <strong> 실제 공고 등록 시 최종 확정 공고문을 통해 자격을 반드시 재확인해야 합니다.</strong>
            </div>
          </div>
        )}
      </div>

      {/* 2. Profile Management Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-bold text-slate-800">
            비교 대상 프로필 목록 ({profiles.length}개)
          </span>
          <span className="text-xs text-slate-400 font-mono">
            (별칭: {profiles.map((p) => p.alias).join(', ')})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-add-profile"
            onClick={handleAddProfile}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>새 프로필 추가</span>
          </button>

          <button
            id="btn-reset-profiles"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            title="초기 3대 프로필(신혼, 다자녀, 노부모)로 복원"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>초기화</span>
          </button>
        </div>
      </div>

      {/* 3. Parallel Comparison Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              프로필별 청약 자격 및 일반공급 가점 병렬 비교표
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> 가능
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> 불가
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> 미적용/확인필요
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <th className="py-3 px-4 w-44 font-bold text-slate-900 bg-slate-100/70 sticky left-0 z-10">
                  구분 / 비교 항목
                </th>
                {comparisonResults.map((item) => (
                  <th
                    key={item.id}
                    className="py-3 px-4 min-w-[220px] font-bold text-center border-l border-slate-200 bg-white"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-sm font-extrabold text-indigo-700">
                        {item.alias}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            const found = profiles.find((p) => p.id === item.id);
                            if (found) handleOpenEdit(found);
                          }}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-[11px] font-medium text-slate-600 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3 inline mr-0.5" />
                          수정
                        </button>
                        {profiles.length > 1 && (
                          <button
                            onClick={() => handleDeleteProfile(item.id)}
                            className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title={`${item.alias} 삭제`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] font-normal text-slate-500 font-mono">
                      전입일: {item.profile.busanTransferDate}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {/* SECTION 1: 기본 신청 조건 & 부산 거주기간 */}
              <tr className="bg-slate-50/50">
                <td
                  colSpan={comparisonResults.length + 1}
                  className="py-1.5 px-4 font-bold text-[11px] text-slate-600 uppercase tracking-wider"
                >
                  1. 기본 조건 및 부산 거주기간 (모집공고일: {activeRule.announcementDate} 기준)
                </td>
              </tr>

              {/* 부산 거주기간 자동 계산 */}
              <tr className="hover:bg-slate-50/40">
                <td className="py-2.5 px-4 font-semibold text-slate-800 bg-slate-50/60 sticky left-0 z-10">
                  부산 거주기간
                </td>
                {comparisonResults.map((item) => (
                  <td key={item.id} className="py-2.5 px-4 border-l border-slate-200">
                    <div className="font-bold text-slate-900 font-mono">
                      {item.residenceText}
                    </div>
                    <div className="mt-0.5">
                      {item.meetsLocalRequirement ? (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                          부산 우선공급({activeRule.busanResidenceRequirementMonths}개월) 충족
                        </span>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200">
                          우선공급 미달 (기타지역 접수)
                        </span>
                      )}
                    </div>
                  </td>
                ))}
              </tr>

              {/* 세대주 및 무주택 기간 */}
              <tr className="hover:bg-slate-50/40">
                <td className="py-2.5 px-4 font-semibold text-slate-800 bg-slate-50/60 sticky left-0 z-10">
                  세대주 / 무주택기간
                </td>
                {comparisonResults.map((item) => (
                  <td key={item.id} className="py-2.5 px-4 border-l border-slate-200">
                    <div className="font-medium text-slate-800">
                      {item.profile.isHouseholder ? '세대주' : '세대원'} ·{' '}
                      {item.profile.isHomeless
                        ? `무주택 ${item.profile.homelessYears}년`
                        : `유주택 (${item.profile.ownedHouseCount}채)`}
                    </div>
                  </td>
                ))}
              </tr>

              {/* 혼인 상태 및 기간 */}
              <tr className="hover:bg-slate-50/40">
                <td className="py-2.5 px-4 font-semibold text-slate-800 bg-slate-50/60 sticky left-0 z-10">
                  혼인 상태 / 기간
                </td>
                {comparisonResults.map((item) => (
                  <td key={item.id} className="py-2.5 px-4 border-l border-slate-200">
                    <div className="font-medium text-slate-800">
                      {item.profile.marriageStatus === 'married'
                        ? `기혼 (혼인 ${item.profile.marriageYears}년차)`
                        : item.profile.marriageStatus === 'single'
                        ? '미혼'
                        : '이혼/사별'}
                    </div>
                  </td>
                ))}
              </tr>

              {/* 자녀수 및 신생아 요건 */}
              <tr className="hover:bg-slate-50/40">
                <td className="py-2.5 px-4 font-semibold text-slate-800 bg-slate-50/60 sticky left-0 z-10">
                  자녀수 / 신생아
                </td>
                {comparisonResults.map((item) => (
                  <td key={item.id} className="py-2.5 px-4 border-l border-slate-200">
                    <div className="font-medium text-slate-800">
                      미성년 자녀 {item.profile.minorChildrenCount}명
                      {item.profile.hasNewborn && (
                        <span className="ml-1.5 inline-block px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                          2년내 신생아
                        </span>
                      )}
                    </div>
                  </td>
                ))}
              </tr>

              {/* 부양가족 및 노부모 부양 */}
              <tr className="hover:bg-slate-50/40">
                <td className="py-2.5 px-4 font-semibold text-slate-800 bg-slate-50/60 sticky left-0 z-10">
                  부양가족 / 노부모부양
                </td>
                {comparisonResults.map((item) => (
                  <td key={item.id} className="py-2.5 px-4 border-l border-slate-200">
                    <div className="font-medium text-slate-800">
                      부양가족 {item.profile.dependentCount}명
                      {item.profile.supportsElderlyOver65 ? (
                        <span className="ml-1 text-slate-600">
                          · 노부모 {item.profile.elderlySupportYears}년 부양
                        </span>
                      ) : (
                        ' · 노부모 미부양'
                      )}
                    </div>
                  </td>
                ))}
              </tr>

              {/* 청약통장 가입기간 및 예치금 */}
              <tr className="hover:bg-slate-50/40">
                <td className="py-2.5 px-4 font-semibold text-slate-800 bg-slate-50/60 sticky left-0 z-10">
                  청약통장 가입 / 예치금
                </td>
                {comparisonResults.map((item) => (
                  <td key={item.id} className="py-2.5 px-4 border-l border-slate-200">
                    <div className="font-medium text-slate-800 font-mono">
                      {item.profile.bankbookMonths}개월 ({Math.floor(item.profile.bankbookMonths / 12)}년{' '}
                      {item.profile.bankbookMonths % 12}개월) · {item.profile.depositAmount}만원
                    </div>
                  </td>
                ))}
              </tr>

              {/* SECTION 2: 특별공급 5대 청약경로 자격 판정 */}
              <tr className="bg-slate-50/50">
                <td
                  colSpan={comparisonResults.length + 1}
                  className="py-1.5 px-4 font-bold text-[11px] text-slate-600 uppercase tracking-wider"
                >
                  2. 특별공급 5대 경로별 신청 자격 판정
                  {isDraftNotice && (
                    <span className="ml-2 text-amber-700 font-semibold">
                      (※ 공고 등록 전 모델로 최종 공고문 확인 필요)
                    </span>
                  )}
                </td>
              </tr>

              {/* 신혼부부 특별공급 */}
              <tr className="hover:bg-slate-50/40">
                <td className="py-3 px-4 font-semibold text-slate-800 bg-slate-50/60 sticky left-0 z-10">
                  <div>신혼부부 특공</div>
                  <div className="text-[10px] text-slate-400 font-normal">법정비율 18%</div>
                </td>
                {comparisonResults.map((item) => {
                  const res = item.analysis.newlywed;
                  return (
                    <td key={item.id} className="py-3 px-4 border-l border-slate-200">
                      <div className="flex items-center gap-1.5 mb-1">
                        {res.eligible ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            신청가능
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-[11px]">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            신청불가
                          </span>
                        )}
                        {item.isDraftNotice && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium">
                            공고 확인 필요
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 leading-snug">
                        {res.reason}
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* 생애최초 특별공급 */}
              <tr className="hover:bg-slate-50/40">
                <td className="py-3 px-4 font-semibold text-slate-800 bg-slate-50/60 sticky left-0 z-10">
                  <div>생애최초 특공</div>
                  <div className="text-[10px] text-slate-400 font-normal">법정비율 9% (추첨100%)</div>
                </td>
                {comparisonResults.map((item) => {
                  const res = item.analysis.firstLife;
                  return (
                    <td key={item.id} className="py-3 px-4 border-l border-slate-200">
                      <div className="flex items-center gap-1.5 mb-1">
                        {res.eligible ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            신청가능
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-[11px]">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            신청불가
                          </span>
                        )}
                        {item.isDraftNotice && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium">
                            공고 확인 필요
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 leading-snug">
                        {res.reason}
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* 신생아 특별공급 */}
              <tr className="hover:bg-slate-50/40">
                <td className="py-3 px-4 font-semibold text-slate-800 bg-slate-50/60 sticky left-0 z-10">
                  <div>신생아 특공</div>
                  <div className="text-[10px] text-slate-400 font-normal">
                    2026-06-15 이후 적용
                  </div>
                </td>
                {comparisonResults.map((item) => {
                  const res = item.analysis.newborn;
                  return (
                    <td key={item.id} className="py-3 px-4 border-l border-slate-200">
                      <div className="flex items-center gap-1.5 mb-1">
                        {res.status === 'not_applicable' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[11px]">
                            <Info className="w-3 h-3 text-amber-600" />
                            제도 미적용
                          </span>
                        ) : res.eligible ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            신청가능
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-[11px]">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            신청불가
                          </span>
                        )}
                        {item.isDraftNotice && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium">
                            공고 확인 필요
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 leading-snug">
                        {res.reason}
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* 다자녀가구 특별공급 */}
              <tr className="hover:bg-slate-50/40">
                <td className="py-3 px-4 font-semibold text-slate-800 bg-slate-50/60 sticky left-0 z-10">
                  <div>다자녀 특공</div>
                  <div className="text-[10px] text-slate-400 font-normal">자녀 2명 이상 완화</div>
                </td>
                {comparisonResults.map((item) => {
                  const res = item.analysis.multiChild;
                  return (
                    <td key={item.id} className="py-3 px-4 border-l border-slate-200">
                      <div className="flex items-center gap-1.5 mb-1">
                        {res.eligible ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            신청가능
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-[11px]">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            신청불가
                          </span>
                        )}
                        {item.isDraftNotice && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium">
                            공고 확인 필요
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 leading-snug">
                        {res.reason}
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* 노부모부양 특별공급 */}
              <tr className="hover:bg-slate-50/40">
                <td className="py-3 px-4 font-semibold text-slate-800 bg-slate-50/60 sticky left-0 z-10">
                  <div>노부모부양 특공</div>
                  <div className="text-[10px] text-slate-400 font-normal">세대주 · 3년 계속부양</div>
                </td>
                {comparisonResults.map((item) => {
                  const res = item.analysis.elderlyParent;
                  return (
                    <td key={item.id} className="py-3 px-4 border-l border-slate-200">
                      <div className="flex items-center gap-1.5 mb-1">
                        {res.eligible ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            신청가능
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-[11px]">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            신청불가
                          </span>
                        )}
                        {item.isDraftNotice && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium">
                            공고 확인 필요
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 leading-snug">
                        {res.reason}
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* SECTION 3: 일반공급 가점 총점 및 분해 / 추첨제 */}
              <tr className="bg-slate-50/50">
                <td
                  colSpan={comparisonResults.length + 1}
                  className="py-1.5 px-4 font-bold text-[11px] text-slate-600 uppercase tracking-wider"
                >
                  3. 일반공급 1순위 자격 · 가점 분해 (84점 만점) · 추첨제 대상
                </td>
              </tr>

              {/* 일반공급 1순위 자격 */}
              <tr className="hover:bg-slate-50/40">
                <td className="py-2.5 px-4 font-semibold text-slate-800 bg-slate-50/60 sticky left-0 z-10">
                  1순위 청약 자격
                </td>
                {comparisonResults.map((item) => (
                  <td key={item.id} className="py-2.5 px-4 border-l border-slate-200">
                    <div className="flex items-center gap-1.5 mb-1">
                      {item.analysis.generalSupply.isFirstPriority ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[11px]">
                          1순위 충족
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-[11px]">
                          2순위 대상
                        </span>
                      )}
                      {item.isDraftNotice && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium">
                          공고 확인 필요
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {item.analysis.generalSupply.reason}
                    </div>
                  </td>
                ))}
              </tr>

              {/* 일반공급 가점 총점 */}
              <tr className="hover:bg-slate-50/40 bg-blue-50/20">
                <td className="py-3 px-4 font-bold text-slate-900 bg-slate-50/80 sticky left-0 z-10">
                  <div className="text-blue-900">가점 총점</div>
                  <div className="text-[10px] text-slate-500 font-normal">84점 만점 기준</div>
                </td>
                {comparisonResults.map((item) => (
                  <td key={item.id} className="py-3 px-4 border-l border-slate-200">
                    <div className="text-lg font-black text-blue-700 font-mono">
                      {item.scoreBreakdown.totalScore}
                      <span className="text-xs font-semibold text-slate-500 ml-1">/ 84점</span>
                    </div>
                  </td>
                ))}
              </tr>

              {/* 가점 분해: 무주택 기간 */}
              <tr className="hover:bg-slate-50/40">
                <td className="py-2.5 px-4 font-medium text-slate-700 bg-slate-50/60 sticky left-0 z-10 pl-6">
                  ├ 무주택기간 (최대 32점)
                </td>
                {comparisonResults.map((item) => (
                  <td key={item.id} className="py-2.5 px-4 border-l border-slate-200">
                    <span className="font-bold text-slate-900 font-mono">
                      {item.scoreBreakdown.homelessScore}점
                    </span>
                    <span className="text-slate-400 text-[11px] ml-1">
                      ({item.profile.isHomeless ? `${item.profile.homelessYears}년` : '유주택'})
                    </span>
                  </td>
                ))}
              </tr>

              {/* 가점 분해: 부양가족 수 */}
              <tr className="hover:bg-slate-50/40">
                <td className="py-2.5 px-4 font-medium text-slate-700 bg-slate-50/60 sticky left-0 z-10 pl-6">
                  ├ 부양가족수 (최대 35점)
                </td>
                {comparisonResults.map((item) => (
                  <td key={item.id} className="py-2.5 px-4 border-l border-slate-200">
                    <span className="font-bold text-slate-900 font-mono">
                      {item.scoreBreakdown.dependentScore}점
                    </span>
                    <span className="text-slate-400 text-[11px] ml-1">
                      ({item.profile.dependentCount}명)
                    </span>
                  </td>
                ))}
              </tr>

              {/* 가점 분해: 청약통장 가입기간 */}
              <tr className="hover:bg-slate-50/40">
                <td className="py-2.5 px-4 font-medium text-slate-700 bg-slate-50/60 sticky left-0 z-10 pl-6">
                  └ 청약통장 가입 (최대 17점)
                </td>
                {comparisonResults.map((item) => (
                  <td key={item.id} className="py-2.5 px-4 border-l border-slate-200">
                    <span className="font-bold text-slate-900 font-mono">
                      {item.scoreBreakdown.bankbookScore}점
                    </span>
                    <span className="text-slate-400 text-[11px] ml-1">
                      ({item.profile.bankbookMonths}개월)
                    </span>
                  </td>
                ))}
              </tr>

              {/* 추첨제 대상 여부 */}
              <tr className="hover:bg-slate-50/40">
                <td className="py-2.5 px-4 font-semibold text-slate-800 bg-slate-50/60 sticky left-0 z-10">
                  추첨제 참여 대상
                </td>
                {comparisonResults.map((item) => (
                  <td key={item.id} className="py-2.5 px-4 border-l border-slate-200">
                    <div className="text-xs text-slate-800 font-medium">
                      85㎡ 이하 (추첨 60%) · 85㎡ 초과 (추첨 100%)
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {item.profile.isHomeless
                        ? '무주택자 우선배정 75% 추첨군'
                        : '1주택 처분서약 추첨군'}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Edit Profile Modal */}
      {editingProfileId && editingDraft && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                  프로필 파라미터 편집
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {editingProfileAlias} 조건 수정
                </h3>
              </div>
              <button
                onClick={() => {
                  setEditingProfileId(null);
                  setEditingDraft(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
              {/* Quick Template Apply */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg">
                <span className="font-bold text-indigo-950 block mb-1.5">
                  빠른 템플릿 적용 (현재 프로필에 반영)
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('newlywed')}
                    className="px-2.5 py-1 rounded bg-white hover:bg-indigo-100 text-indigo-800 font-semibold border border-indigo-200 transition-colors cursor-pointer"
                  >
                    신혼부부 템플릿
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('multichild')}
                    className="px-2.5 py-1 rounded bg-white hover:bg-indigo-100 text-indigo-800 font-semibold border border-indigo-200 transition-colors cursor-pointer"
                  >
                    다자녀+신생아 템플릿
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('elderly')}
                    className="px-2.5 py-1 rounded bg-white hover:bg-indigo-100 text-indigo-800 font-semibold border border-indigo-200 transition-colors cursor-pointer"
                  >
                    노부모부양 템플릿
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('homeless')}
                    className="px-2.5 py-1 rounded bg-white hover:bg-indigo-100 text-indigo-800 font-semibold border border-indigo-200 transition-colors cursor-pointer"
                  >
                    15년 무주택 템플릿
                  </button>
                </div>
              </div>

              {/* Form Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 거주지 & 부산 전입일 */}
                <div className="space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="font-bold text-slate-800 block">거주지역</label>
                  <select
                    value={editingDraft.residenceRegion}
                    onChange={(e) =>
                      setEditingDraft({
                        ...editingDraft,
                        residenceRegion: e.target.value as any,
                      })
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white font-semibold"
                  >
                    <option value="busan">부산광역시 (해당지역 대상)</option>
                    <option value="ulsan_gyeongnam">울산/경상남도 (기타지역)</option>
                    <option value="other">기타 전국</option>
                  </select>

                  <label className="font-bold text-slate-800 block pt-1.5">부산 전입일</label>
                  <input
                    type="date"
                    value={editingDraft.busanTransferDate}
                    onChange={(e) =>
                      setEditingDraft({
                        ...editingDraft,
                        busanTransferDate: e.target.value,
                      })
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white font-mono"
                  />
                </div>

                {/* 무주택 여부 & 기간 */}
                <div className="space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="font-bold text-slate-800 block">주택 소유 여부</label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={editingDraft.isHomeless}
                        onChange={() =>
                          setEditingDraft({
                            ...editingDraft,
                            isHomeless: true,
                            ownedHouseCount: 0,
                          })
                        }
                      />
                      <span>무주택자</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={!editingDraft.isHomeless}
                        onChange={() =>
                          setEditingDraft({
                            ...editingDraft,
                            isHomeless: false,
                            ownedHouseCount: 1,
                          })
                        }
                      />
                      <span>유주택자</span>
                    </label>
                  </div>

                  {editingDraft.isHomeless ? (
                    <div>
                      <label className="font-bold text-slate-800 block pt-1">
                        무주택 기간 (년)
                      </label>
                      <select
                        value={editingDraft.homelessYears}
                        onChange={(e) =>
                          setEditingDraft({
                            ...editingDraft,
                            homelessYears: Number(e.target.value),
                          })
                        }
                        className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white font-semibold"
                      >
                        {Array.from({ length: 16 }, (_, i) => (
                          <option key={i} value={i}>
                            {i === 0 ? '1년 미만 (2점)' : i === 15 ? '15년 이상 (32점 만점)' : `${i}년 이상 ~ ${i + 1}년 미만 (${(i + 1) * 2}점)`}
                          </option>
                        ))}
                      </select>

                      <label className="font-bold text-slate-800 block pt-1.5 text-[11px]">
                        무주택 시작일 (선택 시 공고일 기준 자동계산)
                      </label>
                      <input
                        type="date"
                        value={editingDraft.homelessSince || ''}
                        onChange={(e) =>
                          setEditingDraft({
                            ...editingDraft,
                            homelessSince: e.target.value,
                          })
                        }
                        className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono text-xs"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="font-bold text-slate-800 block pt-1">보유 주택수</label>
                      <select
                        value={editingDraft.ownedHouseCount}
                        onChange={(e) =>
                          setEditingDraft({
                            ...editingDraft,
                            ownedHouseCount: Number(e.target.value),
                          })
                        }
                        className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white font-semibold"
                      >
                        <option value={1}>1주택</option>
                        <option value={2}>2주택 이상</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* 혼인 상태 & 혼인 기간 */}
                <div className="space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="font-bold text-slate-800 block">혼인 상태</label>
                  <select
                    value={editingDraft.marriageStatus}
                    onChange={(e) =>
                      setEditingDraft({
                        ...editingDraft,
                        marriageStatus: e.target.value as any,
                      })
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white font-semibold"
                  >
                    <option value="married">기혼 (법률혼)</option>
                    <option value="single">미혼</option>
                    <option value="divorced_or_widowed">이혼/사별</option>
                  </select>

                  {editingDraft.marriageStatus === 'married' && (
                    <div>
                      <label className="font-bold text-slate-800 block pt-1.5">
                        혼인 기간 (년차)
                      </label>
                      <select
                        value={editingDraft.marriageYears}
                        onChange={(e) =>
                          setEditingDraft({
                            ...editingDraft,
                            marriageYears: Number(e.target.value),
                          })
                        }
                        className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white font-semibold"
                      >
                        {Array.from({ length: 7 }, (_, i) => i + 1).map((yr) => (
                          <option key={yr} value={yr}>
                            혼인 {yr}년차 (신혼특공 대상)
                          </option>
                        ))}
                        <option value={8}>혼인 8년 이상</option>
                      </select>

                      <label className="font-bold text-slate-800 block pt-1.5 text-[11px]">
                        혼인신고일 (선택 시 공고일 기준 자동계산)
                      </label>
                      <input
                        type="date"
                        value={editingDraft.marriageDate || ''}
                        onChange={(e) =>
                          setEditingDraft({
                            ...editingDraft,
                            marriageDate: e.target.value,
                          })
                        }
                        className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono text-xs"
                      />
                    </div>
                  )}
                </div>

                {/* 자녀수 & 신생아 요건 */}
                <div className="space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="font-bold text-slate-800 block">미성년 자녀 수</label>
                  <select
                    value={editingDraft.minorChildrenCount}
                    onChange={(e) =>
                      setEditingDraft({
                        ...editingDraft,
                        minorChildrenCount: Number(e.target.value),
                      })
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white font-semibold"
                  >
                    <option value={0}>0명</option>
                    <option value={1}>1명</option>
                    <option value={2}>2명 (다자녀 완화 충족)</option>
                    <option value={3}>3명 (다자녀 고배점)</option>
                    <option value={4}>4명 이상</option>
                  </select>

                  <label className="font-bold text-slate-800 block pt-1.5 text-[11px]">
                    자녀 출생일 목록 (콤마 구분: 2023-01-10, 2025-02-15)
                  </label>
                  <input
                    type="text"
                    placeholder="2023-01-10, 2025-02-15"
                    value={(editingDraft.childrenBirthDates || []).join(', ')}
                    onChange={(e) => {
                      const dates = e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                      setEditingDraft({
                        ...editingDraft,
                        childrenBirthDates: dates,
                      });
                    }}
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono text-xs"
                  />

                  <label className="font-bold text-slate-800 block pt-1.5 text-[11px]">
                    임신 중 출산 예정일 (태아 산입)
                  </label>
                  <input
                    type="date"
                    value={editingDraft.expectedBirthDate || ''}
                    onChange={(e) =>
                      setEditingDraft({
                        ...editingDraft,
                        expectedBirthDate: e.target.value,
                      })
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono text-xs"
                  />

                  <label className="flex items-center gap-2 pt-2 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={editingDraft.hasNewborn}
                      onChange={(e) =>
                        setEditingDraft({
                          ...editingDraft,
                          hasNewborn: e.target.checked,
                        })
                      }
                      className="rounded text-indigo-600"
                    />
                    <span>2년 이내 신생아·태아 보유 (수동 fallback)</span>
                  </label>
                </div>

                {/* 부양가족 & 노부모 부양 */}
                <div className="space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="font-bold text-slate-800 block">부양가족 수 (본인 제외)</label>
                  <select
                    value={editingDraft.dependentCount}
                    onChange={(e) =>
                      setEditingDraft({
                        ...editingDraft,
                        dependentCount: Number(e.target.value),
                      })
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white font-semibold"
                  >
                    {Array.from({ length: 7 }, (_, i) => (
                      <option key={i} value={i}>
                        {i}명 ({(i + 1) * 5}점{i === 6 ? ' 만점' : ''})
                      </option>
                    ))}
                  </select>

                  <div className="pt-1.5">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={editingDraft.supportsElderlyOver65}
                        onChange={(e) =>
                          setEditingDraft({
                            ...editingDraft,
                            supportsElderlyOver65: e.target.checked,
                          })
                        }
                        className="rounded text-indigo-600"
                      />
                      <span>만 65세 이상 직계존속 부양</span>
                    </label>
                    {editingDraft.supportsElderlyOver65 && (
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="text-slate-600">계속 등재기간:</span>
                        <select
                          value={editingDraft.elderlySupportYears}
                          onChange={(e) =>
                            setEditingDraft({
                              ...editingDraft,
                              elderlySupportYears: Number(e.target.value),
                            })
                          }
                          className="border border-slate-300 rounded px-2 py-1 bg-white font-semibold"
                        >
                          <option value={1}>1년 (노부모특공 미달)</option>
                          <option value={2}>2년 (노부모특공 미달)</option>
                          <option value={3}>3년 이상 (충족)</option>
                          <option value={4}>4년 이상</option>
                          <option value={5}>5년 이상</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* 청약통장 가입기간 & 예치금 */}
                <div className="space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="font-bold text-slate-800 block">청약통장 가입기간 (개월)</label>
                  <input
                    type="number"
                    min={0}
                    max={360}
                    value={editingDraft.bankbookMonths}
                    onChange={(e) =>
                      setEditingDraft({
                        ...editingDraft,
                        bankbookMonths: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white font-mono"
                  />
                  <div className="text-[11px] text-slate-500 font-mono">
                    {Math.floor(editingDraft.bankbookMonths / 12)}년 {editingDraft.bankbookMonths % 12}개월
                  </div>

                  <label className="font-bold text-slate-800 block pt-1.5">예치금 (만원)</label>
                  <select
                    value={editingDraft.depositAmount}
                    onChange={(e) =>
                      setEditingDraft({
                        ...editingDraft,
                        depositAmount: Number(e.target.value),
                      })
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white font-semibold"
                  >
                    <option value={300}>300만원 (부산 85㎡ 이하)</option>
                    <option value={600}>600만원 (부산 102㎡ 이하)</option>
                    <option value={1000}>1,000만원 (부산 135㎡ 이하)</option>
                    <option value={1500}>1,500만원 (부산 모든 면적)</option>
                  </select>
                </div>

                {/* 생애최초 주택구입 및 세대주 여부 */}
                <div className="space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="font-bold text-slate-800 block">세대주 여부</label>
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={editingDraft.isHouseholder}
                      onChange={(e) =>
                        setEditingDraft({
                          ...editingDraft,
                          isHouseholder: e.target.checked,
                        })
                      }
                      className="rounded text-indigo-600"
                    />
                    <span>세대주 (노부모특공 등 필수요건)</span>
                  </label>

                  <label className="font-bold text-slate-800 block pt-2">생애최초 요건</label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-800">
                    <input
                      type="checkbox"
                      checked={editingDraft.isFirstLifeEver}
                      onChange={(e) =>
                        setEditingDraft({
                          ...editingDraft,
                          isFirstLifeEver: e.target.checked,
                        })
                      }
                      className="rounded text-indigo-600"
                    />
                    <span>세대원 전원 과거 주택 소유 이력 없음</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-800">
                    <input
                      type="checkbox"
                      checked={editingDraft.taxPaid5Years}
                      onChange={(e) =>
                        setEditingDraft({
                          ...editingDraft,
                          taxPaid5Years: e.target.checked,
                        })
                      }
                      className="rounded text-indigo-600"
                    />
                    <span>5년 이상 소득세 납부 실적 충족</span>
                  </label>
                </div>

                {/* 소득 및 자산 요건 */}
                <div className="space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <label className="font-bold text-slate-800 block">소득 분위</label>
                  <select
                    value={editingDraft.incomeTier}
                    onChange={(e) =>
                      setEditingDraft({
                        ...editingDraft,
                        incomeTier: e.target.value as any,
                      })
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white font-semibold"
                  >
                    <option value="under_100">100% 이하 (우선공급)</option>
                    <option value="under_140">140% 이하 (일반/신혼 맞벌이)</option>
                    <option value="under_160">160% 이하 (추첨군)</option>
                    <option value="under_200">200% 이하 (신생아 완화구간)</option>
                    <option value="over_limit">기준 초과</option>
                  </select>

                  <label className="flex items-center gap-2 pt-2 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={editingDraft.assetSatisfied}
                      onChange={(e) =>
                        setEditingDraft({
                          ...editingDraft,
                          assetSatisfied: e.target.checked,
                        })
                      }
                      className="rounded text-indigo-600"
                    />
                    <span>자산 요건 충족 (부동산 3.31억원 이하 등)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                이름은 실명 대신 별칭({editingProfileAlias})으로만 저장·비교됩니다.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProfileId(null);
                    setEditingDraft(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>변경사항 저장</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
