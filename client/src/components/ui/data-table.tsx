/* ------------------------------------------------------------------
   DataTable – a single declarative table for every use–case
------------------------------------------------------------------- */
"use client";

import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";

/* ①  PUBLIC  ──────────────────────────────────────────────────── */
export type ColDef<R> = {
  /** visible header text                                         */
  header   : string;
  /** either a key in the row, or a render fn                     */
  accessor : keyof R | ((row: R, i: number) => React.ReactNode);
  /** optional <col> style  (e.g. "18%")                          */
  width?   : string;
  /** extra <td> className – string or fn(value,row,idx)          */
  cellClass?: string | ((v: any, r: R, i: number) => string);
};

type Props<R> = {
  columns      : ColDef<R>[];
  rows         : R[];
  empty        : React.ReactNode;
  loading      : boolean;
  /* NEW – both optional ---------------------------------------- */
  onRowClick?  : (row: R, index: number) => void;
  rowClassName?: string | ((row: R, index: number) => string);
};

/* ②  COMPONENT  ──────────────────────────────────────────────── */
export default function DataTable<R extends object>({
  columns, rows, empty, loading,
  onRowClick, rowClassName,
}: Props<R>) {
  /* helper – single cell render */
  const renderCell = (c: ColDef<R>, r: R, i: number) => {
    const val =
      typeof c.accessor === "function" ? c.accessor(r, i)
                                       : (r as any)[c.accessor];
    const cls =
      typeof c.cellClass === "function" ? c.cellClass(val, r, i)
                                        : c.cellClass ?? "";
    return <TableCell className={cls}>{val}</TableCell>;
  };

  return (
    <div className="overflow-x-auto">
      <Table className="w-full table-fixed border-collapse [&_th]:truncate [&_td]:truncate [&_td]:whitespace-pre-line [&_.no-top-border]:border-t-transparent">
        {/* optional <colgroup> */}
        {columns.some(c => c.width) && (
          <colgroup>
            {columns.map((c, i) => (
              <col key={i} style={{ width: c.width }} />
            ))}
          </colgroup>
        )}

        {/* header */}
        <TableHeader>
          <TableRow>
            {columns.map((c, i) => <TableHead key={i}>{c.header}</TableHead>)}
          </TableRow>
        </TableHeader>

        {/* body */}
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center">
                Loading…
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r, ri) => (
              <TableRow
                key={ri}
                /* clickable row? */
                onClick={onRowClick ? () => onRowClick(r, ri) : undefined}
                className={
                  typeof rowClassName === "function"
                    ? rowClassName(r, ri)
                    : rowClassName ?? ""
                }
              >
                {columns.map((c, ci) => renderCell(c, r, ri))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
