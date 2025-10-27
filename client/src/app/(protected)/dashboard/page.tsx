"use client";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { KPICard } from "./KPICard";
import GaugeRing from "./GaugeRing";
import { usdStd, usdAxisTick, uiMonthToIso, monthYearLabel } from "@/lib/format";
import { Filter, DollarSign, TrendingUp, AlertTriangle, Clock3, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { Line, Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler } from "chart.js";
import type { TooltipItem } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5003";

/* ─── Helper styles ─────────────────────────────────── */
const chartBox = "relative w-full h-[300px] min-w-0";

type UnsettledRow = {
  investor_name: string;
  amount: string;
  trade_date: string;
};

type Fund = { fund_id: number; fund_name: string };

// ▼ Fund-level (NAV) area chart states
type FundLevelRow = {
  fund_id?: number | null;
  fund_name: string;
  class_name: string;
  date: string; // "YYYY-MM"
  nav: number | null;
  return_pct: number | null;
  class_ytd_pct: number | null;
};

type DealRow = { dealing_date: string; daily_amount: string; submission_date: string };

export default function DashboardPage() {
  /* get fund names */
  const [funds, setFunds] = useState<Fund[]>([]);
  const [fundId, setFundId] = useState<number | null>(null);

  /* Net-cash KPI & history */
  const [netCashHistory, setNetCashHistory] = useState<{ statement_date: string; closing_avail: string }[]>([]);
  const [monthOptions, setMonthOptions] = useState<string[]>([]);
  const [monthFilter, setMonthFilter] = useState<string>(""); // dropdown value
  const [monthValue, setMonthValue] = useState<string>("—");

  /* AUM KPI (snapshot list with paging) */
  const [aumRows, setAumRows] = useState<{ snapshot: string; nav_total: string }[]>([]);
  const [aumOptions, setAumOptions] = useState<string[]>([]);
  const [aumSelected, setAumSelected] = useState<string>(""); // dropdown value
  const [aumValue, setAumValue] = useState<string>("—");
  const [aumNextAfter, setAumNextAfter] = useState<string | null>(null);

  /* Unsettled redemptions */
  const [redempRows, setRedempRows] = useState<UnsettledRow[]>([]);

  // ▼ Fund-level (NAV) — 與外層 fundId 同步；僅保留 Class 可選
  const [flClass, setFlClass] = useState<string>(""); // selected class
  const [flClassOpts, setFlClassOpts] = useState<string[]>([]);
  const [flRows, setFlRows] = useState<FundLevelRow[]>([]);

  /* NAV vs. Dividend bar-chart */
  const [navRows, setNavRows] = useState<{ period: string; nav: string; dividend: string }[]>([]);

  /* Unsettled-redemption cut-off dates */
  const [dealRows, setDealRows] = useState<DealRow[]>([]);
  const [unsettledOpts, setUnsettledOpts] = useState<string[]>([]);
  const [unsettledDate, setUnsettledDate] = useState<string>("");

  /* client-side “last updated” stamp */
  const [clientTime, setClientTime] = useState<string>("");
  useEffect(() => {
    setClientTime(new Date().toLocaleString());
  }, []);

  // who can edit?
  const [role, setRole] = useState<string>("user");
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
        if (!mounted) return;
        if (r.ok) {
          const j = await r.json();
          const newRole = j?.user?.role ?? "user";
          setRole(newRole);
          try {
            localStorage.setItem("fp_role", newRole);
          } catch {}
        } else {
          const cached = localStorage.getItem("fp_role");
          if (cached) setRole(cached);
        }
      } catch {
        const cached = localStorage.getItem("fp_role");
        if (cached) setRole(cached);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const isSuper = role === "super";

  // Annualized Dividend Yield (%) storage, per fund
  const [divAnnualized, setDivAnnualized] = useState<Record<string, number>>({});
  const [yieldDialogOpen, setYieldDialogOpen] = useState(false);

  // years present in the NAV/Dividend dataset (e.g. ["2024", "2025"])
  const yearsInChart = useMemo(() => [...new Set(navRows.map((r) => String(r.period).slice(0, 4)))], [navRows]);

  // Load dividend yields on fund change
  useEffect(() => {
    if (fundId == null) {
      setDivAnnualized({});
      return;
    }
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/dashboard/dividend-yields?fund_id=${fundId}`, {
          credentials: "include",
        });
        setDivAnnualized(r.ok ? await r.json() : {});
      } catch {
        setDivAnnualized({});
      }
    })();
  }, [fundId]);

  // dialog draft model
  const [draftRates, setDraftRates] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!yieldDialogOpen) return;
    const d: Record<string, string> = {};
    yearsInChart.forEach((y) => {
      d[y] = divAnnualized[y]?.toString() ?? "";
    });
    setDraftRates(d);
  }, [yieldDialogOpen, yearsInChart, divAnnualized]);

  const handleSaveYield = async () => {
    if (fundId == null || !isSuper) return;
    const rawEntries: [string, number][] = Object.entries(draftRates).map(([y, v]): [string, number] => [
      y,
      (v ?? "").trim() === "" ? NaN : Number(v),
    ]);
    const validEntries: [string, number][] = rawEntries.filter(([, n]) => Number.isFinite(n) && n >= 0 && n <= 100);
    const rates: Record<string, number> = Object.fromEntries(validEntries);
    const delete_years: number[] = yearsInChart
      .filter((y) => ((draftRates[y] ?? "").trim() === "") && divAnnualized[y] != null)
      .map((y) => Number(y));

    try {
      const r = await fetch(`${API_BASE}/dashboard/dividend-yields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fund_id: fundId, rates, delete_years }),
      });
      if (!r.ok) throw new Error(await r.text());
      setDivAnnualized((prev) => {
        const next = { ...prev };
        delete_years.forEach((y) => delete (next as any)[String(y)]);
        validEntries.forEach(([y, n]) => {
          (next as any)[y] = n;
        });
        return next;
      });
      setYieldDialogOpen(false);
    } catch (err) {
      console.error("Failed to save dividend yields:", err);
    }
  };

  /* fetch funds once ------------------------------------------------ */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/funds`, { credentials: "include" });
        const j: Fund[] = await r.json();
        setFunds(j);
        if (!fundId && j.length) setFundId(j[0].fund_id); // default pick
      } catch (e) {
        console.error("fund list fetch:", e);
      }
    })();
  }, []);

  /* -------- fetch both endpoints once ----------------------- */
  useEffect(() => {
    if (fundId === null) return;
    const qp = `fund_id=${fundId}`;

    (async () => {
      try {
        const [ncRes, urRes, ndRes, aumRes, dcRes] = await Promise.all([
          fetch(`${API_BASE}/dashboard/net-cash?${qp}`, { credentials: "include" }),
          fetch(`${API_BASE}/dashboard/unsettled-redemption?${qp}`, { credentials: "include" }),
          fetch(`${API_BASE}/dashboard/nav-value-totals-vs-div?${qp}`, { credentials: "include" }),
          fetch(`${API_BASE}/dashboard/aum?${qp}`, { credentials: "include" }),
          fetch(`${API_BASE}/dashboard/dealing-calendar?${qp}`, { credentials: "include" }),
        ]);

        /* --- Net-cash -------------------------------------------- */
        const ncJson = await ncRes.json();
        if (Array.isArray(ncJson.history)) {
          setNetCashHistory(ncJson.history);
          const opts: string[] = Array.from(
            new Set(
              ncJson.history.map((r: { statement_date: string }) =>
                new Date(r.statement_date).toLocaleString("en-US", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                }),
              ),
            ),
          );
          setMonthOptions(opts);
          if (!monthFilter && opts.length) setMonthFilter(opts[0]);
        }

        /* --- Unsettled redemptions --------------------------- */
        const urJson = await urRes.json();
        if (Array.isArray(urJson)) {
          setRedempRows(urJson);
          if (!unsettledDate && unsettledOpts.length) setUnsettledDate(unsettledOpts[0]);
        }

        /* --- NAV + Dividend rows ------------------------------ */
        setNavRows(await ndRes.json());

        /* --- AUM rows ---------------------------------------- */
        const aumJson = await aumRes.json();
        if (Array.isArray(aumJson) && aumJson.length) {
          setAumRows(aumJson);
          setAumOptions([...new Set(aumJson.map((r) => r.snapshot))]);
          setAumSelected(aumJson[0].snapshot);
          setAumValue(usdStd(+aumJson[0].nav_total));
          setAumNextAfter(aumJson.at(-1)!.snapshot);
        }

        /* --- Dealing calendar  -------------------------------- */
        const dcJson = await dcRes.json();
        if (Array.isArray(dcJson) && dcJson.length) {
          setDealRows(dcJson);
          const opts = dcJson.map((r: any) => r.dealing_date);
          setUnsettledOpts(opts);
          if (!unsettledDate && opts[0]) setUnsettledDate(opts[0]);
        } else {
          setDealRows([]);
          setUnsettledOpts([]);
          setUnsettledDate("");
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }
    })();
  }, [fundId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!monthFilter && monthOptions.length) setMonthFilter(monthOptions[0]);
  }, [monthOptions, monthFilter]);

  /* -------- whenever the month drop-down changes ------------ */
  useEffect(() => {
    if (!monthFilter || fundId === null) return;
    const iso = uiMonthToIso(monthFilter);
    const qp = `month=${iso}&fund_id=${fundId}`;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/dashboard/net-cash?${qp}`, { credentials: "include" });
        const json = await res.json();
        const row = json.history?.[0];
        setMonthValue(row ? usdStd(+row.closing_avail) : "—");
      } catch (e) {
        console.error("month fetch", e);
        setMonthValue("—");
      }
    })();
  }, [monthFilter, fundId]);

  useEffect(() => {
    if (!aumSelected) return;
    const row = aumRows.find((r) => r.snapshot === aumSelected);
    setAumValue(row ? usdStd(+row.nav_total) : "—");
  }, [aumSelected, aumRows]);

  /* ─────────── "load more" AUM – add fundId param ─────────── */
  const handleAumScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop + e.currentTarget.clientHeight < e.currentTarget.scrollHeight - 100) return;
    if (!aumNextAfter || fundId === null) return;

    const qp = `after=${aumNextAfter}&limit=30&fund_id=${fundId}`;
    try {
      const res = await fetch(`${API_BASE}/dashboard/aum?${qp}`, { credentials: "include" });
      const more = await res.json();

      if (Array.isArray(more) && more.length) {
        setAumRows((prev) => [...prev, ...more]);
        setAumOptions((prev) => [...new Set([...prev, ...more.map((r) => r.snapshot)])]);
        setAumNextAfter(more.at(-1)!.snapshot);
      } else {
        setAumNextAfter(null);
      }
    } catch (err) {
      console.error("load more AUM:", err);
    }
  };

  /* -------- derived metrics --------------------------------- */
  const pendingCount = redempRows.length;
  const requiredToday = (() => {
    const row = dealRows.find((r) => r.dealing_date === unsettledDate);
    return row ? Number(row.daily_amount) : null;
  })();

  const redempValue = requiredToday != null ? usdStd(requiredToday) : "—";
  const latestCash = netCashHistory[0] ? Number(netCashHistory[0].closing_avail) : null;
  const redempPct = latestCash && requiredToday ? (requiredToday / latestCash) * 100 : null;

  const pctLabel = redempPct != null ? `${redempPct.toFixed(1)}%` : "—";

  /* ───────── NEW: fetch class options for selected fund (DB) ───────── */
  useEffect(() => {
    setFlClass("");
    setFlClassOpts([]);

    if (fundId == null) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/dashboard/fund-classes?fund_id=${fundId}`, {
          credentials: "include",
        });
        const classes: string[] = res.ok ? await res.json() : [];
        setFlClassOpts(classes);
        if (classes.length) setFlClass((prev) => prev || classes[0]);
      } catch (e) {
        console.error("fund-classes fetch:", e);
        setFlClassOpts([]);
        setFlClass("");
      }
    })();
  }, [fundId]);

  /* ───────── NEW: fetch Fund-level rows from DB function (flat=true) ───────── */
  useEffect(() => {
    if (fundId == null || !flClass) {
      setFlRows([]);
      return;
    }

    (async () => {
      try {
        const q = new URLSearchParams({
          fund_id: String(fundId),
          class_name: flClass,
          flat: "true",
        });
        const res = await fetch(`${API_BASE}/dashboard/fund-level-db?${q.toString()}`, {
          credentials: "include",
        });
        const rows: Array<{
          fund_id: number;
          class_name: string;
          year: number;
          date: string;
          nav: number | null;
          return_pct: number | null;
          ytd_pct: number | null;
        }> = res.ok ? await res.json() : [];

        const mapped: FundLevelRow[] = rows
          .map((r) => ({
            fund_id: r.fund_id,
            fund_name: "",
            class_name: r.class_name,
            date: r.date,
            nav: r.nav,
            return_pct: r.return_pct,
            class_ytd_pct: r.ytd_pct, // ← 關鍵映射
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setFlRows(mapped);
      } catch (e) {
        console.error("fund-level-db fetch:", e);
        setFlRows([]);
      }
    })();
  }, [fundId, flClass]);

  /* ───────── Fund-level chart memo ───────── */
  const flChart = useMemo(() => {
    const rows = flRows.filter((r) => r.nav != null);
    if (!rows.length) {
      return {
        labels: [] as string[],
        datasets: [] as any[],
        ytdByYear: {} as Record<string, number | null>,
        meta: { idxNav: -1, idxRetLine: -1, idxRetPosFill: -1, idxRetNegFill: -1, idxBaseline: -1 },
      };
    }

    const labels = rows.map((r) => r.date);
    const navData = rows.map((r) => Number(r.nav));
    const pctRaw = rows.map((r) => (typeof r.return_pct === "number" ? Number(r.return_pct) : null));

    const retPosFill = pctRaw.map((v) => (v != null && v > 0 ? v : 0));
    const retNegFill = pctRaw.map((v) => (v != null && v < 0 ? v : 0));

    const byYear = new Map<string, FundLevelRow[]>();
    rows.forEach((r) => {
      const yr = r.date.slice(0, 4);
      if (!byYear.has(yr)) byYear.set(yr, []);
      byYear.get(yr)!.push(r);
    });
    const ytdByYear: Record<string, number | null> = {};
    for (const [yr, list] of byYear.entries()) {
      list.sort((a, b) => a.date.localeCompare(b.date));
      const last = list[list.length - 1];
      if (last.class_ytd_pct != null) {
        ytdByYear[yr] = Number(last.class_ytd_pct);
      } else {
        const vals = list.map((r) => r.return_pct).filter((x): x is number => typeof x === "number");
        if (!vals.length) {
          ytdByYear[yr] = null;
          continue;
        }
        let acc = 1;
        vals.forEach((v) => (acc *= 1 + v));
        ytdByYear[yr] = acc - 1;
      }
    }

    const idxRetPosFill = 0;
    const idxRetNegFill = 1;
    const idxNav = 2;
    const idxRetLine = 3;
    const idxBaseline = 4;

    return {
      labels,
      datasets: [
        {
          label: "__ret_pos_fill",
          yAxisID: "y1",
          data: retPosFill,
          fill: "origin",
          backgroundColor: "rgba(34,197,94,0.12)",
          borderWidth: 0,
          pointRadius: 0,
          tension: 0.35,
          spanGaps: true,
          order: 0,
        },
        {
          label: "__ret_neg_fill",
          yAxisID: "y1",
          data: retNegFill,
          fill: "origin",
          backgroundColor: "rgba(239,68,68,0.12)",
          borderWidth: 0,
          pointRadius: 0,
          tension: 0.35,
          spanGaps: true,
          order: 0,
        },
        {
          label: "NAV",
          yAxisID: "y",
          data: navData,
          fill: true,
          backgroundColor: "rgba(59,130,246,0.12)",
          borderColor: "#3b82f6",
          tension: 0.35,
          pointRadius: 0,
          spanGaps: true,
          order: 1,
        },
        {
          label: "Return %",
          yAxisID: "y1",
          data: pctRaw,
          fill: false,
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 0,
          spanGaps: true,
          order: 2,
          segment: {
            borderColor: (ctx: any) => {
              const y0 = ctx?.p0?.parsed?.y as number | undefined;
              const y1 = ctx?.p1?.parsed?.y as number | undefined;
              const mid = ((y0 ?? 0) + (y1 ?? 0)) / 2;
              return mid < 0 ? "#ef4444" : "#22c55e";
            },
          },
        },
        {
          label: "Return % baseline",
          yAxisID: "y1",
          data: labels.map(() => 0),
          borderColor: "#9ca3af",
          borderWidth: 1,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false,
          order: 3,
        },
      ],
      ytdByYear,
      meta: { idxNav, idxRetLine, idxRetPosFill, idxRetNegFill, idxBaseline },
    };
  }, [flRows]);

  /* Outstanding Redemptions helpers */
  const surplus = latestCash != null && requiredToday != null ? latestCash - requiredToday : null;
  const surplusLabel = surplus != null && surplus < 0 ? "Deficit" : "Surplus";
  const surplusClass = surplus != null && surplus < 0 ? "text-red-600 font-semibold" : "text-green-600";

  const allRedemptions = useMemo(() => {
    if (!redempRows.length || !latestCash) return [];
    return [...redempRows]
      .sort((a, b) => Math.abs(+b.amount) - Math.abs(+a.amount))
      .map((r) => {
        const amountAbs = Math.abs(+r.amount);
        const pctOfCash = +((amountAbs / latestCash) * 100).toFixed(1);
        return { investor: r.investor_name, amount: amountAbs, percentage: pctOfCash, date: r.trade_date.slice(0, 7) };
      });
  }, [redempRows, latestCash]);

  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);
  const pagedRedemptions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return allRedemptions.slice(start, start + PAGE_SIZE);
  }, [page, allRedemptions]);
  const pageCount = Math.ceil(allRedemptions.length / PAGE_SIZE);
  const topLabelCount = allRedemptions.length;

  useEffect(() => {
    setPage(1);
  }, [allRedemptions]);

  const netCashChart = useMemo(() => {
    if (!netCashHistory.length) return { labels: [], datasets: [] };
    const ordered = [...netCashHistory].sort(
      (a, b) => new Date(a.statement_date).getTime() - new Date(b.statement_date).getTime(),
    );
    return {
      labels: ordered.map((r) => r.statement_date.slice(0, 7)),
      datasets: [
        {
          label: "Net Cash",
          data: ordered.map((r) => Number(r.closing_avail)),
          fill: true,
          backgroundColor: "rgba(59,130,246,0.15)",
          borderColor: "#3b82f6",
          tension: 0.35,
          pointRadius: 0,
        },
      ],
    };
  }, [netCashHistory]);

  const navChart = useMemo(() => {
    if (!navRows.length) return { labels: [], datasets: [] };
    return {
      labels: navRows.map((r) => r.period),
      datasets: [
        { label: "NAV Value Totals", data: navRows.map((r) => Number(r.nav)), backgroundColor: "#3b82f6", borderRadius: 3 },
        { label: "Dividends", data: navRows.map((r) => Number(r.dividend)), backgroundColor: "#22c55e", borderRadius: 3 },
      ],
    };
  }, [navRows]);

  return (
    <div className="mx-auto w-full max-w-[95%] px-4 md:px-6 p-6 space-y-6">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* fund picker -------------------------------------------------- */}
          <Select value={fundId !== null ? String(fundId) : ""} onValueChange={(v) => setFundId(Number(v))}>
            <SelectTrigger className="min-w-[20rem]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Choose a fund" />
            </SelectTrigger>
            <SelectContent>
              {funds.map((f) => (
                <SelectItem key={f.fund_id} value={String(f.fund_id)}>
                  {f.fund_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <KPICard
          title="Net Cash"
          value={monthValue}
          change=""
          changeType="neutral"
          description=""
          icon={DollarSign}
          right={
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="h-7 w-36 text-xs">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent className="max-h-80 overflow-y-auto">
                {monthOptions.map((m, idx) => (
                  <SelectItem key={`${m}-${idx}`} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <KPICard
          title="AUM"
          value={aumValue}
          change=""
          changeType="positive"
          description=""
          icon={TrendingUp}
          right={
            <Select value={aumSelected} onValueChange={setAumSelected}>
              <SelectTrigger className="h-7 w-36 text-xs">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent onScroll={handleAumScroll} className="max-h-80 overflow-y-auto">
                {aumOptions.map((iso) => (
                  <SelectItem key={iso} value={iso}>
                    {monthYearLabel(iso)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <KPICard
          title="Unsettled Redemptions"
          value={<span className="text-red-600">{redempValue}</span>}
          change={`${pendingCount} pending`}
          changeType="neutral"
          description="Awaiting settlement"
          icon={AlertTriangle}
          right={
            <Select value={unsettledDate} onValueChange={setUnsettledDate}>
              <SelectTrigger className="h-7 w-40 text-xs">
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                {unsettledOpts.map((d) => (
                  <SelectItem key={d} value={d}>
                    {new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      </div>

      {/* charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ▼ LEFT: Fund Level (NAV) Area */}
        <Card>
          <CardHeader className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Fund Level (NAV)</CardTitle>
              {/* YTD pills */}
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(flChart.ytdByYear)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([yr, ytd]) => (
                    <span
                      key={yr}
                      className={`text-xs px-2 py-0.5 rounded ${
                        ytd != null && ytd < 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      }`}
                    >
                      {yr}: {ytd != null ? (ytd * 100).toFixed(2) : "—"}%
                    </span>
                  ))}
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              {/* 與外層 fundId 同步顯示，禁用不可選 */}
              <Select value={fundId != null ? String(fundId) : ""} disabled>
                <SelectTrigger className="w-56 h-8 text-xs">
                  <SelectValue placeholder="Choose Fund" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {funds.map((f) => (
                    <SelectItem key={f.fund_id} value={String(f.fund_id)}>
                      {f.fund_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={flClass} onValueChange={setFlClass}>
                <SelectTrigger className="w-56 h-8 text-xs">
                  <SelectValue placeholder="Choose Class" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {flClassOpts.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent>
            <div className="relative w-full h-[300px]">
              <Line
                data={{ labels: flChart.labels, datasets: flChart.datasets }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: "index", intersect: false },
                  plugins: {
                    legend: {
                      display: true,
                      position: "top",
                      align: "center",
                      labels: {
                        usePointStyle: false,
                        generateLabels(chart) {
                          const ds = chart.data.datasets || [];
                          const meta = (flChart as any)?.meta || {};
                          const items: any[] = [];
                          if (meta.idxNav >= 0 && ds[meta.idxNav]) {
                            items.push({
                              text: "NAV",
                              fillStyle: "#3b82f6",
                              strokeStyle: "#3b82f6",
                              lineWidth: 0,
                              hidden: !chart.isDatasetVisible(meta.idxNav),
                              datasetIndex: meta.idxNav,
                            });
                          }
                          if (meta.idxRetLine >= 0 && ds[meta.idxRetLine]) {
                            items.push({
                              text: "Return %",
                              fillStyle: "#22c55e",
                              strokeStyle: "#22c55e",
                              lineWidth: 0,
                              hidden: !chart.isDatasetVisible(meta.idxRetLine),
                              datasetIndex: meta.idxRetLine,
                            });
                          }
                          return items;
                        },
                      },
                      onClick(e, item, legend) {
                        const chart = legend.chart as any;
                        const meta = (flChart as any)?.meta || {};

                        if (item.text === "NAV" && meta.idxNav >= 0) {
                          chart.setDatasetVisibility(meta.idxNav, !chart.isDatasetVisible(meta.idxNav));
                          chart.update();
                          return;
                        }
                        if (item.text === "Return %" && meta.idxRetLine >= 0) {
                          const next = !chart.isDatasetVisible(meta.idxRetLine);
                          chart.setDatasetVisibility(meta.idxRetLine, next);
                          if (meta.idxRetPosFill >= 0) chart.setDatasetVisibility(meta.idxRetPosFill, next);
                          if (meta.idxRetNegFill >= 0) chart.setDatasetVisibility(meta.idxRetNegFill, next);
                          if (meta.idxBaseline >= 0) chart.setDatasetVisibility(meta.idxBaseline, next);
                          chart.update();
                        }
                      },
                    },
                    tooltip: {
                      enabled: true,
                      backgroundColor: "rgba(31,41,55,0.9)",
                      titleFont: { weight: 600 },
                      padding: 10,
                      filter: (ctx) => {
                        const lbl = ctx.dataset?.label;
                        return lbl !== "__ret_pos_fill" && lbl !== "__ret_neg_fill" && lbl !== "Return % baseline";
                      },
                      callbacks: {
                        title: (ctx) => ctx[0].label,
                        label: (ctx) => {
                          if (ctx.dataset.yAxisID === "y1") {
                            const p = typeof ctx.parsed.y === "number" ? (ctx.parsed.y * 100).toFixed(2) : "—";
                            return ` Return ${p}%`;
                          }
                          return ` NAV ${usdAxisTick(Number(ctx.parsed.y))}`;
                        },
                      },
                    },
                  },
                  scales: {
                    y: {
                      position: "left",
                      ticks: { callback: (v) => usdAxisTick(Number(v)), padding: 6 },
                      title: { display: true, text: "NAV", color: "#6b7280", font: { weight: 600 } },
                      grid: { color: "rgba(0,0,0,0.05)" },
                    },
                    y1: {
                      position: "right",
                      grid: { drawOnChartArea: false },
                      ticks: { callback: (v) => `${(Number(v) * 100).toFixed(2)}%`, padding: 6 },
                      title: { display: true, text: "Return %", color: "#6b7280", font: { weight: 600 } },
                      suggestedMin: -0.06,
                      suggestedMax: 0.06,
                    },
                    x: { grid: { display: false } },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>NAV Value Totals vs Dividends</CardTitle>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">Annualized Dividend Yield (%)</span>
                {yearsInChart.map((y) => (
                  <Badge key={y} variant="secondary" className="font-mono">
                    {y}: {divAnnualized[y] != null ? divAnnualized[y].toFixed(2) : "—"}%
                  </Badge>
                ))}
              </div>
              {isSuper && (
                <Button variant="ghost" size="icon" onClick={() => setYieldDialogOpen(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent>
            <div className={chartBox}>
              <Bar
                data={navChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "top" } },
                  scales: { x: { grid: { display: false } }, y: { grid: { color: "rgba(0,0,0,0.05)" } } },
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Annualized Dividend Yield editor ───────────────────────────── */}
        <Dialog open={isSuper && yieldDialogOpen} onOpenChange={(open) => isSuper && setYieldDialogOpen(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Annualized Dividend Yield (%)</DialogTitle>
              <p className="text-xs text-muted-foreground">中文：派息年化%</p>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {yearsInChart.length ? (
                yearsInChart.map((y) => (
                  <div key={y} className="space-y-1">
                    <Label htmlFor={`yield-${y}`}>{y}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`yield-${y}`}
                        inputMode="decimal"
                        placeholder="e.g. 6.5"
                        value={draftRates[y] ?? ""}
                        onChange={(e) => setDraftRates((prev) => ({ ...prev, [y]: e.target.value }))}
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No years detected from chart data.</div>
              )}
            </div>

            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => setYieldDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveYield}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Outstanding Redemptions widget */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-lg">Outstanding Redemptions</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LEFT : analysis + gauge */}
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Analysis&nbsp;for&nbsp;
                {unsettledDate
                  ? new Date(unsettledDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                  : "—"}
              </p>
              <div className="flex justify-center">
                <GaugeRing percentage={redempPct ?? 0} label={pctLabel} />
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Net Cash</span>
                  <span className="font-medium">{latestCash ? usdStd(latestCash) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Required for Redemption</span>
                  <span className="text-destructive">{requiredToday != null ? usdStd(requiredToday) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{surplusLabel}</span>
                  <span className={surplusClass}>{surplus != null ? usdStd(surplus) : "—"}</span>
                </div>
              </div>

              {(() => {
                const msPerDay = 86_400_000;
                const row = dealRows.find((r) => r.dealing_date === unsettledDate);
                const deadline = row ? new Date(`${row.submission_date}T00:00:00Z`) : null;
                const daysLeft = deadline ? Math.ceil((deadline.getTime() - Date.now()) / msPerDay) : null;

                let badgeColour = "bg-green-600";
                if (daysLeft != null) {
                  if (daysLeft <= 0) badgeColour = "bg-red-600";
                  else if (daysLeft <= 30) badgeColour = "bg-yellow-400 text-black";
                }

                return (
                  <div className="border rounded-md p-3 flex flex-col justify-between lg:flex-row lg:items-center">
                    <div>
                      <p className="font-medium leading-none mb-1 flex items-center gap-1">
                        <Clock3 className="w-3.5 h-3.5" />
                        Funding&nbsp;Application&nbsp;Deadline
                      </p>
                      <p className="text-xs font-semibold">
                        Apply&nbsp;by:&nbsp;
                        {deadline
                          ? deadline.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                          : "—"}
                      </p>
                    </div>
                    {daysLeft != null && <Badge className={`text-xs px-2 py-0.5 ${badgeColour}`}>{daysLeft}&nbsp;days</Badge>}
                  </div>
                );
              })()}
            </div>

            {/* RIGHT : list */}
            <div className="lg:pl-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Top&nbsp;{topLabelCount}&nbsp;Redemption&nbsp;Requests</h4>
                <Badge variant="outline" className="text-destructive border-destructive">
                  {redempPct ? `${redempPct.toFixed(1)}% of Net Cash` : "—"}
                </Badge>
              </div>

              {pagedRedemptions.map((row, idx) => (
                <div key={`${row.investor}-${idx}`} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium flex items中心 gap-2">
                      {row.investor}
                      <Badge variant="secondary" className="text-xs px-2 py-0.5">
                        {row.date}
                      </Badge>
                    </span>
                    <span className="text-destructive">
                      {usdStd(row.amount)} ({row.percentage}%)
                    </span>
                  </div>
                  <Progress value={row.percentage} className="h-2 [&>div[role=progressbar]]:bg-blue-500" />
                </div>
              ))}

              {pageCount > 1 && (
                <Pagination className="pt-3 justify-center mt-auto">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={page === 1 ? undefined : () => setPage((p) => Math.max(1, p - 1))}
                        aria-disabled={page === 1}
                        className={page === 1 ? "cursor-not-allowed opacity-50" : ""}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="mx-3 text-xs select-none">
                        {page} / {pageCount}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        onClick={page === pageCount ? undefined : () => setPage((p) => Math.min(pageCount, p + 1))}
                        aria-disabled={page === pageCount}
                        className={page === pageCount ? "cursor-not-allowed opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>$ Net Cash Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={chartBox}>
            <Line
              data={netCashChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    enabled: true,
                    backgroundColor: "rgba(31,41,55,0.9)",
                    titleFont: { weight: 600 },
                    padding: 10,
                    callbacks: {
                      title: (items: TooltipItem<"line">[]) => items[0]?.label ?? "",
                      label: (item: TooltipItem<"line">) => ` ${usdAxisTick(Number(item.parsed.y))}`,
                    },
                  },
                },
                scales: {
                  x: { grid: { display: false } },
                  y: {
                    ticks: { callback: (value) => usdAxisTick(Number(value)), padding: 6 },
                    title: { display: true, text: "USD", font: { weight: 600 }, color: "#6b7280" },
                    grid: { color: "rgba(0,0,0,0.05)" },
                  },
                },
              }}
            />
          </div>
        </CardContent>
      </Card>

      <footer className="flex justify-between text-sm text-muted-foreground">
        <span suppressHydrationWarning>Last&nbsp;updated:&nbsp;{clientTime || "—"}</span>
      </footer>
    </div>
  );
}
