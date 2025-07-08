/* ------------------------------------------------------------------
   LatestHoldingsTable – AG Grid v32, left-aligned
------------------------------------------------------------------ */
'use client';

import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

export type LatestHolding = {
  fund_name: string;
  snapshot_date: string;
  number_held: number;
  nav_value: number;
};

type Props = { rows: LatestHolding[]; loading: boolean };

export default function LatestHoldingsTable({ rows, loading }: Props) {
  const colDefs: ColDef<LatestHolding>[] = useMemo(
    () => [
      { headerName: 'Fund Name', field: 'fund_name', flex: 2 },
      {
        headerName: 'Snapshot Date',
        field: 'snapshot_date',
        flex: 1,
        valueFormatter: p => new Date(p.value).toLocaleDateString('en-CA'),
      },
      {
        headerName: 'Number Held',
        field: 'number_held',
        flex: 1,
        valueFormatter: p => p.value?.toLocaleString(),
      },
      {
        headerName: 'NAV Value',
        field: 'nav_value',
        flex: 1,
        valueFormatter: p =>
          p.value?.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 2,
          }),
      },
    ],
    [],
  );

  return (
    <div className="ag-theme-quartz w-full" style={{ height: 300 }}>
      <AgGridReact<LatestHolding>
        rowData={rows}
        columnDefs={colDefs}
        defaultColDef={{
          resizable: true,
          cellStyle: { textAlign: 'left' },
        }}
        domLayout="autoHeight"
        overlayLoadingTemplate="Loading…"
        overlayNoRowsTemplate="No data"
        loadingOverlayComponentParams={{ loading }}
      />
    </div>
  );
}
