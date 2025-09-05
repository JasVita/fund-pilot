"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { X, Search, Download, ArrowUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import InvestorPortfolioCard from "./InvestorPortfolioCard";
import type { Investor } from "./InvestorPortfolioTable";

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import ReportGeneratorButton from "./tables/ReportGeneratorButton";
import PPTGeneratorButton  from "./tables/PPTGeneratorButton";

/* NEW imports for shared formatters */
import { fmtNum } from "@/lib/format";
import { fmtDateListStr, fmtNumListStr } from "@/lib/report-format";

/* ---- helpers ----------------------------------------------------- */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5103";

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

/* simple USD fmt so it matches your style */
const usdStd = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(v);

/* ---- types ------------------------------------------------------- */

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

// --- add near your other types ---
type FileRow = {
  id: number;
  filename: string;
  type: "is" | "cn" | "other";
  class: string;
  date: string;           // ISO
  size_bytes?: number;
};

const MOCK_FILES: FileRow[] = [
  { id: 1, filename: "Feng_Fan_20220228.pdf", type: "is", class: "Class A - Lead", date: "2022-02-28" },
  { id: 2, filename: "CN_213602974.pdf",      type: "cn", class: "—",              date: "2025-07-14" },
  // add more if you want to fill the table…
];

const USE_MOCK_FILES = true;
// Keep filename readable but short (preserve extension)
const FILE_NAME_MAX = 32;
function middleEllipsis(name: string, max = FILE_NAME_MAX) {
  if (!name || name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot) : "";
  const base = dot > 0 ? name.slice(0, dot) : name;

  const keep = Math.max(3, max - ext.length - 1); // 1 for ellipsis
  const head = Math.ceil(keep * 0.6);
  const tail = keep - head;
  return `${base.slice(0, head)}…${base.slice(-tail)}${ext}`;
}

