"use client";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { KPICard } from "./KPICard";
import { Download, Filter, Calendar, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";

import { Line, Bar, Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler } from "chart.js";

ChartJS.register( CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler );

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5103";

/* ─── money formatter ─────────────────────────────────────── */
const usdCompact = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(v);

/* ─── Helper styles ─────────────────────────────────── */
const chartBox = "relative w-full h-[300px]";

const usdAxis = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,  // whole-dollar ticks
    notation: "compact",       // "12.3M" / "876K" / "45K"
  }).format(v);

type UnsettledRow = {
  investor_name: string;
  nav_delta: string;      // negative number as a string
  snapshot_date: string;  // e.g. "2025-01-28T00:00:00.000Z"
};
/* ─── Component ─────────────────────────────────────── */
export default function DashboardPage() {
  /* -------- state ------------------------------------------- */
  const [netCashLatest, setNetCashLatest] = useState<string>("—");
  const [netCashHistory, setNetCashHistory] = useState<{ month_start: string; closing_avail: string }[]>([]);

  const [redempRows, setRedempRows] = useState<UnsettledRow[]>([]);

  const [redempSum, setRedempSum] = useState<number | null>(null);
  const [navRows, setNavRows] = useState<{ period: string; nav: string; dividend: string }[]>([]);

  /* -------- fetch both endpoints once ----------------------- */
  useEffect(() => {
    (async () => {
      try {
        const [ncRes, urRes, ndRes] = await Promise.all([
          fetch(`${API_BASE}/dashboard/net-cash`, { credentials: "include" }),
          fetch(`${API_BASE}/dashboard/unsettled-redemption`, { credentials: "include" }),
          fetch(`${API_BASE}/dashboard/nav-value-totals-vs-div`, { credentials: "include" }),
          // fetch(`${API_BASE}/dashboard/net-cash`),
          // fetch(`${API_BASE}/dashboard/unsettled-redemption`),
          // fetch(`${API_BASE}/dashboard/nav-value-totals-vs-div`),
        ]);

        /* --- Net-cash --------------------------------------- */
        // const ncJson: {
        //   latest: number | null;
        //   history: { month_start: string; closing_avail: string }[];
        // } = await ncRes.json();

        // if (ncJson.latest != null) setNetCashLatest(usdCompact(ncJson.latest));
        // setNetCashHistory(ncJson.history);
        const ncJson = await ncRes.json();
        if (Array.isArray(ncJson.history)) {
          setNetCashHistory(ncJson.history);
          if (ncJson.latest != null) {
            setNetCashLatest(usdCompact(ncJson.latest));
          }
        }

        /* --- Unsettled redemptions -------------------------- */
        // const urRows: UnsettledRow[] = await urRes.json();
        // setRedempRows(urRows);
        // setRedempSum(urRows.reduce((acc: number, r: any) => acc + Math.abs(+r.nav_delta), 0));
        const urJson = await urRes.json();
        if (Array.isArray(urJson)) {
          setRedempRows(urJson);
          setRedempSum(
            urJson.reduce((acc: number, r: any) => acc + Math.abs(+r.nav_delta), 0)
          );
        }

        /* --- NAV + Dividend rows ------------------------------ */
        // setNavRows(await ndRes.json());
        const ndJson = await ndRes.json();
        if (Array.isArray(ndJson)) {
          setNavRows(ndJson);
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }
    })();
  }, []);

  /* -------- derived metrics --------------------------------- */
  const pendingCount = redempRows.length;
  const redempValue = redempSum != null ? usdCompact(redempSum) : "—";
  const latestCashNumber = netCashHistory[0] ? Number(netCashHistory[0].closing_avail) : null;
  const redempPct = latestCashNumber && redempSum ? (redempSum / latestCashNumber) * 100 : null;

  /* -------- Top-5 redemption rows ----------------------------- */
  const top5Redemptions = useMemo(() => {
    if (!redempRows.length || !latestCashNumber) return [];

    return [...redempRows]
      .sort((a, b) => Math.abs(+b.nav_delta) - Math.abs(+a.nav_delta))
      .slice(0, 5)
      .map((r) => {
        const amountAbs = Math.abs(+r.nav_delta);
        const pctOfCash = +((amountAbs / latestCashNumber) * 100).toFixed(1);
        return {
          investor: r.investor_name,
          amount: amountAbs,
          percentage: pctOfCash,
          date: r.snapshot_date.slice(0, 7),
        };
      });
  }, [redempRows, latestCashNumber]);

  /* -------- Net-cash line chart ----------------------------- */
  const netCashChart = useMemo(() => {
    if (!netCashHistory.length) return { labels: [], datasets: [] };

    const ordered = [...netCashHistory].sort(
      (a, b) => new Date(a.month_start).getTime() - new Date(b.month_start).getTime()
    );

    return {
      labels: ordered.map((r) => r.month_start.slice(0, 7)), // YYYY-MM
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

  /* -------- NAV/Dividend bar-chart ---------------------------- */
  const navChart = useMemo(() => {
    if (!navRows.length) return { labels: [], datasets: [] };

    return {
      labels: navRows.map((r) => r.period),
      datasets: [
        {
          label: "NAV Value Totals",
          data: navRows.map((r) => Number(r.nav)),
          backgroundColor: "#3b82f6",
          borderRadius: 3,
        },
        {
          label: "Dividends",
          data: navRows.map((r) => Number(r.dividend)),
          backgroundColor: "#22c55e",
          borderRadius: 3,
        },
      ],
    };
  }, [navRows]);

  return (
    <div className="p-6 space-y-6">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* <Select defaultValue="12m">
            <SelectTrigger className="w-32">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">1 Month</SelectItem>
              <SelectItem value="3m">3 Months</SelectItem>
              <SelectItem value="6m">6 Months</SelectItem>
              <SelectItem value="12m">12 Months</SelectItem>
              <SelectItem value="ytd">YTD</SelectItem>
            </SelectContent>
          </Select> */}

          <Select defaultValue="all">
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Annum Asia New Dividend Income Fund</SelectItem>
              {/* <SelectItem value="equity">Equity Fund</SelectItem>
              <SelectItem value="bond">Bond Fund</SelectItem>
              <SelectItem value="hybrid">Hybrid Fund</SelectItem> */}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* <KPICard title="Net Cash" value="$158.2M" change="+12.5%" changeType="positive" description="vs previous period" icon={DollarSign} /> */}
        <KPICard title="Net Cash" value={netCashLatest} change="" changeType="neutral" description="" icon={DollarSign} />
        <KPICard title="MoM P&L(Greyed for mockup only)" value="+8.7%" change="+2.3% vs avg" changeType="positive" description="Month over month" icon={TrendingUp} dimmed />
        <KPICard title="Unsettled Redemptions" value={<span className="text-red-600">{redempValue}</span>} change={`${pendingCount} pending`} changeType="neutral" description="Awaiting settlement" icon={AlertTriangle} />
      </div>

      {/* charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

                  /* --- interaction: allow hovering anywhere vertically --- */
                  interaction: { mode: "index", intersect: false },

                  plugins: {
                    legend: { display: false },

                    tooltip: {
                      enabled: true,
                      backgroundColor: "rgba(31,41,55,0.9)", // Tailwind gray-800 @ 90 %
                      titleFont: { weight: 600 },
                      padding: 10,
                      callbacks: {
                        /* yyyy-MM as title */
                        title: (ctx) => ctx[0].label,

                        /* format the Y value as USD */
                        label: (ctx) => ` ${usdCompact(ctx.parsed.y)}`,
                      },
                    },
                  },

                  scales: {
                    x: { grid: { display: false } },

                    y: {
                      ticks: {
                        callback: (value) => usdAxis(Number(value)),
                        padding: 6,
                      },
                      title: {
                        display: true,
                        text: "USD",
                        font: { weight: 600 },
                        color: "#6b7280",
                      },
                      grid: { color: "rgba(0,0,0,0.05)" },
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>NAV Value Totals vs Dividends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={chartBox}>
              <Bar
                data={navChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "top" } },
                  scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: "rgba(0,0,0,0.05)" } },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Outstanding Redemptions widget */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-lg">Outstanding Redemptions</CardTitle>
          <Badge variant="outline" className="text-destructive border-destructive">
            {redempPct ? `${redempPct.toFixed(1)}% of Net Cash` : "—"}
          </Badge>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* gauge */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-36 h-36">
                <Doughnut
                  data={{
                    labels: ["Outstanding", "Remaining"],
                    datasets: [
                      {
                        data: [redempPct ?? 0, redempPct != null ? 100 - redempPct : 100],
                        backgroundColor: ["#ef4444", "#e5e7eb"],
                        borderWidth: 0,
                      },
                    ],
                  }}
                  options={{
                    rotation: 0,
                    cutout: "75%",
                    plugins: {
                      legend: { display: false },
                      tooltip: { enabled: false },
                    },
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-destructive font-bold text-2xl">
                  {redempPct ? `${redempPct.toFixed(1)}%` : "—"}
                </span>
              </div>
              <p className="mt-4 text-sm text-center text-muted-foreground">
                Total Outstanding
                <br />
                <span className="font-medium">{redempValue}</span>
              </p>
            </div>

            {/* progress list (demo) */}
            <div className="lg:col-span-2 space-y-4">
              <h4 className="font-medium">Top 5 Redemption Requests</h4>
              {top5Redemptions.map((row) => (
                <div key={row.investor} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    {/* <span className="font-medium">{row.investor}</span> */}
                    <span className="font-medium flex items-center gap-2">
                      {row.investor}
                      <Badge variant="secondary" className="text-xs px-2 py-0.5">
                        {row.date}
                      </Badge>
                    </span>

                    <span className="text-destructive">
                      {usdCompact(row.amount)} ({row.percentage}%)
                    </span>
                  </div>
                  <Progress
                    value={row.percentage} /* 0-100 fits the component */
                    className="h-2 [&>div[role=progressbar]]:bg-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* footer */}
      <footer className="flex justify-between text-sm text-muted-foreground">
        <span>Last file processed: NAV_2024_12_03.xlsx • 2 errors found</span>
        <span>Last updated: {new Date().toLocaleString()}</span>
      </footer>
    </div>
  );
}