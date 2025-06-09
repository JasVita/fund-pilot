"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink } from "@/components/ui/pagination";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";

/* ---- helpers ----------------------------------------------------- */
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5103";

const usd = (v: number, compact = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(v);

  const mockHoldings = [
  {
    name: "諾偉環球城市房地產投資信託基金（淨值派息型）",
    subDate: "2022-11",
    dataCutoff: "2025-02",
    subscribed: 500_000,
    marketValue: 414_727.9,
    totalAfterInt: 471_914.73,
    pnl: -5.62,
  },
  {
    name: "Annum 全球大趨勢基金-票據系列 Class PP",
    subDate: "2023-06",
    dataCutoff: "NA",
    subscribed: 200_000,
    marketValue: null,
    totalAfterInt: null,
    pnl: null,
  },
  {
    name: "凱偉私募債貸投資方案安投通道基金（派息型）",
    subDate: "2023-06",
    dataCutoff: "2024-12",
    subscribed: 500_000,
    marketValue: 488_723.9,
    totalAfterInt: 563_393.3,
    pnl: +12.68,
  },
];

/* ---- types ------------------------------------------------------- */
type Investor = {
  investor: string;
  class: string | null;
  number_held: string | null;
  current_nav: number;
  unpaid_redeem: number | null;
  status: "active" | "inactive";
};

/* --------------------------------------------------------------- */
export default function InvestorsPage() {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Investor[]>([]);
  const [pageCount, setPageCount] = useState(1);
  const [selected, setSelected] = useState<Investor | null>(null);

  /* fetch rows whenever page changes ----------------------------- */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/investors/portfolio?page=${page}`);
        const j: { page: number; pageCount: number; rows: Investor[] } =
          await r.json();
        setRows(j.rows);
        setPageCount(j.pageCount);
      } catch (err) {
        console.error("investor fetch:", err);
      }
    })();
  }, [page]);

  /* close detail on Esc ------------------------------------------ */
  const escClose = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setSelected(null);
  }, []);
  useEffect(() => {
    window.addEventListener("keydown", escClose);
    return () => window.removeEventListener("keydown", escClose);
  }, [escClose]);

  /* -------------------------------------------------------------- */
  const TableCard = (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Investor Portfolio Overview</CardTitle>
      </CardHeader>
      <CardContent className="h-full flex flex-col">
        <div className="flex-1 overflow-x-auto">
          <Table className="w-full table-fixed [&_td]:truncate [&_th]:truncate">
            <colgroup>
              {/* Investor – allow 220 px then truncate */}
              <col style={{ width: "26%" }} className="max-w-[220px]" />
              {/* Class */}
              <col style={{ width: "14%" }} className="max-w-[110px]" />
              {/* Number Held */}
              <col style={{ width: "14%" }} className="max-w-[110px]" />
              {/* Current NAV */}
              <col style={{ width: "16%" }} className="max-w-[120px]" />
              {/* Unpaid Redeem */}
              <col style={{ width: "16%" }} className="max-w-[140px]" />
              {/* Status */}
              <col style={{ width: "14%" }} className="max-w-[90px]" />
              {/* {["26%", "14%", "14%", "16%", "16%", "14%"].map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))} */}
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
                    {inv.class ? (
                      <Badge variant="secondary">{inv.class}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {inv.number_held ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {usd(inv.current_nav)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {inv.unpaid_redeem !== null ? (
                      <span className="text-destructive">
                        {usd(inv.unpaid_redeem)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={inv.status === "active" ? "default" : "outline"}
                    >
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
  );

  /* -------------------------------------------------------------- */
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Investors</h1>

      {/* ---------- MAIN LAYOUT ---------- */}
      {selected ? (
        <ResizablePanelGroup
          direction="horizontal"
          className="flex-1 min-w-0 h-[calc(100vh-10rem)]"
        >
          {/* Left = table */}
          <ResizablePanel
            defaultSize={70}
            minSize={20}
            maxSize={80}
            className="pr-2 overflow-auto"
          >
            {TableCard}
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right = detail */}
          <ResizablePanel
            defaultSize={30}
            minSize={20}
            maxSize={80}
            className="flex flex-col overflow-auto p-6 space-y-4 bg-background shadow-lg relative"
          >
            <button
              aria-label="Close"
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 rounded-md p-1 hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold">{selected.investor}</h2>
              {/* holdings table */}
              <Card>
                <CardHeader>
                  <CardTitle>Holdings (mock)</CardTitle>
                </CardHeader>
                {/* make table area scrollable while header & footer stay fixed */}
                <CardContent className="p-6">
                  <div className="overflow-x-auto">
                    <Table className="w-full table-fixed border-collapse [&_td]:truncate [&_th]:truncate">
                      <colgroup>
                        {["28%", "8%", "8%", "12%", "12%", "12%", "10%"].map((w, i) => (
                          <col key={i} style={{ width: w }} />
                        ))}
                      </colgroup>
            
                      <TableHeader>
                        <TableRow>
                          <TableHead>產品名稱</TableHead>
                          <TableHead className="whitespace-nowrap">認購時間</TableHead>
                          <TableHead>數據截止</TableHead>
                          <TableHead className="text-right">認購金額<br />(USD)</TableHead>
                          <TableHead className="text-right">市值</TableHead>
                          <TableHead className="text-right">含息後總額</TableHead>
                          <TableHead className="text-right">估派息後盈虧 (%)</TableHead>
                        </TableRow>
                      </TableHeader>
            
                      <TableBody>
                        {mockHoldings.map((h) => (
                          <TableRow key={h.name}>
                            <TableCell>{h.name}</TableCell>
                            <TableCell>{h.subDate}</TableCell>
                            <TableCell>{h.dataCutoff}</TableCell>
                            <TableCell className="text-right">{usd(h.subscribed)}</TableCell>
                            <TableCell className="text-right">
                              {h.marketValue !== null ? usd(h.marketValue) : "NA"}
                            </TableCell>
                            <TableCell className="text-right">
                              {h.totalAfterInt !== null ? usd(h.totalAfterInt) : "NA"}
                            </TableCell>
                            <TableCell
                              className={`text-right ${
                                h.pnl === null
                                  ? "text-muted-foreground"
                                  : h.pnl > 0
                                  ? "text-green-600"
                                  : "text-destructive"
                              }`}
                            >
                              {h.pnl === null ? "NA" : `${h.pnl > 0 ? "+" : ""}${h.pnl}%`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
              {/* download CTA */}
              <div className="flex justify-center pt-4">
                <Button
                  variant="secondary"
                  className="flex items-center gap-2"
                  onClick={() => alert("TODO: hook up API")}
                >
                  <Download className="h-4 w-4" />
                  Download report
                </Button>
              </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        /* no selection → just show the table card */
        TableCard
      )}
    </div>
  );
}