function FilesTable({
  rows,
  loading,
  title,
}: {
  rows: { id:number; filename:string; type:"is"|"cn"|"other"; class:string; date:string; size_bytes?:number }[];
  loading: boolean;
  title?: string;
}) {
  const typeLabel = (t: "is"|"cn"|"other") =>
    t === "is" ? "Investor Statement" : t === "cn" ? "Contract Note" : "Other";

  const fmtDate = (s: string) => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-CA");
  };

  // ── inline filters & sort state ──────────────────────────────
  const [typeFilter, setTypeFilter]   = useState<"all"|"is"|"cn"|"other">("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [dateSort, setDateSort]       = useState<"desc"|"asc">("desc");

  const dateLabel = dateSort === "desc" ? "Date ↓" : "Date ↑";

  // unique class options from current data
  const classOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.class || "—");
    return Array.from(set);
  }, [rows]);

  // filtered + sorted rows (client-side)
  const visibleRows = useMemo(() => {
    const filtered = rows.filter(r => {
      const mt = typeFilter === "all" || r.type === typeFilter;
      const mc = classFilter === "all" || (r.class || "—") === classFilter;
      return mt && mc;
    });
    const dir = dateSort === "desc" ? -1 : 1;
    return filtered.sort(
      (a, b) => (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir
    );
  }, [rows, typeFilter, classFilter, dateSort]);

  // columns add up to 100% (keeps table inside card)
  const COLS = ["36%", "22%", "20%", "12%", "10%"] as const;

  return (
    <Card className="mt-4 min-w-0">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          {title ?? "Files"}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6">
        <div className="overflow-x-hidden">
          <Table className="w-full table-fixed border-collapse [&_th]:align-top [&_th]:pt-0.5 [&_th]:pb-2 [&_th]:truncate [&_td]:truncate">
            <colgroup>
              {COLS.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>

            <TableHeader>
              <TableRow>
                {/* File name stays a plain label */}
                <TableHead className="whitespace-nowrap">File name</TableHead>

                {/* Type header = Select itself */}
                <TableHead className="align-middle">
                  <Select value={typeFilter} onValueChange={(v)=>setTypeFilter(v as any)}>
                    <SelectTrigger className="h-7 w-full text-xs">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="is">Investor Statement</SelectItem>
                      <SelectItem value="cn">Contract Note</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </TableHead>

                {/* Class header = Select itself */}
                <TableHead className="align-middle">
                  <Select value={classFilter} onValueChange={setClassFilter}>
                    <SelectTrigger className="h-7 w-full text-xs">
                      <SelectValue placeholder="All classes" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="all">All classes</SelectItem>
                      {classOptions.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableHead>

                {/* Date header = sort button with dynamic label */}
                <TableHead className="align-middle">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setDateSort(dateSort === "desc" ? "asc" : "desc")}
                    title={`Sort by date ${dateSort === "desc" ? "ascending" : "descending"}`}
                  >
                    {dateLabel}
                  </Button>
                </TableHead>

                {/* Download header keeps text so the column is clear */}
                <TableHead className="text-right whitespace-nowrap pr-1">Download</TableHead>
              </TableRow>
            </TableHeader>


            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Loading…</TableCell>
                </TableRow>
              ) : visibleRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">No files</TableCell>
                </TableRow>
              ) : (
                visibleRows.map((r, idx) => (
                  <TableRow key={r.id ?? idx}>
                    <TableCell title={r.filename}>
                      <button
                        className="block w-full text-left text-primary hover:underline truncate"
                        onClick={() => { /* TODO: /files/signed-url?disposition=inline */ }}
                      >
                        {middleEllipsis(r.filename)}
                      </button>
                    </TableCell>

                    <TableCell title={typeLabel(r.type)}>{typeLabel(r.type)}</TableCell>
                    <TableCell title={r.class || "—"}>{r.class || "—"}</TableCell>
                    <TableCell title={fmtDate(r.date)}>{fmtDate(r.date)}</TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 p-0"
                        onClick={() => { /* TODO: /files/signed-url?disposition=attachment */ }}
                        aria-label={`Download ${r.filename}`}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}


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

  // --- add new state (below your other useState calls) ---
  const [filesInvestor, setFilesInvestor] = useState<string | null>(null);
  const [filesRows, setFilesRows] = useState<FileRow[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  
  /* ----------------------------------------------------------------
     ✦ NEW  handleRowSelect adapter
     Keeps type-safety between InvestorRow → Investor
  ------------------------------------------------------------------ */
  const handleRowSelect = useCallback(
    (row: Investor) => {
      setFilesInvestor(null);    
      let target = row;
      if (!row.investor || row.investor.trim() === "") {
        const idx = rows.findIndex(r => r === row);
        const prevNamed = [...rows].slice(0, idx).reverse()
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
    if (!selected) { 
      setDivRows([]);
      return;
    }

    (async () => {
      try {
        setLoadingDivs(true);

        const url = `${API_BASE}/investors/holdings/dividends` + `?investor=${encodeURIComponent(selected.investor ?? "")}`;
        const res = await fetch(url, { credentials: "include" });

        /* ── A. graceful handling when the API returns 404 ───────── */
        if (res.status === 404) {        // “no dividend records” sentinel
          setDivRows([]);                // just show an empty table
          return;                        // ⇠ stop here – don’t .json()
        }
        if (!res.ok) throw new Error(res.statusText);

        const j: { rows?: DividendRow[] } = await res.json();
        setDivRows(Array.isArray(j.rows) ? j.rows : []);

      } catch (err) {
        console.error("dividends fetch:", err);
        setDivRows([]);                  // keep state an array on error
      } finally {
        setLoadingDivs(false);
      }
    })();
  }, [selected]);   

  useEffect(() => {
    if (!filesInvestor || selectedFund == null) { setFilesRows([]); return; }
    setLoadingFiles(true);

    // Always show mock first
    setFilesRows(MOCK_FILES);

    // Only try the API if you flip the flag
    if (!USE_MOCK_FILES) {
      (async () => {
        try {
          const u = new URL(`${API_BASE}/files`);
          u.searchParams.set("fund_id", String(selectedFund));
          u.searchParams.set("investor", filesInvestor);
          u.searchParams.set("page", "1");
          u.searchParams.set("page_size", "50");
          const r = await fetch(u, { credentials: "include" });
          if (r.ok) {
            const j = await r.json() as { rows?: FileRow[] };
            if (Array.isArray(j.rows)) setFilesRows(j.rows);
          }
        } finally {
          setLoadingFiles(false);
        }
      })();
    } else {
      setLoadingFiles(false);
    }
  }, [filesInvestor, selectedFund]);


  /* ------------------------------------------------------------------ *
   *  UX helpers
   * ------------------------------------------------------------------ */
  const changeFund = (v: string) => {
    setSelectedFund(Number(v));            // 1) switch fund
    setPage(1);                    // 2) reset paging
    setSelected(null);             // 3) close any drawer
    setFilesInvestor(null);  
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
      {(selected || filesInvestor) ? (
        <ResizablePanelGroup
          direction="horizontal"
          className="flex-1 min-w-0 h-[calc(100vh-10rem)]"
        >
          {/* Left = investors table */}
          <ResizablePanel
            defaultSize={filesInvestor ? 55 : 60} 
            minSize={20}
            maxSize={80}
            className="pr-2 overflow-auto min-w-0"
          >
            <InvestorPortfolioCard
              rows={rows}
              loading={rows.length === 0 && page === 1}
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              onSelectRow={handleRowSelect}
              quickFilter={quickFilter}
              onOpenFiles={(row) => {
                if (!selected) setSelected(row);                      // (optional) clear details selection
                setFilesInvestor(row.investor ?? null); // 🟢 FILES mode
              }}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right = detail */}
          <ResizablePanel
            defaultSize={filesInvestor ? 45 : 40}              // or keep your {filesInvestor ? 30 : 40}
            minSize={20}
            maxSize={80}  
            className="min-w-0 flex flex-col overflow-auto p-6 space-y-4 bg-background shadow-lg relative">
            {/* 🔀 Switch the panel body based on mode */}
            {filesInvestor ? (
              // -------------------- FILES MODE --------------------
              <FilesTable
                rows={filesRows}
                loading={loadingFiles}
                title={`Files — ${filesInvestor}`}
              />
            ) : selected ? (
              // -------------------- DETAILS MODE --------------------
              <>
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
            <div className="flex flex-wrap gap-4 pt-4 justify-center ">
              {/* PDF on the left  ─────────────────────────────────────────── */}
              <ReportGeneratorButton key={selected.investor} defaultInvestor={selected.investor ?? ""} fundId={selectedFund ?? undefined} className="flex-1 sm:flex-none mx-auto max-w-[220px]o"/>
              {/* PPT on the right ─────────────────────────────────────────── */}
              <PPTGeneratorButton defaultInvestor={selected.investor ?? ""} fundId={selectedFund ?? undefined}  className="flex-1 sm:flex-none mx-auto max-w-[220px]" />
            </div>

            {/* ── ❷ Latest-holdings-across-all-funds table ─────────────────── */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Latest&nbsp;Holdings&nbsp;(per&nbsp;Fund)</CardTitle>
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
                        <TableHead>Fund&nbsp;Name</TableHead>
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
                            No&nbsp;data
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
              </>
            ) : (
              /* EMPTY STATE */
              <div className="text-sm text-muted-foreground">
                Select an investor to view details, or click a “Details” badge to view files.
              </div>
            )}
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
          onOpenFiles={(row) => {
            if (!selected) setSelected(row);                       // (optional) clear details selection
            setFilesInvestor(row.investor ?? null); // 🟢 FILES mode
          }}
        />
      )}
    </div>
  );
}
