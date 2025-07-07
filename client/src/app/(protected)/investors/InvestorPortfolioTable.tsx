/* ------------------------------------------------------------------
   InvestorPortfolioTable – specialised wrapper around <DataTable/>
------------------------------------------------------------------ */
"use client";

import DataTable from "@/components/ui/data-table";
import type { ColDef } from "@/components/ui/data-table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";

/* -------- row shape (same as page.tsx) -------------------------- */
export type InvestorRow = {
  investor: string | null;         // ⚠  may be null/"" when it’s a continuation
  class: string | null;
  number_held: string | null;
  current_nav: number;
  unpaid_redeem: number | null;
  status: "active" | "inactive" | null;
};

/* -------- smart page helper ------------------------------------ */
const smart = (p: number, last: number): (number | "gap")[] => {
  if (last <= 3) return [...Array(last)].map((_, i) => i + 1);
  if (p <= 2) return [1, 2, "gap", last];
  if (p >= last - 1) return [1, "gap", last - 1, last];
  return [1, "gap", p - 1, p, p + 1, "gap", last];
};

/*-----------------------------------------------------------------
   ** ✦ 1.  tiny helper used everywhere **
-----------------------------------------------------------------*/
const nameAt = (rows: InvestorRow[], i: number) =>
  (rows[i]?.investor ?? "").trim();

/* ---------------------------------------------------------------- */
export default function InvestorPortfolioTable({
  rows,
  loading,
  page,
  pageCount,
  onPageChange,
  onSelectRow,
}: {
  rows: InvestorRow[];
  loading: boolean;
  page: number;
  pageCount: number;
  onPageChange: (n: number) => void;
  onSelectRow: (r: InvestorRow) => void;
}) {
  /* ------- table definition (one source of truth) --------------- */
  const columns: ColDef<InvestorRow>[] = [
    /* ------------------------------------------------ Investor --- */
    {
      header: "Investor",
      accessor: (_, i) => nameAt(rows, i),                 // ✦ 2. safe accessor
      width: "26%",
      cellClass: (v) =>
        ["sticky left-0 bg-background", v && "font-medium"]
          .filter(Boolean)
          .join(" "),
    },
    /* ------------------------------------------------ Class ------ */
    {
      header: "Class",
      accessor: (r) =>
        r.class ? (
          <Badge variant="secondary">{r.class}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      width: "14%",
      cellClass: (_, __, i) =>
        nameAt(rows, i) === "" ? "border-t-0" : "", // hide rule on continuation
    },
    /* ------------------------------------------------ Number held */
    {
      header: "Number Held",
      accessor: (r) =>
        r.number_held ?? <span className="text-muted-foreground">—</span>,
      width: "14%",
    },
    /* ------------------------------------------------ NAV -------- */
    {
      header: "Current NAV",
      accessor: (r) =>
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 2,
        }).format(r.current_nav),
      width: "16%",
      cellClass: "font-mono",
    },
    /* ------------------------------------------------ Redeem ----- */
    {
      header: "Unpaid Redeem",
      accessor: (r) =>
        r.unpaid_redeem !== null ? (
          <span className="text-destructive font-mono">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 2,
            }).format(r.unpaid_redeem)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      width: "16%",
    },
    /* ------------------------------------------------ Status ----- */
    {
      header: "Status",
      // accessor: (r) => (
      //   <Badge variant={r.status === "active" ? "default" : "outline"}>
      //     {r.status}
      //   </Badge>
      // ),
      accessor: (r) =>
        r.status
          ? (
              <Badge
                variant={r.status === "active" ? "default" : "outline"}
              >
                {r.status}
              </Badge>
            )
          : null,    
      width: "14%",
    },
  ];

  /* ------- render ------------------------------------------------ */
  return (
    <>
      <DataTable<InvestorRow>
        columns={columns}
        rows={rows}
        loading={loading}
        empty="No data"
        onRowClick={(r) => onSelectRow(r)}
        /* ✦ 3.  row-level borders */
        rowClassName={(_, i) => {
          const samePrev = i > 0 && nameAt(rows, i) === "";
          const sameNext = i + 1 < rows.length && nameAt(rows, i + 1) === "";
          return [
            "cursor-pointer hover:bg-muted/50",
            samePrev && "border-t-0",   // no top rule if we’re a continuation
            sameNext && "border-b-0",   // no bottom rule if next row continues
          ]
            .filter(Boolean)
            .join(" ");
        }}
      />

      {/* Pagination ------------------------------------------------ */}
      <div className="mt-4">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={() => onPageChange(Math.max(1, page - 1))}
                aria-disabled={page === 1}
              />
            </PaginationItem>

            {smart(page, pageCount).map((n, i) =>
              n === "gap" ? (
                <PaginationItem key={`g${i}`}>
                  <span className="px-2 select-none">…</span>
                </PaginationItem>
              ) : (
                <PaginationItem key={n}>
                  <PaginationLink
                    href="#"
                    isActive={n === page}
                    onClick={() => onPageChange(n)}
                  >
                    {n}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={() => onPageChange(Math.min(pageCount, page + 1))}
                aria-disabled={page === pageCount}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </>
  );
}
