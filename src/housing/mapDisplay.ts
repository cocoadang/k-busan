import type { PriceSummary } from './busanPriceApi';
export function mapPriceLabel(s?: PriceSummary): string {
  if (!s) return '조회 중';
  if (!s.hasTargetArea) return '미공급';
  if (!s.hasData || s.price === null) return '거래 자료 없음';
  return `${(s.price / 10000).toFixed(1)}억`;
}
