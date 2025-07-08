/* ---------------------------------------------------------------
   InvestorsPage – AG-Grid everywhere, cleaner layout
---------------------------------------------------------------- */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import InvestorPortfolioCard from './InvestorPortfolioCard';
import type { Investor } from './InvestorPortfolioTable';

import HoldingsTable        from './HoldingsTable';
import LatestHoldingsTable  from './LatestHoldingsTable';
import DividendHistoryTable from './DividendHistoryTable';
import type { Holding }        from './HoldingsTable';
import type { LatestHolding }  from './LatestHoldingsTable';
import type { DividendRow }    from './DividendHistoryTable';

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import ReportGeneratorDialog from '@/components/pdfGenerator/ReportGeneratorDialog';
import type { TableRowData } from '@/components/pdfGenerator/InvestmentTable';

/* ---- helpers -------------------------------------------------- */
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5103';

/* ---- types ---------------------------------------------------- */
type Fund = { fund_id: number; fund_name: string };

/* -------------------------------------------------------------- */
export default function InvestorsPage() {
  /* ① fund list + current filter ---------- */
  const [funds, setFunds] = useState<Fund[]>([]);
  const [selectedFund, setSelectedFund] = useState<number | null>(null);

  /* ② portfolio table state --------------- */
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Investor[]>([]);
  const [pageCount, setPageCount] = useState(1);
  const [selected, setSelected] = useState<Investor | null>(null);

  /* ③ drawer-side data -------------------- */
  const [holdings, setHoldings]        = useState<Holding[]>([]);
  const [loadingHoldings, setLoadHold] = useState(false);

  const [latestHoldings, setLatest]       = useState<LatestHolding[]>([]);
  const [loadingLatest, setLoadLatest]    = useState(false);

  const [divRows, setDivRows]          = useState<DividendRow[]>([]);
  const [loadingDivs, setLoadDivs]     = useState(false);

  /* ----------------------------------------------------------------
     keep selected row in sync
  ------------------------------------------------------------------ */
  const handleRowSelect = useCallback((r: Investor) => setSelected(r), []);

  /* 1. fetch funds once ----------------------------------------- */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/funds`, { credentials: 'include' });
        const j = (await r.json()) as Fund[];
        setFunds(j);
        if (j.length && selectedFund == null) setSelectedFund(j[0].fund_id);
      } catch (e) { console.error('fund list fetch:', e); }
    })();
  }, []);

  /* 2. portfolio rows ------------------------------------------- */
  useEffect(() => {
    if (selectedFund == null) return;
    (async () => {
      try {
        const url = `${API_BASE}/investors/portfolio?fund_id=${selectedFund}&page=${page}`;
        const r   = await fetch(url, { credentials: 'include' });
        const j   = (await r.json()) as { page: number; pageCount: number; rows: Investor[] };
        setRows(j.rows);
        setPageCount(j.pageCount);
      } catch (e) { console.error('portfolio fetch:', e); }
    })();
  }, [selectedFund, page]);

  /* 3a. holdings ----------------------------------------------- */
  useEffect(() => {
    if (!selected || selectedFund == null) { setHoldings([]); return; }
    (async () => {
      try {
        setLoadHold(true);
        const url = `${API_BASE}/investors/holdings?fund_id=${selectedFund}` +
                    `&investor=${encodeURIComponent(selected.investor ?? '')}`;
        const r   = await fetch(url, { credentials: 'include' });
        const j   = (await r.json()) as { rows?: Holding[] };
        setHoldings(Array.isArray(j.rows) ? j.rows : []);
      } catch (e) { console.error('holdings fetch:', e); }
      finally     { setLoadHold(false); }
    })();
  }, [selectedFund, selected]);

  /* 3b. latest holdings across all funds ----------------------- */
  useEffect(() => {
    if (!selected) { setLatest([]); return; }
    (async () => {
      try {
        setLoadLatest(true);
        const url = `${API_BASE}/investors/holdings/all-funds?investor=${encodeURIComponent(selected.investor ?? '')}`;
        const r   = await fetch(url, { credentials: 'include' });
        const j   = (await r.json()) as { rows?: LatestHolding[] };
        setLatest(Array.isArray(j.rows) ? j.rows : []);
      } catch (e) { console.error('latest-holdings fetch:', e); }
      finally     { setLoadLatest(false); }
    })();
  }, [selected]);

  /* 3c. dividend history --------------------------------------- */
  useEffect(() => {
    if (!selected) { setDivRows([]); return; }
    (async () => {
      try {
        setLoadDivs(true);
        const url = `${API_BASE}/investors/holdings/dividends?investor=${encodeURIComponent(selected.investor ?? '')}`;
        const r   = await fetch(url, { credentials: 'include' });
        const j   = (await r.json()) as { rows?: DividendRow[] };
        setDivRows(Array.isArray(j.rows) ? j.rows : []);
      } catch (e) { console.error('dividends fetch:', e); }
      finally     { setLoadDivs(false); }
    })();
  }, [selected]);

  /* --- fund switch helper ------------------------------------ */
  const changeFund = (v: string) => {
    setSelectedFund(+v);
    setPage(1);
    setSelected(null);
  };

  /* --- table rows for PDF ------------------------------------ */
  const tableRowsForPdf: TableRowData[] = holdings.map(h => ({
    productName        : h.name,
    subscriptionTime   : h.sub_date,
    dataDeadline       : h.data_cutoff,
    subscriptionAmount : h.subscribed,
    marketValue        : h.market_value,
    totalAfterDeduction: h.total_after_int?.toString() ?? 'N/A',
    estimatedProfit    : h.pnl_pct,
  }));

  /* ----------------------------------------------------------- */
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Investors</h1>

      {/* FUND PICKER */}
      <Select
        value={selectedFund ? String(selectedFund) : ''}
        onValueChange={changeFund}
      >
        <SelectTrigger className="w-96">
          <SelectValue placeholder="Choose a fund" />
        </SelectTrigger>
        <SelectContent>
          {funds.map(f => (
            <SelectItem key={f.fund_id} value={String(f.fund_id)}>
              {f.fund_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* MAIN LAYOUT */}
      {selected ? (
        <ResizablePanelGroup
          direction="horizontal"
          className="flex-1 min-w-0 h-[calc(100vh-10rem)]"
        >
          {/* left – portfolio overview */}
          <ResizablePanel
            defaultSize={70}
            minSize={20}
            maxSize={80}
            className="pr-2 overflow-auto"
          >
            <InvestorPortfolioCard
              rows={rows}
              loading={rows.length === 0 && page === 1}
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              onSelectRow={handleRowSelect}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* right – drawer */}
          <ResizablePanel
            defaultSize={30}
            minSize={20}
            maxSize={80}
            className="flex flex-col overflow-auto p-6 bg-background shadow-lg relative"
          >
            <button
              aria-label="Close"
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 rounded-md p-1 hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold mb-4">{selected.investor}</h2>

            {/* everything below keeps a 15-px rhythm */}
            <div className="space-y-[15px]">

              {/* ❶ Holdings */}
              <HoldingsTable rows={holdings} loading={loadingHoldings} />

              {/* download button */}
              <div className="flex justify-center">
                <ReportGeneratorDialog
                  defaultInvestor={selected.investor ?? ''}
                  defaultTableData={tableRowsForPdf}
                />
              </div>

              {/* ❷ Latest holdings across all funds */}
              <LatestHoldingsTable
                rows={latestHoldings}
                loading={loadingLatest}
              />

              {/* ❸ Dividend history */}
              <DividendHistoryTable rows={divRows} loading={loadingDivs} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <InvestorPortfolioCard
          rows={rows}
          loading={rows.length === 0 && page === 1}
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          onSelectRow={handleRowSelect}
        />
      )}
    </div>
  );
}
