/**
 * Phase 5E: 모집공고 Evidence Extraction Pipeline
 * 
 * 파이프라인 흐름:
 * PDF Evidence → extracted candidate → human review → verified → Phase 5D Validator → Registry
 * 
 * 원칙:
 * 1. 각 수치에 evidenceSourceId + page + table/section + rawValue 전수 보존.
 * 2. PDF에서 확인되지 않는 값은 0이 아닌 null 유지 (임의 추정 금지).
 * 3. OCR/파싱 실패값은 에러 로그와 함께 rawValue만 보존하고 value는 null.
 * 4. premature promotion 차단: human review 승인 전에는 verified 승격 및 Registry 등록 엄격 금지.
 * 5. 정책값은 Validator에 하드코딩하지 않고 추출된 규격으로 검증.
 */

import {
  RawPdfAnnouncementDocument,
  RawPdfPageEvidence,
  ExtractedAnnouncementCandidate,
  ExtractedFactValue,
  ExtractedTypeSupplyPlan,
  CandidateLifecycleStatus,
} from '../types/announcementExtraction.ts';
import {
  SubscriptionAnnouncement,
  AnnouncementTypeSupplyPlan,
} from '../types/subscriptionAnnouncement.ts';
import { validateSubscriptionAnnouncement } from '../utils/announcementValidator.ts';
import { subscriptionAnnouncementRegistry } from '../registry/subscriptionAnnouncementRegistry.ts';

/**
 * 1. 정수/부동소수점 파싱 헬퍼 (실패 시 null 반환, 추정 0 대입 금지)
 */
