/* ------------------------------------------------------------------
   HoldingsTable – AG Grid v32, left-aligned, automatic column width
------------------------------------------------------------------ */
'use client';

import { useMemo, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  CellClassParams,
  GridApi,
  GridReadyEvent,
  ValueFormatterParams,
} from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
/* NEW imports for shared formatters */
import { fmtYYYYMM } from '@/lib/report-format';
import { fmtMoneyEnUS } from '@/lib/format';

ModuleRegistry.registerModules([AllCommunityModule]);

/* ---------- row model ------------------------------------------ */
export type Holding = {
  name:             string;
  sub_date:         string;
  data_cutoff:      string;
  subscribed:       string;
  market_value:     string;
  total_after_int:  number;
  pnl_pct:          string;   // "NA" | "-4.2" | "+3.1"
};

/* ---------- helpers -------------------------------------------- */
const fmtMoney = (v: string | number) =>
  Number.isFinite(+v)
    ? (+v).toLocaleString('en-US', { maximumFractionDigits: 2 })
    : String(v);

/* ---------- component ------------------------------------------ */
type Props = { rows: Holding[]; loading: boolean };

export default function HoldingsTable({ rows, loading }: Props) {
  const apiRef = useRef<GridApi | null>(null);

  /* --- column definitions -------------------------------------- */
  const colDefs: ColDef<Holding>[] = useMemo(
    () => [
      { headerName: '產品名稱', field: 'name', flex: 2 },

      {
        headerName: '認購時間',
        field: 'sub_date',
        flex: 1,
        valueGetter: p =>
          p.data?.sub_date?.split('\n').map(fmtYYYYMM).join('\n') ?? '',
      },
      {
        headerName: '數據截止',
        field: 'data_cutoff',
        flex: 1,
        valueGetter: p =>
          p.data?.data_cutoff?.split('\n').map(fmtYYYYMM).join('\n') ?? '',
      },

      {
        headerName: '認購金額 (USD)',
        field: 'subscribed',
        flex: 1.2,
        valueFormatter: (p: ValueFormatterParams<Holding>): string =>
          (p.value as string)?.split('\n').map(fmtMoneyEnUS).join('\n') ?? '',
      },
      {
        headerName: '市值',
        field: 'market_value',
        flex: 1.2,
        valueFormatter: (p: ValueFormatterParams<Holding>): string =>
          (p.value as string)?.split('\n').map(fmtMoneyEnUS).join('\n') ?? '',
      },
      {
        headerName: '含息後總額',
        field: 'total_after_int',
        flex: 1.2,
        valueFormatter: (p: ValueFormatterParams<Holding>): string => {
          const v = p.value as number | null | undefined;
          return v == null || !Number.isFinite(v) ? 'N/A' : fmtMoneyEnUS(v);
        },
      },

      {
        headerName: '估派息後盈虧 (%)',
        field: 'pnl_pct',
        flex: 1,
        valueGetter: p => p.data?.pnl_pct ?? '',
        cellClass: (p: CellClassParams<Holding>) =>
          p.value === 'NA'
            ? 'ag-text-muted'
            : +p.value > 0
            ? 'text-green-600'
            : 'text-destructive',
      },
    ],
    [],
  );

  /* --- grid lifecycle ------------------------------------------ */
  const onReady = (e: GridReadyEvent) => {
    apiRef.current = e.api;

    /* auto-size columns once (ColumnApi is on the event itself) */
    const colApi = (e as any).columnApi;
    colApi?.autoSizeAllColumns?.();

    if (loading) e.api.showLoadingOverlay();
  };

  useEffect(() => {
    loading
      ? apiRef.current?.showLoadingOverlay()
      : apiRef.current?.hideOverlay();
  }, [loading]);

  return (
    <div className="ag-theme-quartz w-full" style={{ height: 400 }}>
      <AgGridReact<Holding>
        rowData={rows}
        columnDefs={colDefs}
        defaultColDef={{
          resizable: true,
          cellStyle: { whiteSpace: 'pre-line', textAlign: 'left' },
        }}
        domLayout="autoHeight"
        suppressPaginationPanel
        onGridReady={onReady}
      />
    </div>
  );
}
