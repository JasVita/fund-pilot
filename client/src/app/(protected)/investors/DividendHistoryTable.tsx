/* ------------------------------------------------------------------
   DividendHistoryTable – AG Grid v32
------------------------------------------------------------------ */
'use client';

import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

export type DividendRow = {
  fund_category: string;
  paid_date: string; // ISO
  amount: string;    // already number-like
};

type Props = { rows: DividendRow[]; loading: boolean };

export default function DividendHistoryTable({ rows, loading }: Props) {
  const cols: ColDef<DividendRow>[] = useMemo(
    () => [
      { headerName: 'Fund Name', field: 'fund_category', flex: 2 },
      {
        headerName: 'Paid Date',
        field: 'paid_date',
        flex: 1,
        valueFormatter: p =>
          new Date(p.value).toLocaleDateString('en-CA'),
      },
      {
        headerName: 'Amount (USD)',
        field: 'amount',
        flex: 1,
        valueFormatter: p =>
          (+p.value).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 2,
          }),
        cellClass: 'font-mono text-right text-green-700',
      },
    ],
    [],
  );

  return (
    <div className="ag-theme-quartz w-full" style={{ height: 300 }}>
      <AgGridReact<DividendRow>
        rowData={rows}
        columnDefs={cols}
        defaultColDef={{ resizable: true }}
        domLayout="autoHeight"
        overlayLoadingTemplate="Loading…"
        overlayNoRowsTemplate="No data"
        loadingOverlayComponentParams={{ loading }}
      />
    </div>
  );
}