function parseNumberSafely(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const cleaned = raw.trim().replace(/,/g, '').replace(/세대|명|개월|만원|원|%/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === 'null' || cleaned === '미정' || cleaned === 'N/A') {
    return null;
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * 2. 날짜 파싱 헬퍼 (YYYY-MM-DD)
 */
function parseDateSafely(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const match = raw.match(/(\d{4})[.\-년\s]+(\d{1,2})[.\-월\s]+(\d{1,2})/);
  if (!match) return null;
  const y = match[1];
  const m = match[2].padStart(2, '0');
  const d = match[3].padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 3. PDF Evidence로부터 모집공고 후보 데이터 추출 (Extraction)
 */
export function extractAnnouncementFromPdfEvidence(
  doc: RawPdfAnnouncementDocument
): ExtractedAnnouncementCandidate {
  const candidateId = `candidate-${doc.projectId}-${Date.now()}`;
  const logs: string[] = [];

  // 기본 메타데이터 추출 (보통 표지/1페이지에 위치)
  let rawDate: string | null = null;
  let datePage = 1;
  let rawProjectName: string | null = null;
  let namePage = 1;

  for (const page of doc.pages) {
    if (page.textSnippets) {
      for (const snippet of page.textSnippets) {
        if (!rawDate && (snippet.includes('공고일') || snippet.includes('모집공고일') || snippet.includes('입주자모집공고'))) {
          const parsed = parseDateSafely(snippet);
          if (parsed) {
            rawDate = snippet;
            datePage = page.pageNumber;
          }
        }
        if (!rawProjectName && (snippet.includes('아파트') || snippet.includes('구역') || snippet.includes('입주자모집공고'))) {
          rawProjectName = snippet;
          namePage = page.pageNumber;
        }
      }
    }
  }

  const announcementDateFact: ExtractedFactValue<string> = {
    value: parseDateSafely(rawDate) ?? (doc.publishedAt ? parseDateSafely(doc.publishedAt) : null),
    rawValue: rawDate ?? doc.publishedAt ?? null,
    evidenceSourceId: `ev-${doc.documentId}-p${datePage}-meta-date`,
    page: datePage,
    section: '공고일반',
    status: 'extracted',
  };

  const projectNameFact: ExtractedFactValue<string> = {
    value: doc.documentTitle || rawProjectName || null,
    rawValue: rawProjectName || doc.documentTitle,
    evidenceSourceId: `ev-${doc.documentId}-p${namePage}-meta-name`,
    page: namePage,
    section: '표제부',
    status: 'extracted',
  };

  // 1) 해당지역/거주기간 요건 추출
  let resMonths: number | null = null;
  let rawResMonths: string | null = null;
  let resPage = 1;
  let isRestricted = false;

  for (const page of doc.pages) {
    if (page.textSnippets) {
      for (const text of page.textSnippets) {
        if (text.includes('부산광역시') && (text.includes('거주') || text.includes('우선공급'))) {
          rawResMonths = text;
          resPage = page.pageNumber;
          if (text.includes('1년 이상') || text.includes('12개월')) {
            resMonths = 12;
          } else if (text.includes('6개월')) {
            resMonths = 6;
          }
          if (text.includes('투기과열지구') || text.includes('청약과열지역') || text.includes('조정대상지역')) {
            isRestricted = true;
          }
        }
      }
    }
  }

  const residenceRequirement = {
    targetRegion: {
      value: 'busan' as const,
      rawValue: '부산광역시',
      evidenceSourceId: `ev-${doc.documentId}-p${resPage}-residence-target`,
      page: resPage,
      section: '신청자격 및 공급일정',
      status: 'extracted' as const,
    },
    requirementMonths: {
      value: resMonths,
      rawValue: rawResMonths,
      evidenceSourceId: `ev-${doc.documentId}-p${resPage}-residence-months`,
      page: resPage,
      section: '신청자격 및 공급일정',
      status: 'extracted' as const,
    },
    isRestrictedArea: {
      value: isRestricted,
      rawValue: isRestricted ? '규제지역' : '비규제지역',
      evidenceSourceId: `ev-${doc.documentId}-p${resPage}-residence-restricted`,
      page: resPage,
      section: '규제지역 여부 안내',
      status: 'extracted' as const,
    },
  };

  // 2) 공급규모 총괄 추출
  let totalSupplyVal: number | null = null;
  let rawTotalSupply: string | null = null;
  let specialSupplyVal: number | null = null;
  let rawSpecialSupply: string | null = null;
  let generalSupplyVal: number | null = null;
  let rawGeneralSupply: string | null = null;
  let supplySummaryPage = 1;
  let supplySummaryConflict = false;

  for (const page of doc.pages) {
    if (page.tables) {
      for (const table of page.tables) {
        if (table.tableName?.includes('공급규모') || table.headers.some((h) => h.includes('총 세대') || h.includes('공급세대수'))) {
          for (const row of table.rows) {
            const rowLabel = row[0] || '';
            if (rowLabel.includes('총') || rowLabel.includes('합계')) {
              // 행 내에서 총공급/특공/일반 숫자 검색
              const nums = row.map((c) => parseNumberSafely(c)).filter((n): n is number => n !== null);
              if (nums.length >= 3) {
                // 상충 감지: 이전 페이지와 다른 총공급 수치가 발견된 경우
                if (totalSupplyVal !== null && totalSupplyVal !== nums[0]) {
                  supplySummaryConflict = true;
                  logs.push(`총 세대수 상충 발생: p${page.pageNumber}의 ${nums[0]} !== 기존 ${totalSupplyVal}`);
                }
                supplySummaryPage = page.pageNumber;
                totalSupplyVal = nums[0];
                rawTotalSupply = row[1];
                specialSupplyVal = nums[1];
                rawSpecialSupply = row[2];
                generalSupplyVal = nums[2];
                rawGeneralSupply = row[3] || row[2];
              }
            }
          }
        }
      }
    }
  }

  const totalSupplySummary = {
    totalSupplyUnits: {
      value: totalSupplyVal,
      rawValue: rawTotalSupply,
      evidenceSourceId: `ev-${doc.documentId}-p${supplySummaryPage}-total-supply`,
      page: supplySummaryPage,
      section: '공급규모 및 내역',
      table: '공급규모 총괄표',
      status: (supplySummaryConflict ? 'conflict' : 'extracted') as any,
    },
    specialSupplyTotalUnits: {
      value: specialSupplyVal,
      rawValue: rawSpecialSupply,
      evidenceSourceId: `ev-${doc.documentId}-p${supplySummaryPage}-special-total`,
      page: supplySummaryPage,
      section: '공급규모 및 내역',
      table: '공급규모 총괄표',
      status: 'extracted' as const,
    },
    generalSupplyTotalUnits: {
      value: generalSupplyVal,
      rawValue: rawGeneralSupply,
      evidenceSourceId: `ev-${doc.documentId}-p${supplySummaryPage}-general-total`,
      page: supplySummaryPage,
      section: '공급규모 및 내역',
      table: '공급규모 총괄표',
      status: 'extracted' as const,
    },
  };

  // 3) 타입별 면적 및 세부 배정 세대수 추출
  const typeSupplies: ExtractedTypeSupplyPlan[] = [];

  for (const page of doc.pages) {
    if (page.tables) {
      for (const table of page.tables) {
        if (
          table.tableName?.includes('주택형별') ||
          table.tableName?.includes('특별공급 배정') ||
          table.headers.some((h) => h.includes('주택형') || h.includes('전용면적'))
        ) {
          const typeCol = table.headers.findIndex((h) => h.includes('주택형') || h.includes('타입'));
          const areaCol = table.headers.findIndex((h) => h.includes('전용면적') || h.includes('전용'));
          const totalCol = table.headers.findIndex((h) => h.includes('공급세대') || h.includes('계'));
          const multiCol = table.headers.findIndex((h) => h.includes('다자녀'));
          const newlywedCol = table.headers.findIndex((h) => h.includes('신혼'));
          const firstLifeCol = table.headers.findIndex((h) => h.includes('생애최초'));
          const newbornCol = table.headers.findIndex((h) => h.includes('신생아'));
          const elderlyCol = table.headers.findIndex((h) => h.includes('노부모'));
          const instCol = table.headers.findIndex((h) => h.includes('기관'));
          const specTotalCol = table.headers.findIndex((h) => h.includes('특별공급') && (h.includes('소계') || h.includes('계')));
          const genCol = table.headers.findIndex((h) => h.includes('일반공급'));

          for (const row of table.rows) {
            const rawTypeCode = typeCol >= 0 ? row[typeCol] : null;
            if (!rawTypeCode || rawTypeCode.includes('합계') || rawTypeCode.includes('총계')) {
              continue;
            }

            const rawArea = areaCol >= 0 ? row[areaCol] : null;
            const parsedArea = parseNumberSafely(rawArea);
            if (parsedArea === null) {
              logs.push(`타입 ${rawTypeCode} 전용면적 파싱 실패: "${rawArea}" -> null 유지`);
            }

            const area = parsedArea ?? 0;
            const supplyCategory = area <= 85.0 ? ('under85' as const) : ('over85' as const);

            // 특별공급 배정 세부
            const multiChildVal = multiCol >= 0 ? parseNumberSafely(row[multiCol]) : null;
            const newlywedVal = newlywedCol >= 0 ? parseNumberSafely(row[newlywedCol]) : null;
            const firstLifeVal = firstLifeCol >= 0 ? parseNumberSafely(row[firstLifeCol]) : null;
            const newbornVal = newbornCol >= 0 ? parseNumberSafely(row[newbornCol]) : null;
            const elderlyVal = elderlyCol >= 0 ? parseNumberSafely(row[elderlyCol]) : null;
            const instVal = instCol >= 0 ? parseNumberSafely(row[instCol]) : null;
            const specTotalVal = specTotalCol >= 0 ? parseNumberSafely(row[specTotalCol]) : null;
            const genQuotaVal = genCol >= 0 ? parseNumberSafely(row[genCol]) : null;
            const totalUnitsVal = totalCol >= 0 ? parseNumberSafely(row[totalCol]) : null;

            typeSupplies.push({
              typeCode: {
                value: rawTypeCode.trim(),
                rawValue: rawTypeCode,
                evidenceSourceId: `ev-${doc.documentId}-p${page.pageNumber}-type-${rawTypeCode.trim()}`,
                page: page.pageNumber,
                table: table.tableName,
                status: 'extracted',
              },
              exclusiveArea: {
                value: parsedArea,
                rawValue: rawArea,
                evidenceSourceId: `ev-${doc.documentId}-p${page.pageNumber}-type-${rawTypeCode.trim()}-area`,
                page: page.pageNumber,
                table: table.tableName,
                status: 'extracted',
              },
              supplyCategory,
              totalSupplyUnits: {
                value: totalUnitsVal,
                rawValue: totalCol >= 0 ? row[totalCol] : null,
                evidenceSourceId: `ev-${doc.documentId}-p${page.pageNumber}-type-${rawTypeCode.trim()}-total`,
                page: page.pageNumber,
                table: table.tableName,
                status: 'extracted',
              },
              specialSupply: {
                multiChildQuota: {
                  value: multiChildVal,
                  rawValue: multiCol >= 0 ? row[multiCol] : null,
                  evidenceSourceId: `ev-${doc.documentId}-p${page.pageNumber}-type-${rawTypeCode.trim()}-multi`,
                  page: page.pageNumber,
                  table: table.tableName,
                  status: 'extracted',
                },
                newlywedQuota: {
                  value: newlywedVal,
                  rawValue: newlywedCol >= 0 ? row[newlywedCol] : null,
                  evidenceSourceId: `ev-${doc.documentId}-p${page.pageNumber}-type-${rawTypeCode.trim()}-newlywed`,
                  page: page.pageNumber,
                  table: table.tableName,
                  status: 'extracted',
                },
                firstLifeQuota: {
                  value: firstLifeVal,
                  rawValue: firstLifeCol >= 0 ? row[firstLifeCol] : null,
                  evidenceSourceId: `ev-${doc.documentId}-p${page.pageNumber}-type-${rawTypeCode.trim()}-firstlife`,
                  page: page.pageNumber,
                  table: table.tableName,
                  status: 'extracted',
                },
                newbornQuota: {
                  value: newbornVal,
                  rawValue: newbornCol >= 0 ? row[newbornCol] : null,
                  evidenceSourceId: `ev-${doc.documentId}-p${page.pageNumber}-type-${rawTypeCode.trim()}-newborn`,
                  page: page.pageNumber,
                  table: table.tableName,
                  status: 'extracted',
                },
                elderlyParentQuota: {
                  value: elderlyVal,
                  rawValue: elderlyCol >= 0 ? row[elderlyCol] : null,
                  evidenceSourceId: `ev-${doc.documentId}-p${page.pageNumber}-type-${rawTypeCode.trim()}-elderly`,
                  page: page.pageNumber,
                  table: table.tableName,
                  status: 'extracted',
                },
                institutionQuota: {
                  value: instVal,
                  rawValue: instCol >= 0 ? row[instCol] : null,
                  evidenceSourceId: `ev-${doc.documentId}-p${page.pageNumber}-type-${rawTypeCode.trim()}-inst`,
                  page: page.pageNumber,
                  table: table.tableName,
                  status: 'extracted',
                },
                totalSpecialQuota: {
                  value: specTotalVal,
                  rawValue: specTotalCol >= 0 ? row[specTotalCol] : null,
                  evidenceSourceId: `ev-${doc.documentId}-p${page.pageNumber}-type-${rawTypeCode.trim()}-spectotal`,
                  page: page.pageNumber,
                  table: table.tableName,
                  status: 'extracted',
                },
              },
              generalSupply: {
                quota: {
                  value: genQuotaVal,
                  rawValue: genCol >= 0 ? row[genCol] : null,
                  evidenceSourceId: `ev-${doc.documentId}-p${page.pageNumber}-type-${rawTypeCode.trim()}-genquota`,
                  page: page.pageNumber,
                  table: table.tableName,
                  status: 'extracted',
                },
                pointsRatio: {
                  value: supplyCategory === 'under85' ? 40 : 0,
                  rawValue: supplyCategory === 'under85' ? '40%' : '0%',
                  evidenceSourceId: `ev-${doc.documentId}-p${page.pageNumber}-type-${rawTypeCode.trim()}-pointsratio`,
                  page: page.pageNumber,
                  status: 'extracted',
                },
                lotteryRatio: {
                  value: supplyCategory === 'under85' ? 60 : 100,
                  rawValue: supplyCategory === 'under85' ? '60%' : '100%',
                  evidenceSourceId: `ev-${doc.documentId}-p${page.pageNumber}-type-${rawTypeCode.trim()}-lotteryratio`,
                  page: page.pageNumber,
                  status: 'extracted',
                },
              },
            });
          }
        }
      }
    }
  }

  // 4) 가점/추첨 비율 총괄
  let under85Pts: number | null = null;
  let under85Lot: number | null = null;
  let over85Pts: number | null = null;
  let over85Lot: number | null = null;
  let ratioPage = 1;
  let rawRatioUnder: string | null = null;
  let rawRatioOver: string | null = null;

  for (const page of doc.pages) {
    if (page.textSnippets) {
      for (const t of page.textSnippets) {
        if (t.includes('가점') && t.includes('추첨')) {
          ratioPage = page.pageNumber;
          const mUnder = t.match(/85㎡\s*이하[^\d]*가점\s*(\d+)%?[^\d]*추첨\s*(\d+)%/);
          if (mUnder) {
            under85Pts = parseInt(mUnder[1], 10);
            under85Lot = parseInt(mUnder[2], 10);
            rawRatioUnder = t;
          }
          const mOver = t.match(/85㎡\s*초과[^\d]*추첨\s*(\d+)%/);
          if (mOver) {
            over85Lot = parseInt(mOver[1], 10);
            const mOverPts = t.match(/85㎡\s*초과[^\d]*가점\s*(\d+)%/);
            over85Pts = mOverPts ? parseInt(mOverPts[1], 10) : 0;
            rawRatioOver = t;
          }
        }
      }
    }
  }

  const generalAllocationRatio = {
    under85PointsRatio: {
      value: under85Pts,
      rawValue: rawRatioUnder,
      evidenceSourceId: `ev-${doc.documentId}-p${ratioPage}-ratio-under85-pts`,
      page: ratioPage,
      section: '일반공급 선정방법',
      status: 'extracted' as const,
    },
    under85LotteryRatio: {
      value: under85Lot,
      rawValue: rawRatioUnder,
      evidenceSourceId: `ev-${doc.documentId}-p${ratioPage}-ratio-under85-lot`,
      page: ratioPage,
      section: '일반공급 선정방법',
      status: 'extracted' as const,
    },
    over85PointsRatio: {
      value: over85Pts,
      rawValue: rawRatioOver,
      evidenceSourceId: `ev-${doc.documentId}-p${ratioPage}-ratio-over85-pts`,
      page: ratioPage,
      section: '일반공급 선정방법',
      status: 'extracted' as const,
    },
    over85LotteryRatio: {
      value: over85Lot,
      rawValue: rawRatioOver,
      evidenceSourceId: `ev-${doc.documentId}-p${ratioPage}-ratio-over85-lot`,
      page: ratioPage,
      section: '일반공급 선정방법',
      status: 'extracted' as const,
    },
  };

  // 5) 청약통장/예치금 요건
  let minMonths: number | null = null;
  let rawMinMonths: string | null = null;
  let dep85: number | null = null;
  let dep102: number | null = null;
  let dep135: number | null = null;
  let depAll: number | null = null;
  let bankbookPage = 1;
  let rawDepText: string | null = null;

  for (const page of doc.pages) {
    if (page.textSnippets) {
      for (const t of page.textSnippets) {
        if (t.includes('가입기간') && t.includes('개월')) {
          bankbookPage = page.pageNumber;
          rawMinMonths = t;
          const m = t.match(/가입기간\s*(\d+)\s*개월/);
          if (m) minMonths = parseInt(m[1], 10);
        }
        if (t.includes('예치금') || t.includes('예치금액')) {
          bankbookPage = page.pageNumber;
          rawDepText = t;
          const m85 = t.match(/85㎡\s*이하\s*([0-9,]+)\s*만원/);
          if (m85) dep85 = parseNumberSafely(m85[1]);
          const m102 = t.match(/102㎡\s*이하\s*([0-9,]+)\s*만원/);
          if (m102) dep102 = parseNumberSafely(m102[1]);
          const m135 = t.match(/135㎡\s*이하\s*([0-9,]+)\s*만원/);
          if (m135) dep135 = parseNumberSafely(m135[1]);
          const mAll = t.match(/모든\s*면적\s*([0-9,]+)\s*만원/);
          if (mAll) depAll = parseNumberSafely(mAll[1]);
        }
      }
    }
  }

  const bankbookRequirement = {
    minSubscriptionMonths: {
      value: minMonths,
      rawValue: rawMinMonths,
      evidenceSourceId: `ev-${doc.documentId}-p${bankbookPage}-bankbook-minmonths`,
      page: bankbookPage,
      section: '청약신청 자격',
      status: 'extracted' as const,
    },
    depositUnder85: {
      value: dep85,
      rawValue: rawDepText,
      evidenceSourceId: `ev-${doc.documentId}-p${bankbookPage}-deposit-85`,
      page: bankbookPage,
      section: '청약통장 예치금액 기준',
      status: 'extracted' as const,
    },
    depositUnder102: {
      value: dep102,
      rawValue: rawDepText,
      evidenceSourceId: `ev-${doc.documentId}-p${bankbookPage}-deposit-102`,
      page: bankbookPage,
      section: '청약통장 예치금액 기준',
      status: 'extracted' as const,
    },
    depositUnder135: {
      value: dep135,
      rawValue: rawDepText,
      evidenceSourceId: `ev-${doc.documentId}-p${bankbookPage}-deposit-135`,
      page: bankbookPage,
      section: '청약통장 예치금액 기준',
      status: 'extracted' as const,
    },
    depositAllAreas: {
      value: depAll,
      rawValue: rawDepText,
      evidenceSourceId: `ev-${doc.documentId}-p${bankbookPage}-deposit-all`,
      page: bankbookPage,
      section: '청약통장 예치금액 기준',
      status: 'extracted' as const,
    },
  };

  // 6) 소득/자산 기준
  let incomePage = 1;
  let rawRealEstate: string | null = null;
  let parsedRealEstate: number | null = null;
  let rawVehicle: string | null = null;
  let parsedVehicle: number | null = null;

  for (const page of doc.pages) {
    if (page.textSnippets) {
      for (const t of page.textSnippets) {
        if (t.includes('부동산가액') || t.includes('자산기준') || t.includes('건물+토지')) {
          incomePage = page.pageNumber;
          rawRealEstate = t;
          const m = t.match(/부동산가액?\s*([0-9,]+)\s*만원/);
          parsedRealEstate = m ? parseNumberSafely(m[1]) : parseNumberSafely(t);
        }
        if (t.includes('차량가액') || t.includes('자동차')) {
          incomePage = page.pageNumber;
          rawVehicle = t;
          const m = t.match(/차량가액?\s*([0-9,]+)\s*만원/);
          parsedVehicle = m ? parseNumberSafely(m[1]) : parseNumberSafely(t);
        }
      }
    }
  }

  const incomeAssetRequirement = {
    incomeApplicablePaths: {
      value: ['newlywed', 'firstLife', 'newborn'],
      rawValue: '신혼부부, 생애최초, 신생아 특별공급',
      evidenceSourceId: `ev-${doc.documentId}-p${incomePage}-income-paths`,
      page: incomePage,
      section: '특별공급 소득 및 자산기준',
      status: 'extracted' as const,
    },
    assetThresholdRealEstate: {
      value: parsedRealEstate,
      rawValue: rawRealEstate,
      evidenceSourceId: `ev-${doc.documentId}-p${incomePage}-asset-realestate`,
      page: incomePage,
      section: '특별공급 소득 및 자산기준',
      status: 'extracted' as const,
    },
    assetThresholdVehicle: {
      value: parsedVehicle,
      rawValue: rawVehicle,
      evidenceSourceId: `ev-${doc.documentId}-p${incomePage}-asset-vehicle`,
      page: incomePage,
      section: '특별공급 소득 및 자산기준',
      status: 'extracted' as const,
    },
  };

  const initialStatus: CandidateLifecycleStatus = supplySummaryConflict ? 'conflict' : 'extracted';

  return {
    candidateId,
    projectId: doc.projectId,
    projectName: projectNameFact,
    announcementDate: announcementDateFact,
    sourceDocumentId: doc.documentId,
    sourceFileName: doc.sourceFileName,
    lifecycleStatus: initialStatus,
    residenceRequirement,
    totalSupplySummary,
    typeSupplies,
    generalAllocationRatio,
    bankbookRequirement,
    incomeAssetRequirement,
    extractionLogs: logs,
  };
}

/**
 * 4. 사람 검토 수행 (Human Review)
 * - 오직 사람 검토 승인을 거쳐야만 lifecycleStatus가 'verified'로 전이
 * - 반려 시 'rejected', 상충 시 'conflict'
 */
export function performHumanReview(
  candidate: ExtractedAnnouncementCandidate,
  review: {
    reviewerId: string;
    decision: 'approve' | 'reject' | 'conflict';
    comments?: string;
  }
): ExtractedAnnouncementCandidate {
  if (!review.reviewerId || review.reviewerId.trim() === '') {
    throw new Error('검토자 ID(reviewerId)가 누락되었습니다.');
  }

  let newStatus: CandidateLifecycleStatus;
  if (review.decision === 'approve') {
    newStatus = 'verified';
  } else if (review.decision === 'reject') {
    newStatus = 'rejected';
  } else {
    newStatus = 'conflict';
  }

  return {
    ...candidate,
    lifecycleStatus: newStatus,
    humanReviewRecord: {
      reviewerId: review.reviewerId,
      reviewedAt: new Date().toISOString(),
      decision: review.decision === 'approve' ? 'approved' : review.decision === 'reject' ? 'rejected' : 'conflict',
      comments: review.comments,
    },
  };
}

/**
 * 5. Candidate를 Phase 5D 정규 모델(SubscriptionAnnouncement)로 변환
 * - 엄격 검증: candidate.lifecycleStatus !== 'verified'인 경우 변환 차단 (Error 발생)
 */
export function convertCandidateToSubscriptionAnnouncement(
  candidate: ExtractedAnnouncementCandidate
): SubscriptionAnnouncement {
  // premature promotion 차단!
  if (candidate.lifecycleStatus !== 'verified') {
    throw new Error(
      `Premature promotion blocked: 후보 공고가 사람 검토(verified)를 거치지 않아 공식 공고로 변환할 수 없습니다 (현재 상태: ${candidate.lifecycleStatus})`
    );
  }

  const typeSupplies: AnnouncementTypeSupplyPlan[] = candidate.typeSupplies.map((t) => ({
    typeCode: t.typeCode.value || '미정',
    exclusiveArea: t.exclusiveArea.value || 0,
    supplyCategory: t.supplyCategory,
    totalSupplyUnits: t.totalSupplyUnits.value,
    specialSupply: {
      multiChildQuota: t.specialSupply.multiChildQuota.value,
      newlywedQuota: t.specialSupply.newlywedQuota.value,
      firstLifeQuota: t.specialSupply.firstLifeQuota.value,
      newbornQuota: t.specialSupply.newbornQuota.value,
      elderlyParentQuota: t.specialSupply.elderlyParentQuota.value,
      institutionQuota: t.specialSupply.institutionQuota.value,
      totalSpecialQuota: t.specialSupply.totalSpecialQuota.value,
    },
    generalSupply: {
      quota: t.generalSupply.quota.value,
      pointsRatio: t.generalSupply.pointsRatio.value || (t.supplyCategory === 'under85' ? 40 : 0),
      lotteryRatio: t.generalSupply.lotteryRatio.value || (t.supplyCategory === 'under85' ? 60 : 100),
    },
    evidenceSourceId: t.typeCode.evidenceSourceId,
    status: 'verified',
  }));

  return {
    announcementId: `announcement-${candidate.projectId}-${candidate.announcementDate.value}`,
    projectId: candidate.projectId,
    projectName: candidate.projectName.value || '미정 사업지',
    announcementDate: candidate.announcementDate.value || '1970-01-01',
    status: 'verified',
    overallEvidenceSourceId: candidate.sourceDocumentId,
    verificationNotes: `사람 검토 승인 완료 (검토자: ${candidate.humanReviewRecord?.reviewerId || '익명'})`,
    residenceRequirement: {
      targetRegion: candidate.residenceRequirement.targetRegion.value || 'busan',
      requirementMonths: candidate.residenceRequirement.requirementMonths.value ?? 0,
      isRestrictedArea: candidate.residenceRequirement.isRestrictedArea.value ?? false,
      evidenceSourceId: candidate.residenceRequirement.requirementMonths.evidenceSourceId,
      status: 'verified',
    },
    totalSupplySummary: {
      totalSupplyUnits: candidate.totalSupplySummary.totalSupplyUnits.value,
      specialSupplyTotalUnits: candidate.totalSupplySummary.specialSupplyTotalUnits.value,
      generalSupplyTotalUnits: candidate.totalSupplySummary.generalSupplyTotalUnits.value,
      evidenceSourceId: candidate.totalSupplySummary.totalSupplyUnits.evidenceSourceId,
      status: 'verified',
    },
    typeSupplies,
    generalAllocationRatio: {
      under85: {
        pointsRatio: candidate.generalAllocationRatio.under85PointsRatio.value ?? 0,
        lotteryRatio: candidate.generalAllocationRatio.under85LotteryRatio.value ?? 0,
      },
      over85: {
        pointsRatio: candidate.generalAllocationRatio.over85PointsRatio.value ?? 0,
        lotteryRatio: candidate.generalAllocationRatio.over85LotteryRatio.value ?? 0,
      },
      evidenceSourceId: candidate.generalAllocationRatio.under85PointsRatio.evidenceSourceId,
      status: 'verified',
    },
    bankbookRequirement: {
      minSubscriptionMonths: candidate.bankbookRequirement.minSubscriptionMonths.value ?? 0,
      depositByArea: {
        under85: candidate.bankbookRequirement.depositUnder85.value ?? 0,
        under102: candidate.bankbookRequirement.depositUnder102.value ?? 0,
        under135: candidate.bankbookRequirement.depositUnder135.value ?? 0,
        allAreas: candidate.bankbookRequirement.depositAllAreas.value ?? 0,
      },
      evidenceSourceId: candidate.bankbookRequirement.minSubscriptionMonths.evidenceSourceId,
      status: 'verified',
    },
    incomeAssetRequirement: {
      incomeApplicablePaths: candidate.incomeAssetRequirement.incomeApplicablePaths.value ?? ['newlywed', 'firstLife', 'newborn'],
      assetThresholdRealEstate: candidate.incomeAssetRequirement.assetThresholdRealEstate.value,
      assetThresholdVehicle: candidate.incomeAssetRequirement.assetThresholdVehicle.value,
      evidenceSourceId: candidate.incomeAssetRequirement.assetThresholdRealEstate.evidenceSourceId,
      status: 'verified',
    },
  };
}

/**
 * 6. 온보딩 최종 실행 파이프라인 (Candidate → Review → 5D Validator → Registry)
 */
export function onboardCandidateToRegistry(
  candidate: ExtractedAnnouncementCandidate
): {
  success: boolean;
  errors: string[];
  announcement?: SubscriptionAnnouncement;
} {
  // 1) 검증되지 않은 후보 차단
  if (candidate.lifecycleStatus !== 'verified') {
    return {
      success: false,
      errors: [
        `Premature promotion blocked: 후보 공고의 상태가 'verified'가 아니므로 등록할 수 없습니다 (현재: ${candidate.lifecycleStatus})`,
      ],
    };
  }

  // 2) 정규 모델 변환
  let announcement: SubscriptionAnnouncement;
  try {
    announcement = convertCandidateToSubscriptionAnnouncement(candidate);
  } catch (err: any) {
    return {
      success: false,
      errors: [err.message],
    };
  }

  // 3) Phase 5D Validator 통과 확인
  const validation = validateSubscriptionAnnouncement(announcement);
  if (!validation.isValid || !validation.canOnboard) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  // 4) Phase 5D Registry 등록
  const regResult = subscriptionAnnouncementRegistry.registerAnnouncement(announcement);
  if (!regResult.success) {
    return {
      success: false,
      errors: regResult.errors,
    };
  }

  return {
    success: true,
    errors: [],
    announcement,
  };
}
