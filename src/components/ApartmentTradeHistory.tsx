import { useEffect, useState, type FormEvent } from 'react';
import { kstContractMonth, tradeHistoryComplexes, tradeHistoryFirstMonth, tradeHistoryOrigin, type TradeHistoryResponse } from '../housing/apartmentTradeHistory';

type Selection = { complex: string; family: string; start: string; end: string; page: number };
type Display = { selection: Selection; value: TradeHistoryResponse | null; error: string };
const first = tradeHistoryComplexes[0];
const inputStyle = 'min-w-0 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900';
const actionStyle = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-45';
const dateInput = (x: string) => x.slice(0, 4) + '-' + x.slice(4);
const won = new Intl.NumberFormat('ko-KR');
const prettyPrice = (amount: number) => {
  const eok = Math.floor(amount / 10_000);
  const manwon = amount % 10_000;
  return eok ? eok + '억' + (manwon ? ' ' + won.format(manwon) + '만' : '') + '원' : won.format(amount) + '만원';
};

export default function ApartmentTradeHistory({ initialComplex }: { initialComplex?: string | null }) {
  const initial = tradeHistoryComplexes.find(c => c.id === initialComplex) ?? first;
  const [complex, setComplex] = useState<string>(initial.id);
  const [family, setFamily] = useState<string>(initial.families[0].id);
  const [start, setStart] = useState(() => dateInput(kstContractMonth(-2)));
  const [end, setEnd] = useState(() => dateInput(kstContractMonth()));
  const [query, setQuery] = useState<Selection | null>(null);
  const [display, setDisplay] = useState<Display | null>(null);
  const scope = tradeHistoryComplexes.find(c => c.id === complex) ?? first;

  useEffect(() => {
    if (!query) return;
    const request = new AbortController();
    const params = new URLSearchParams({ ...query, page: String(query.page) });
    void (async () => {
      try {
        const response = await fetch('/api/housing/apartment-trade-history?' + params, { signal: request.signal });
        if (!response.ok) throw new Error(response.status === 400 ? 'invalid' : 'unavailable');
        const value: TradeHistoryResponse = await response.json();
        if (value.coverage !== 'saved_snapshot_only' || value.source !== 'K_HOUSING_SAVED_MOLIT' ||
           value.complex !== query.complex || value.family !== query.family || value.page !== query.page ||
           value.start !== query.start || value.end !== query.end || !Array.isArray(value.rows)) throw new Error('unavailable');
        if (!request.signal.aborted) setDisplay({ selection: query, value, error: '' });
      } catch (error) {
        if (!request.signal.aborted) setDisplay({ selection: query, value: null, error: error instanceof Error && error.message === 'invalid'
          ? '기간을 확인해 주세요. 조회 기간은 시작월부터 최대 12개월입니다.'
          : '저장된 실거래 이력을 확인하지 못했습니다. 잠시 후 다시 조회해 주세요.' });
      }
    })();
    return () => request.abort();
  }, [query]);

  const current = display?.selection === query ? display : null;
  const data = current?.value ?? null;
  const loading = query !== null && current === null;
  const choose = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuery({ complex, family, start: start.replace('-', ''), end: end.replace('-', ''), page: 1 });
  };
  const page = (next: number) => {
    if (query && data && next >= 1 && next <= data.totalPages) setQuery({ ...query, page: next });
  };
  const resultComplex = tradeHistoryComplexes.find(c => c.id === data?.complex);
  const resultFamily = resultComplex?.families.find(f => f.id === data?.family);
  const maxMonth = dateInput(kstContractMonth());
  return <section aria-labelledby="trade-history-title" className="max-w-4xl space-y-4">
    <div>
      <h1 id="trade-history-title" className="text-2xl font-bold">실거래 이력</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        4개 단지의 K-Housing 저장 실거래를 전용면적군별로 조회합니다. 국토교통부 매매 자료 기반이며 분양권·입주권은 포함하지 않습니다.
      </p>
    </div>
    <form onSubmit={choose} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
      <label className="col-span-2 space-y-1 text-sm font-semibold sm:col-span-1">
        <span>단지</span>
        <select className={inputStyle} value={complex} onChange={event => {
          const selected = tradeHistoryComplexes.find(c => c.id === event.target.value);
          if (selected) { setComplex(selected.id); setFamily(selected.families[0].id); }
        }}>
          {tradeHistoryComplexes.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      <label className="col-span-2 space-y-1 text-sm font-semibold sm:col-span-1">
        <span>전용면적군</span>
        <select className={inputStyle} value={family} onChange={event => setFamily(event.target.value)}>
          {scope.families.map(f => <option key={f.id} value={f.id}>{f.area}㎡형</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm font-semibold">
        <span>시작 계약월</span>
        <input type="month" className={inputStyle} required min={dateInput(tradeHistoryFirstMonth)} max={maxMonth} value={start} onChange={event => setStart(event.target.value)} />
      </label>
      <label className="space-y-1 text-sm font-semibold">
        <span>종료 계약월</span>
        <input type="month" className={inputStyle} required min={start || dateInput(tradeHistoryFirstMonth)} max={maxMonth} value={end} onChange={event => setEnd(event.target.value)} />
      </label>
      <div className="col-span-full flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600">한 번에 최대 12개월 · 최근 계약은 뒤늦게 신고되거나 해제될 수 있습니다.</p>
        <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">조회</button>
      </div>
    </form>
    <div aria-live="polite" aria-atomic="true" className="text-sm">
      {loading && <p role="status">저장 이력을 조회하고 있습니다.</p>}
      {current?.error && <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-900">{current.error}</p>}
      {data && <p role="status" className="text-slate-700">
        {resultComplex?.label} · {resultFamily?.area}㎡형 · {dateInput(data.start)}~{dateInput(data.end)} · 미해제 저장 {won.format(data.activeRows)}행
        {data.cancelledRows ? ' · 해제 ' + won.format(data.cancelledRows) + '행 별도 표시' : ''}
        {data.complex === 'mapo_raemian_prugio' ? ' · 차수 미제공' : ''}
      </p>}
    </div>
    {data && (data.rows.length ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-xs sm:text-sm" aria-label="계약일별 저장 실거래와 해제 여부">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
          <tr><th scope="col" className="px-2 py-2 sm:px-4">계약일</th><th scope="col" className="px-2 py-2 sm:px-4">전용면적</th>
            <th scope="col" className="px-2 py-2 sm:px-4">층</th><th scope="col" className="px-2 py-2 text-right sm:px-4">거래금액</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.rows.map((row, index) => <tr key={data.page + ':' + index + ':' + row.dealDate}>
            <td className="whitespace-nowrap px-2 py-2 sm:px-4">{row.dealDate}{row.cancelled && <span className="block font-semibold text-amber-800">해제</span>}</td>
            <td className="whitespace-nowrap px-2 py-2 sm:px-4">{row.exactArea}㎡</td>
            <td className="whitespace-nowrap px-2 py-2 sm:px-4">{row.floor < 0 ? '지하 ' + Math.abs(row.floor) : row.floor}</td>
            <td className={'whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums sm:px-4' + (row.cancelled ? ' text-slate-500 line-through' : '')}>{prettyPrice(row.amountManwon)}</td>
          </tr>)}
        </tbody>
      </table>
      {data.totalPages > 1 && <nav className="flex items-center justify-center gap-3 border-t border-slate-200 p-3" aria-label="실거래 이력 페이지">
        <button className={actionStyle} type="button" disabled={data.page <= 1} onClick={() => page(data.page - 1)}>이전</button>
        <span className="text-xs text-slate-600">{data.page} / {data.totalPages}</span>
        <button className={actionStyle} type="button" disabled={data.page >= data.totalPages} onClick={() => page(data.page + 1)}>다음</button>
      </nav>}
    </div> : <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
      선택한 기간·면적군의 저장본에 표시할 거래 행이 없습니다. 국토교통부 신고 건수가 0이라는 뜻은 아닙니다.
    </p>)}
    <p className="text-xs leading-relaxed text-slate-600">
      <a href={tradeHistoryOrigin} className="font-semibold text-blue-800 underline" target="_blank" rel="noreferrer">출처: K-Housing 저장본</a>.
      {' '}저장본의 조회 결과이며 전체 신고 이력이나 현재 시세를 보장하지 않습니다. 마포 1~4단지 및 슈르 법정동별 수록 범위는 원자료에서 확인되지 않았습니다.
      {' '}도곡한신·디에이치퍼스티어아이파크는 매매 원자료를 확인하기 전까지 표시하지 않습니다.
    </p>
  </section>;
}
