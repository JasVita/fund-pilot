"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink } from "@/components/ui/pagination";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReportGeneratorDialog from "@/components/pdfGenerator/ReportGeneratorDialog";
import type { TableRowData } from "@/components/pdfGenerator/InvestmentTable";


/* ---- helpers ----------------------------------------------------- */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5103";

const usd = (v: number, compact = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(v);

const fmtNum = (v: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);

const fmtNumList = (s: string) =>
  s
    .split("\n")
    .map((n, i) =>
      Number.isFinite(Number(n)) ? (
        <span key={i}>{fmtNum(Number(n))}{i !== s.split("\n").length - 1 && <br />}</span>
      ) : (
        <span key={i}>{n}{i !== s.split("\n").length - 1 && <br />}</span>
      )
    );

const fmtNumListStr = (s: string) =>
  s
    .split("\n")
    .map((n) => (Number.isFinite(Number(n)) ? fmtNum(Number(n)) : n))
    .join("\n");


const fmtDateList = (s: string) =>
  s
    .split("\n")
    .map((d, i) => {
      const dt = new Date(d);
      const str =
        !isNaN(dt.getTime())
          ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
          : d;
      return (
        <span key={i}>
          {str}
          {i !== s.split("\n").length - 1 && <br />}
        </span>
      );
    });

const fmtDateListStr = (s: string) =>
  s
    .split("\n")
    .map((d) => {
      const dt = new Date(d);
      return !isNaN(dt.getTime())
        ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
        : d;
    })
    .join("\n");

/* ---- types ------------------------------------------------------- */
type Investor = {
  investor: string;
  class: string | null;
  number_held: string | null;
  current_nav: number;
  unpaid_redeem: number | null;
  status: "active" | "inactive";
};

type Holding = {
  name: string;
  sub_date: string;       
  data_cutoff: string;    
  subscribed: string;     
  market_value: string;  
  total_after_int: number;  
  pnl_pct: string;        
};

type Fund = { fund_id:number; fund_name:string };   

/* --------------------------------------------------------------- */
export default function InvestorsPage() {
  /* ① fund list + current filter ---------------------------------- */
  const [funds, setFunds] = useState<Fund[]>([]);
  const [selectedFund, setSelectedFund] = useState<number | null>(null);

  /* ② table data & UI state --------------------------------------- */
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Investor[]>([]);
  const [pageCount, setPageCount] = useState(1);

  /* ③ drawer state ------------------------------------------------ */
  const [selected, setSelected] = useState<Investor | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loadingHoldings, setLoadingHoldings] = useState(false);

  /* ------------------------------------------------------------------ *
   * 1. load the fund list once
   * ------------------------------------------------------------------ */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/funds`, { credentials: "include" });
        const j: Fund[] = await r.json();
        setFunds(j);
        if (j.length && selectedFund == null) setSelectedFund(j[0].fund_id);
      } catch (err) {
        console.error("fund list fetch:", err);
      }
    })();
  }, []);

  /* ------------------------------------------------------------------ *
   * 2. portfolio rows – refetch on fund|page change
   * ------------------------------------------------------------------ */
  useEffect(() => {
    if (selectedFund == null) return;

    (async () => {
      try {
        const url = `${API_BASE}/investors/portfolio?fund_id=${selectedFund}&page=${page}`;
        const r   = await fetch(url, { credentials: "include" });
        const j   = await r.json() as {
          page: number; pageCount: number; rows: Investor[];
        };
        setRows(j.rows);
        setPageCount(j.pageCount);
      } catch (e) { console.error("portfolio fetch:", e); }
    })();
  }, [selectedFund, page]);                                        // <- single stable dep

  /* ------------------------------------------------------------------ *
   * 3. holdings drawer – refetch when investor *or* fund changes
   * ------------------------------------------------------------------ */
  useEffect(() => {
    if (!selected || selectedFund == null) { setHoldings([]); return; }

    (async () => {
      try {
        setLoadingHoldings(true);
        const url = `${API_BASE}/investors/holdings?fund_id=${selectedFund}` +
                    `&investor=${encodeURIComponent(selected.investor)}`;

        const r  = await fetch(url, { credentials: "include" });
        const j: { rows?: Holding[] } = await r.json();

        /*  ⬇ only accept real arrays */
        setHoldings(Array.isArray(j.rows) ? j.rows : []);
      } catch (e) {
        console.error("holdings fetch:", e);
        setHoldings([]);                       // ← keep it an array on error
      } finally {
        setLoadingHoldings(false);
      }
    })();
  }, [selectedFund, selected]);

  /* ------------------------------------------------------------------ *
   *  UX helpers
   * ------------------------------------------------------------------ */
  const changeFund = (v: string) => {
    setSelectedFund(Number(v));            // 1) switch fund
    setPage(1);                    // 2) reset paging
    setSelected(null);             // 3) close any drawer
  };

  /* close detail on Esc ------------------------------------------ */
  const escClose = useCallback((e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); }, []);
  useEffect(() => { window.addEventListener("keydown", escClose); return () => window.removeEventListener("keydown", escClose); }, [escClose]);

  /* ------------------------------------------------------------------ *
   * 4. JSX
   * ------------------------------------------------------------------ */
  /* -- FUND PICKER -------------------------------------------------- */
  const FundPicker = (
    <Select value={selectedFund != null ? String(selectedFund) : ""}
            onValueChange={changeFund}>
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
  );

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
              <col style={{ width: "26%" }} className="max-w-[220px]" />
              <col style={{ width: "14%" }} className="max-w-[110px]" />
              <col style={{ width: "14%" }} className="max-w-[110px]" />
              <col style={{ width: "16%" }} className="max-w-[120px]" />
              <col style={{ width: "16%" }} className="max-w-[140px]" />
              <col style={{ width: "14%" }} className="max-w-[90px]" />
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
              {(rows ?? []).map((inv, idx) => (
                <TableRow
                  key={`${inv.investor}-${inv.class ?? "none"}-${idx}`}
                  onClick={() => setSelected(inv)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="font-medium sticky left-0 bg-background" title={inv.investor}>
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

  /* >>> convert live holdings → TableRowData */
  const tableRowsForPdf: TableRowData[] = holdings.map((h) => ({
    productName: h.name,
    subscriptionTime: h.sub_date,          // already "YYYY-MM" list\n…
    dataDeadline: h.data_cutoff,
    subscriptionAmount: h.subscribed,
    marketValue: h.market_value,
    totalAfterDeduction:
      h.total_after_int !== null ? h.total_after_int.toString() : "N/A",
    estimatedProfit:
      h.pnl_pct === "NA" ? "NA"
        : `${Number(h.pnl_pct) > 0 ? "+" : ""}${h.pnl_pct}%`,
  }));

  /* -------------------------------------------------------------- */
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Investors</h1>

      {/* FUND PICKER ------------------------------------------------ */}
      <Select value={selectedFund !== null ? String(selectedFund) : ""} onValueChange={changeFund}>
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
                {/* <CardHeader>
                  <CardTitle>Holdings (mock)</CardTitle>
                </CardHeader> */}
                {/* make table area scrollable while header & footer stay fixed */}
                <CardContent className="p-6">
                  <div className="overflow-x-auto">
                    <Table className="w-full table-fixed border-collapse [&_th]:truncate"> 
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
                      {loadingHoldings ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center">
                            Loading…
                          </TableCell>
                        </TableRow>
                      ) : holdings.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center">
                            No data
                          </TableCell>
                        </TableRow>
                      ) : (
                        holdings.map((h) => (
                          <TableRow key={h.name}>
                            <TableCell className="whitespace-pre-line break-words" title={h.name}>{h.name}</TableCell>
                            <TableCell className="truncate" title={fmtDateListStr(h.sub_date)}>{fmtDateList(h.sub_date)}</TableCell>
                            <TableCell className="truncate" title={fmtDateListStr(h.data_cutoff)}>{fmtDateList(h.data_cutoff)}</TableCell>
                            <TableCell className="truncate text-right" title={fmtNumListStr(h.subscribed)}>{fmtNumList(h.subscribed)}</TableCell>
                            <TableCell className="truncate text-right" title={fmtNumListStr(h.market_value)}>{fmtNumList(h.market_value)}</TableCell>
                            <TableCell className="truncate text-right" title={fmtNum(h.total_after_int)}>{fmtNum(h.total_after_int)}</TableCell>
                            <TableCell
                              className={`text-right ${
                                h.pnl_pct === "NA"
                                  ? "text-muted-foreground"
                                  : Number(h.pnl_pct) > 0
                                  ? "text-green-600"
                                  : "text-destructive"
                              }`}
                            >
                              {h.pnl_pct === "NA"
                                ? "NA"
                                : `${Number(h.pnl_pct) > 0 ? "+" : ""}${
                                    h.pnl_pct
                                  }%`}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-center pt-4">
              <ReportGeneratorDialog
                defaultInvestor={selected.investor}
                defaultTableData={tableRowsForPdf}  
              />
            </div>
              {/* download CTA */}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        TableCard
      )}
    </div>
  );
}
