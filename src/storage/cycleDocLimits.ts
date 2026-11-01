import type { FirestoreCollectionCycleDoc } from '../schema/firestoreSchema';

/**
 * Firestore rejects documents larger than 1 MiB. A collection cycle stores per-item audits
 * and source details, which grow with the number of collected items. If the save failed,
 * the poll would end in a 500 after Telegram alerts had already been sent.
 *
 * Keeps the most useful audits (relevant / Telegram candidates first), trims long strings,
 * and records how much was dropped so the cycle stays explainable.
 */
export const CYCLE_DOC_BYTE_BUDGET = 700 * 1024;
const MAX_ITEM_AUDITS = 300;
const MAX_ERRORS = 50;
const MAX_STRING = 500;

const byteSize = (value: unknown) => Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');

function trimStrings<T>(value: T, limit = MAX_STRING): T {
  if (typeof value === 'string') return (value.length > limit ? value.slice(0, limit) + '…' : value) as T;
  if (Array.isArray(value)) return value.map(v => trimStrings(v, limit)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = trimStrings(v, limit);
    return out as T;
  }
  return value;
}

export function capCollectionCycleDoc<T extends FirestoreCollectionCycleDoc>(doc: T): T & { truncated?: Record<string, number> } {
  const truncated: Record<string, number> = {};
  const capped: any = { ...doc };

  if (Array.isArray(capped.errors) && capped.errors.length > MAX_ERRORS) {
    truncated.errors = capped.errors.length - MAX_ERRORS;
    capped.errors = capped.errors.slice(0, MAX_ERRORS);
  }
  if (Array.isArray(capped.itemAudits)) {
    const ranked = [...capped.itemAudits].sort((a: any, b: any) =>
      Number(Boolean(b?.telegramCandidate)) - Number(Boolean(a?.telegramCandidate)) ||
      Number(b?.geminiRelatednessResult === 'relevant') - Number(a?.geminiRelatednessResult === 'relevant') ||
      (b?.importance || 0) - (a?.importance || 0));
    if (ranked.length > MAX_ITEM_AUDITS) truncated.itemAudits = ranked.length - MAX_ITEM_AUDITS;
    capped.itemAudits = ranked.slice(0, MAX_ITEM_AUDITS);
  }

  let result = trimStrings(capped);
  // Last resort: halve the audit list until the document fits the budget.
  while (byteSize(result) > CYCLE_DOC_BYTE_BUDGET && Array.isArray(result.itemAudits) && result.itemAudits.length > 0) {
    const keep = Math.floor(result.itemAudits.length / 2);
    truncated.itemAudits = (truncated.itemAudits || 0) + (result.itemAudits.length - keep);
    result.itemAudits = result.itemAudits.slice(0, keep);
  }
  if (byteSize(result) > CYCLE_DOC_BYTE_BUDGET && result.sourceDetails) {
    truncated.sourceDetails = 1;
    delete result.sourceDetails;
  }
  if (Object.keys(truncated).length > 0) result.truncated = truncated;
  return result;
}
