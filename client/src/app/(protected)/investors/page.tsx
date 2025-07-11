"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Search, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import InvestorPortfolioCard from "./InvestorPortfolioCard";
import type { Investor } from "./InvestorPortfolioTable";

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import ReportGeneratorDialog from "./tables/ReportGeneratorDialog";
/* ---- helpers ----------------------------------------------------- */
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5003";

const usd = (v: number, compact = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(v);

const fmtNum = (v: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);

const splitLines = (s?: string | null) => (s ?? "").split("\n");

const parseLooseNumber = (raw: string) => {
  const num = parseFloat(
    raw.replace(/,/g, "").replace(/\.$/, "")   // kill commas + lone dot
  );
  return Number.isFinite(num) ? num : null;
};

const fmtNumList = (s: string | null | undefined) =>
  splitLines(s).map((token, i, arr) => {
    const n = parseLooseNumber(token);
    return n !== null ? (
      <span key={i}>{fmtNum(n)}{i !== arr.length - 1 && <br />}</span>
    ) : (
      <span key={i}>{token.replace(/\.$/, "")}{i !== arr.length - 1 && <br />}</span>
    );
  });

const fmtNumListStr = (s: string | null | undefined) =>
  splitLines(s).map((token) => {
    const n = parseLooseNumber(token);
    return n !== null ? fmtNum(n) : token.replace(/\.$/, "");
  }).join("\n");


const fmtDateList = (s: string | null | undefined) =>
  splitLines(s).map((d, i, arr) => {
    const dt = new Date(d);
    const str = !isNaN(dt.getTime())
      ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
      : d;
    return (
      <span key={i}>{str}{i !== arr.length - 1 && <br />}</span>
    );
  });

const fmtDateListStr = (s: string | null | undefined) =>
  splitLines(s).map((d) => {
    const dt = new Date(d);
    return !isNaN(dt.getTime()) ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}` : d;
  })
    .join("\n");

/* simple USD fmt so it matches your style */
const usdStd = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(v);

/* ------------------------------------------------------------------ *
 * smartPageList()
 *   – always shows first & last page
 *   – when current page ≤ 3 ➜  1 2 3 … last
 *   – when current page ≥ (last-2) ➜ 1 … last-2 last-1 last
 *   – otherwise               ➜  1 … p-1 p p+1 … last
 * ------------------------------------------------------------------ */
function smartPageList(page: number, last: number): (number | "gap")[] {
  if (last <= 3) return [...Array(last)].map((_, i) => i + 1);
  if (page <= 2) return [1, 2, "gap", last];
  if (page >= last - 1) return [1, "gap", last - 1, last];
  /* middle */
  return [1, "gap", page - 1, page, page + 1, "gap", last];
}

/* ---- types ------------------------------------------------------- */
// type Investor = InvestorRow;

type Holding = {
  name: string;
  sub_date: string;
  data_cutoff: string;
  subscribed: string;
  market_value: string;
  total_after_int: number;
  pnl_pct: string;
};

type LatestHolding = {
  fund_name: string;
  snapshot_date: string;
  number_held: number;
  nav_value: number;
};

type DividendRow = {
  fund_category: string;
  paid_date: string;
  amount: string;
};

type Fund = { fund_id: number; fund_name: string };

/* --------------------------------------------------------------- */
export default function InvestorsPage() {
  /* ① fund list + current filter --------------------- */
  const [funds, setFunds] = useState<Fund[]>([]);
  const [selectedFund, setSelectedFund] = useState<number | null>(null);

  const [quickFilter, setQuickFilter] = useState("");

  /* ② table data & UI state --------------------------------------- */
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Investor[]>([]);
  const [pageCount, setPageCount] = useState(1);
  const [selected, setSelected] = useState<Investor | null>(null);
  /* ③ drawer state ------------------------------------------------ */
  // const [selected, setSelected] = useState<Investor | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loadingHoldings, setLoadingHoldings] = useState(false);

  /* ------- latest-per-fund table */
  const [latestHoldings, setLatestHoldings] = useState<LatestHolding[]>([]);
  const [loadingLatest, setLoadingLatest] = useState(false);

  /* ------- dividend table ------------------------------ */
  const [divRows, setDivRows] = useState<DividendRow[]>([]);
  const [loadingDivs, setLoadingDivs] = useState(false);

  /* ----------------------------------------------------------------
     ✦ NEW  handleRowSelect adapter
     Keeps type-safety between InvestorRow → Investor
  ------------------------------------------------------------------ */
  const handleRowSelect = useCallback(
    (row: Investor) => {
      let target = row;           // initial guess

      if (!row.investor || row.investor.trim() === "") {
        const idx = rows.findIndex(r => r === row);
        const prevNamed = [...rows]
          .slice(0, idx)
          .reverse()
          .find(r => r.investor && r.investor.trim() !== "");
        if (prevNamed) target = prevNamed;
      }

      setSelected(target);
    },
    [rows],
  );

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
        const r = await fetch(url, { credentials: "include" });
        const j = await r.json() as {
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
          `&investor=${encodeURIComponent(selected.investor ?? "")}`;

        const r = await fetch(url, { credentials: "include" });
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
  * 3b. latest holdings across ALL funds – refetch when investor changes
  * ------------------------------------------------------------------ */
  useEffect(() => {
    if (!selected) { setLatestHoldings([]); return; }

    (async () => {
      try {
        setLoadingLatest(true);
        const url = `${API_BASE}/investors/holdings/all-funds` +
          `?investor=${encodeURIComponent(selected.investor ?? "")}`;

        const r = await fetch(url, { credentials: "include" });
        const j: { rows?: LatestHolding[] } = await r.json();

        setLatestHoldings(Array.isArray(j.rows) ? j.rows : []);
      } catch (e) {
        console.error("latest-holdings fetch:", e);
        setLatestHoldings([]);
      } finally {
        setLoadingLatest(false);
      }
    })();
  }, [selected]);

  /* ------------------------------------------------------------------ *
  * 3c. dividend history – refetch when investor changes
  * ------------------------------------------------------------------ */
  useEffect(() => {
    if (!selected) { setDivRows([]); return; }

    (async () => {
      try {
        setLoadingDivs(true);
        const url = `${API_BASE}/investors/holdings/dividends` +
          `?investor=${encodeURIComponent(selected.investor ?? "")}`;

        const r = await fetch(url, { credentials: "include" });
        const j: { rows?: DividendRow[] } = await r.json();

        setDivRows(Array.isArray(j.rows) ? j.rows : []);
      } catch (e) {
        console.error("dividends fetch:", e);
        setDivRows([]);
      } finally {
        setLoadingDivs(false);
      }
    })();
  }, [selected]);

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

  /* -------------------------------------------------------------- */
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Investors</h1>

      {/* FUND PICKER ------------------------------------------------ */}
      <div className="flex items-center gap-4">
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

        <div className="relative ml-auto w-96">   
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4
                       text-muted-foreground pointer-events-none"
          />
          <Input
            placeholder="Search investors or class here…"
            value={quickFilter}
            onChange={e => setQuickFilter(e.target.value)}
            className="pl-10"                          
          />
        </div>
      </div>

      {/* ---------- MAIN LAYOUT ---------- */}
      {selected ? (
        <ResizablePanelGroup
          direction="horizontal"
          className="flex-1 min-w-0 h-[calc(100vh-10rem)]"
        >
          {/* Left = table */}
          {/* <ResizablePanel
            defaultSize={70}
            minSize={20}
            maxSize={80}
            className="pr-2 overflow-auto"
          >
            {TableCard}
          </ResizablePanel> */}
          {/* Left = table */}
          <ResizablePanel
            defaultSize={70}
            minSize={20}
            maxSize={80}
            className="pr-2 overflow-auto"
          >
            <InvestorPortfolioCard
              rows={rows}
              loading={rows.length === 0 && page === 1}
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}          // keeps paging state in parent
              onSelectRow={handleRowSelect}      // open the right-side drawer
              quickFilter={quickFilter} 
            />
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
                            <TableCell className="truncate align-top" title={fmtDateListStr(h.sub_date)}>{fmtDateList(h.sub_date)}</TableCell>
                            <TableCell className="truncate align-top" title={fmtDateListStr(h.data_cutoff)}>{fmtDateList(h.data_cutoff)}</TableCell>
                            <TableCell className="truncate text-right align-top" title={fmtNumListStr(h.subscribed)}>{fmtNumList(h.subscribed)}</TableCell>
                            <TableCell className="truncate text-right align-top" title={fmtNumListStr(h.market_value)}>{fmtNumList(h.market_value)}</TableCell>
                            <TableCell className="truncate text-right" title={fmtNum(h.total_after_int)}>{fmtNum(h.total_after_int)}</TableCell>
                            <TableCell
                              className={`text-right ${h.pnl_pct === "NA"
                                ? "text-muted-foreground"
                                : Number(h.pnl_pct) > 0
                                  ? "text-green-600"
                                  : "text-destructive"
                                }`}
                            >
                              {h.pnl_pct === "NA"
                                ? "NA"
                                : `${Number(h.pnl_pct) > 0 ? "+" : ""}${h.pnl_pct
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

            {/* report-PDF button */}
            <div className="flex justify-center pt-4">
              {/* <ReportGeneratorDialog
                defaultInvestor={selected.investor ?? ""}
                defaultTableData={tableRowsForPdf}
              /> */}
              <ReportGeneratorDialog key={selected.investor} defaultInvestor={selected.investor ?? ""} />
            </div>

            {/* ── ❷ Latest-holdings-across-all-funds table ─────────────────── */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Latest Holdings&nbsp;(per&nbsp;Fund)</CardTitle>
              </CardHeader>

              <CardContent className="p-6">
                <div className="overflow-x-auto">
                  <Table className="w-full table-fixed border-collapse [&_th]:truncate">
                    <colgroup>
                      {["48%", "16%", "18%", "18%"].map((w, i) => (
                        <col key={i} style={{ width: w }} />
                      ))}
                    </colgroup>

                    <TableHeader>
                      <TableRow>
                        <TableHead>Fund Name</TableHead>
                        <TableHead className="whitespace-nowrap">
                          Snapshot&nbsp;Date
                        </TableHead>
                        <TableHead className="text-right">Number&nbsp;Held</TableHead>
                        <TableHead className="text-right">NAV&nbsp;Value</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {loadingLatest ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center">
                            Loading…
                          </TableCell>
                        </TableRow>
                      ) : latestHoldings.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center">
                            No data
                          </TableCell>
                        </TableRow>
                      ) : (
                        latestHoldings.map((h, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="whitespace-pre-line break-words" title={h.fund_name}>{h.fund_name}</TableCell>
                            <TableCell className="truncate">{new Date(h.snapshot_date).toLocaleDateString("en-CA")}</TableCell>
                            <TableCell className="truncate text-right font-mono">{h.number_held.toLocaleString()}</TableCell>
                            <TableCell className="truncate text-right font-mono">{usdStd(h.nav_value)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* ── ❸ Dividend-history table ─────────────────────────────── */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Dividend&nbsp;History</CardTitle>
              </CardHeader>

              <CardContent className="p-6">
                <div className="overflow-x-auto">
                  <Table className="w-full table-fixed border-collapse [&_th]:truncate">
                    <colgroup>
                      {["60%", "20%", "20%"].map((w, i) => (
                        <col key={i} style={{ width: w }} />
                      ))}
                    </colgroup>

                    <TableHeader>
                      <TableRow>
                        <TableHead>Fund Name</TableHead>
                        <TableHead className="whitespace-nowrap">Paid&nbsp;Date</TableHead>
                        <TableHead className="text-right">Amount&nbsp;(USD)</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {loadingDivs ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center">
                            Loading…
                          </TableCell>
                        </TableRow>
                      ) : divRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center">
                            No data
                          </TableCell>
                        </TableRow>
                      ) : (
                        divRows.map((d, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="whitespace-pre-line break-words" title={d.fund_category}>
                              {d.fund_category}
                            </TableCell>
                            <TableCell className="truncate">
                              {new Date(d.paid_date).toLocaleDateString("en-CA")}
                            </TableCell>
                            <TableCell className="truncate text-right font-mono text-green-700">
                              {usdStd(+d.amount)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* download CTA */}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        // TableCard
        <InvestorPortfolioCard
          rows={rows}
          loading={rows.length === 0 && page === 1}
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          onSelectRow={handleRowSelect}
          quickFilter={quickFilter} 
        />
      )}
    </div>
  );
}
