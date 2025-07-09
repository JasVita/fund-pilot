/* ------------------------------------------------------------------
   InvestorPortfolioTable – AG Grid v32  ✦  Pagination + Quick Filter
------------------------------------------------------------------ */
'use client';

import { useMemo, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  CellClassParams,
  ValueFormatterParams,
  ICellRendererParams,
  RowClickedEvent,
  GridReadyEvent,
  GridApi,
} from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

/* ---------- row model ---------------------------- */
export type Investor = {
  investor: string | null;
  class: string | null;
  number_held: string | null;
  current_nav: number;
  unpaid_redeem: number | null;
  status: 'active' | 'inactive' | null;
};

/* ---------- props -------------------------------- */
type Props = {
  rows: Investor[];
  loading: boolean;
  page: number;          // 1-based
  pageCount: number;
  quickFilter: string;          // 🔍 text typed by the user
  onPageChange: (n: number) => void;
  onSelectRow: (r: Investor) => void;
};

const PAGE_SIZE = 20;

/* ---------------------------------------------------------------- */
export default function InvestorPortfolioTable({
  rows,
  loading,
  page,
  quickFilter,
  onPageChange,
  onSelectRow,
}: Props) {
  const gridApiRef = useRef<GridApi<Investor> | null>(null);

  /* ----- helper : set quick-filter for v32 & earlier ------------- */
  const applyQuickFilter = (api: GridApi | null, text: string) => {
    if (!api) return;
    // v32+
    (api as any).setGridOption?.('quickFilterText', text);
    // v31 and older (optional-chain avoids crash if method missing)
    (api as any).setQuickFilter?.(text);
  };

  /* ----- column definitions ------------------------------------- */
  const columnDefs: ColDef<Investor>[] = useMemo(
    () => [
      {
        headerName: 'Investor',
        field: 'investor',
        flex: 2,
        valueGetter: p => p.data?.investor ?? '—',
        cellClass: (p: CellClassParams<Investor>) =>
          p.value === '—' ? 'ag-text-muted' : 'font-medium',
      },
      { headerName: 'Class', field: 'class', flex: 1, valueGetter: p => p.data?.class ?? '—' },
      { headerName: 'Number Held', field: 'number_held', flex: 1, valueGetter: p => p.data?.number_held ?? '—' },
      {
        headerName: 'Current NAV',
        field: 'current_nav',
        flex: 1.2,
        valueFormatter: (p: ValueFormatterParams<Investor>) =>
          p.value != null
            ? p.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
            : '—',
        cellClass: 'font-mono',
      },
      {
        headerName: 'Unpaid Redeem',
        field: 'unpaid_redeem',
        flex: 1.2,
        valueFormatter: (p: ValueFormatterParams<Investor>) =>
          p.value != null
            ? p.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
            : '—',
        cellClass: (p: CellClassParams<Investor>) =>
          p.value != null ? 'text-destructive font-mono' : 'ag-text-muted',
      },
      {
        headerName: 'Status',
        field: 'status',
        flex: 1,
        valueGetter: p => p.data?.status ?? '',
        cellRenderer: (p: ICellRendererParams<Investor>) => p.value ?? '',
      },
    ],
    [],
  );

  /* ----- grid ready -------------------------------------------- */
  const onGridReady = (e: GridReadyEvent<Investor>) => {
    gridApiRef.current = e.api;
    e.api.paginationGoToPage(page - 1);
    if (loading) e.api.showLoadingOverlay();
    applyQuickFilter(e.api, quickFilter);
  };

  /* ----- keep quick-filter in sync ----------------------------- */
  useEffect(() => {
    applyQuickFilter(gridApiRef.current, quickFilter);
  }, [quickFilter]);

  /* ----- reflect loading overlay ------------------------------- */
  useEffect(() => {
    const api = gridApiRef.current;
    if (!api) return;
    loading ? api.showLoadingOverlay() : api.hideOverlay();
  }, [loading]);

  /* ----- parent ⇄ grid page sync ------------------------------- */
  useEffect(() => {
    const api = gridApiRef.current;
    if (api && api.paginationGetCurrentPage() + 1 !== page) {
      api.paginationGoToPage(page - 1);
    }
  }, [page]);

  const handlePaginationChanged = () => {
    const api = gridApiRef.current;
    if (!api) return;
    const current = api.paginationGetCurrentPage() + 1;
    if (current !== page) onPageChange(current);
  };

  /* -------------- render --------------------------------------- */
  return (
    <div className="ag-theme-quartz w-full" style={{ height: 400 }}>
      <AgGridReact<Investor>
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={{ resizable: true, sortable: true }}
        domLayout="autoHeight"
        animateRows
        /* pagination */
        pagination
        paginationPageSize={PAGE_SIZE}
        onPaginationChanged={handlePaginationChanged}
        /* events */
        onGridReady={onGridReady}
        onRowClicked={(e: RowClickedEvent<Investor>) => {
          if (e.data) onSelectRow(e.data);
        }}
      />
    </div>
  );
}