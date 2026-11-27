// A reviewed allowlist, not a general-purpose K-Housing proxy.
export const tradeHistoryComplexes = [
  { id: 'gwacheon_raemian_sur', district: '41290', label: '과천 래미안슈르', families: [
    { id: 'raemian_sur_59', area: 59 }, { id: 'raemian_sur_84', area: 84 }, { id: 'raemian_sur_116', area: 116 }, { id: 'raemian_sur_137', area: 137 },
  ] },
  { id: 'gangdong_gracium', district: '11740', label: '고덕그라시움', families: [
    { id: 'gracium_59', area: 59 }, { id: 'gracium_73', area: 73 }, { id: 'gracium_84', area: 84 }, { id: 'gracium_97', area: 97 },
    { id: 'gracium_113', area: 113 }, { id: 'gracium_127', area: 127 }, { id: 'gracium_133', area: 133 }, { id: 'gracium_175', area: 175 },
  ] },
  { id: 'mapo_raemian_prugio', district: '11440', label: '마포래미안푸르지오', families: [
    { id: 'mapo_rp_59', area: 59 }, { id: 'mapo_rp_84', area: 84 }, { id: 'mapo_rp_114', area: 114 }, { id: 'mapo_rp_145', area: 145 },
  ] },
  { id: 'yongsan_ichon_hangaram', district: '11170', label: '이촌한가람', families: [
    { id: 'hangaram_59', area: 59 }, { id: 'hangaram_77', area: 77 }, { id: 'hangaram_84', area: 84 }, { id: 'hangaram_114', area: 114 },
  ] },
] as const;

export const tradeHistoryOrigin = 'https://k-housing-5he2zcaska-du.a.run.app';
export const tradeHistoryFirstMonth = '200601';
export const tradeHistoryMaxMonths = 12;

export function kstContractMonth(offset = 0, now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() + offset, 1));
  return String(d.getUTCFullYear()) + String(d.getUTCMonth() + 1).padStart(2, '0');
}

export type TradeHistoryRow = { dealDate: string; exactArea: number; amountManwon: number; floor: number; cancelled: boolean };
export type TradeHistoryResponse = {
  source: 'K_HOUSING_SAVED_MOLIT';
  revision?: string;
  coverage: 'saved_snapshot_only';
  checkedAt: string;
  complex: string;
  family: string;
  start: string;
  end: string;
  page: number;
  totalPages: number;
  storedRows: number;
  activeRows: number;
  cancelledRows: number;
  rows: TradeHistoryRow[];
};

const evidenceHistorySlugs: Readonly<Record<string, string>> = Object.freeze({
  '과천 래미안슈르': 'gwacheon_raemian_sur', '래미안슈르': 'gwacheon_raemian_sur',
  '고덕그라시움': 'gangdong_gracium', '마포래미안푸르지오': 'mapo_raemian_prugio', '이촌한가람': 'yongsan_ichon_hangaram',
});
export function tradeHistoryLink(apartmentName: string) {
  if (!Object.hasOwn(evidenceHistorySlugs, apartmentName)) return null;
  return '?view=trade-history&complex=' + encodeURIComponent(evidenceHistorySlugs[apartmentName]);
}
