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
  ValueGetterParams, 
  RowClickedEvent,
  GridReadyEvent,
  GridApi,
} from 'ag-grid-community';
import { Badge } from "@/components/ui/badge";
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { fmtThousands } from '@/lib/format';

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
  onOpenFiles?: (r: Investor) => void; 
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
  onOpenFiles,
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
      /* ⬇️ Number Held — comma-separated, keep up to 6 dp */
      {
        headerName: 'Number Held',
        field: 'number_held',
        flex: 1,
        valueFormatter: (p: ValueFormatterParams<Investor>) =>
          fmtThousands(p.value, 6),
        cellClass: 'font-mono',
      },

      /* ⬇️ Current NAV — comma-separated, 2 dp (no $ symbol) */
      {
        headerName: 'Current NAV',
        field: 'current_nav',
        flex: 1.2,
        valueFormatter: (p: ValueFormatterParams<Investor>) =>
          fmtThousands(p.value, 2),
        cellClass: 'font-mono',
      },

      /* ⬇️ Unpaid Redeem — comma-separated, 2 dp (red if present) */
      {
        headerName: 'Unpaid Redeem',
        field: 'unpaid_redeem',
        flex: 1.2,
        valueFormatter: (p: ValueFormatterParams<Investor>) =>
          p.value != null ? fmtThousands(p.value, 2) : '—',
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
      // -------- Documents column (no field; use colId + renderer) --------
      {
        headerName: "Documents",
        colId: "documents",           // no field; this is a synthetic column
        flex: 1,
        sortable: false,
        filter: false,
        cellRenderer: (p: ICellRendererParams<Investor>) => {
          const row = p.data;
          const handle = (e: any) => {
            e?.preventDefault?.();
            e?.stopPropagation?.();   // <-- critical: block row click
            if (row && onOpenFiles) onOpenFiles(row);
          };
          return (
            <Badge
              variant="secondary"
              role="button"
              tabIndex={0}
              className="cursor-pointer rounded-full select-none"
              onClick={handle}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handle(e);
              }}
            >
              Details
            </Badge>
          );
        },
      },
    ],
    [onOpenFiles],
  );

  /* ----- grid ready -------------------------------------------- */
  const onGridReady = (e: GridReadyEvent<Investor>) => {
    gridApiRef.current = e.api;
    e.api.paginationGoToPage(page - 1);
    applyQuickFilter(e.api, quickFilter);
    e.api.setGridOption?.("loading", loading);
  };

  /* ----- keep quick-filter in sync ----------------------------- */
  useEffect(() => {
    applyQuickFilter(gridApiRef.current, quickFilter);
  }, [quickFilter]);

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
        pagination
        paginationPageSize={PAGE_SIZE}
        onPaginationChanged={handlePaginationChanged}
        onGridReady={onGridReady}
        loading={loading}

        /* 👇 single click handler */
        onCellClicked={(e) => {
          // if user clicked the "Documents" cell, do NOT trigger Details selection
          if (e.colDef?.colId === "documents") {
            e.event?.stopPropagation?.();     // extra safety
            return;
          }
          if (e.data) onSelectRow(e.data);    // any other cell → Details mode
        }}
      />
    </div>
  );
}