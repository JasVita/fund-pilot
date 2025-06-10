"use client";

import { useEffect, useState } from "react";
import { DollarSign, Banknote } from "lucide-react"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink } from "@/components/ui/pagination";

/* ---- helpers ----------------------------------------------------- */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5103";

const usd = (v: number, compact = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(v);

/* ---- types ------------------------------------------------------- */
type Investor = {
  investor: string;
  class: string | null;
  number_held: string | null;
  current_nav: number;
  unpaid_redeem: number | null;
  status: "active" | "inactive";
};

/* ---- component --------------------------------------------------- */
export default function InvestorsPage() {
  const [page, setPage]           = useState(1);
  const [rows, setRows]           = useState<Investor[]>([]);
  const [pageCount, setPageCount] = useState(1);
  const [selected, setSelected]   = useState<Investor | null>(null);

  /* fetch rows whenever page changes -------------------------------- */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/investors/portfolio?page=${page}`, {
          // credentials: "include",
        });
        const j: { page:number; pageCount:number; rows:Investor[] } = await r.json();
        setRows(j.rows);
        setPageCount(j.pageCount);
      } catch (err) {
        console.error("investor fetch:", err);
      }
    })();
  }, [page]);

  /* ---- UI -------------------------------------------------------- */
  return (
    <div className="p-6 space-y-6">
      {/* header */}
      <div>
        <h1 className="text-2xl font-bold">Investors</h1>
        {/* <p className="text-muted-foreground">
          Paginated list (20 per page) – actives first
        </p> */}
      </div>

      {/* table */}
      <Card>
        <CardHeader><CardTitle>Investor Portfolio Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              {/* ---- fixed widths ---------------------------------- */}
              <colgroup>
                <col style={{ width: "26%" }} />  {/* Investor      */}
                <col style={{ width: "14%" }} />  {/* Class         */}
                <col style={{ width: "14%" }} />  {/* Number Held   */}
                <col style={{ width: "16%" }} />  {/* Current NAV   */}
                <col style={{ width: "16%" }} />  {/* Unpaid Redeem */}
                <col style={{ width: "14%" }} />  {/* Status        */}
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10">
                    Investor
                  </TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Number&nbsp;Held</TableHead>
                  <TableHead className="text-left">Current&nbsp;NAV</TableHead>
                  <TableHead className="text-left">Unpaid&nbsp;Redeem</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.map((inv, idx) => (
                  <TableRow
                    key={`${inv.investor}-${inv.class ?? "none"}-${idx}`}
                    onClick={() => setSelected(inv)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="font-medium sticky left-0 bg-background">
                      {inv.investor}
                    </TableCell>
                    <TableCell>
                      {inv.class
                        ? <Badge variant="secondary">{inv.class}</Badge>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {inv.number_held ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="font-mono">
                      {usd(inv.current_nav)} {/* {usd(inv.current_nav, true)} table cell — compact */} 
                    </TableCell>
                    <TableCell className="font-mono">
                      {inv.unpaid_redeem !== null
                        ? <span className="text-destructive">{usd(inv.unpaid_redeem)}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={inv.status === "active" ? "default" : "outline"}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* pagination */}
          <div className="mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-disabled={page === 1}
                  />
                </PaginationItem>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                  <PaginationItem key={n}>
                    <PaginationLink
                      href="#"
                      isActive={n === page}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    aria-disabled={page === pageCount}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      {/* detail sheet (minimal) */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selected?.investor}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-6 space-y-4 p-6 mx-2">
              
              <Card>
                <CardContent className="p-4 space-y-1">
                  <p className="text-sm text-muted-foreground">Current NAV</p>
                  <p className="text-xl font-bold">{usd(selected.current_nav)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-1">
                  <p className="text-sm text-muted-foreground">Unpaid Redeem</p>
                  <p className={`text-xl font-bold ${
                        selected.unpaid_redeem ? "text-destructive" : "text-muted-foreground"
                      }`}>
                    {selected.unpaid_redeem ? usd(selected.unpaid_redeem) : "—"}
                  </p>
                </CardContent>
              </Card>
              
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
