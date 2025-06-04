"use client";

import React, { useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Search,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

import { LineChart, Line, ResponsiveContainer } from "recharts";
import TrendLine from "./trendLineChart";
import { useGlobalStore } from "@/store/useGlobalStore";

/* ─── Utilities ─── */
const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);

const formatPct = (v: number) =>
  `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

/* ─── Mock data ─── */
const investorsData = [
  {
    id: "INV001",
    name: "Pension Fund Alpha",
    class: "Class A",
    currentNAV: 125_000_000,
    unpaidRedeem: 12_500_000,
    ytdPL: 8.7,
    spark: [100, 105, 98, 112, 108, 125],
  },
  {
    id: "INV002",
    name: "Insurance Corp Beta",
    class: "Class B",
    currentNAV: 87_500_000,
    unpaidRedeem: 8_750_000,
    ytdPL: -2.3,
    spark: [100, 95, 88, 92, 85, 87.5],
  },
  {
    id: "INV003",
    name: "Endowment Gamma",
    class: "Class A",
    currentNAV: 62_500_000,
    unpaidRedeem: 6_250_000,
    ytdPL: 12.4,
    spark: [100, 108, 115, 105, 118, 125],
  },
  {
    id: "INV004",
    name: "Foundation Delta",
    class: "Class C",
    currentNAV: 43_750_000,
    unpaidRedeem: 0,
    ytdPL: 5.6,
    spark: [100, 102, 105, 98, 104, 106],
  },
  {
    id: "INV005",
    name: "Trust Epsilon",
    class: "Class B",
    currentNAV: 31_250_000,
    unpaidRedeem: 3_125_000,
    ytdPL: -1.8,
    spark: [100, 98, 95, 97, 94, 98],
  },
];

const mockTx = [
  {
    date: "2024-12-01",
    type: "Subscription",
    amount: 5_000_000,
    status: "Settled",
  },
  {
    date: "2024-11-15",
    type: "Redemption",
    amount: -2_500_000,
    status: "Pending",
  },
  {
    date: "2024-10-30",
    type: "Dividend",
    amount: 125_000,
    status: "Settled",
  },
  {
    date: "2024-10-01",
    type: "Subscription",
    amount: 10_000_000,
    status: "Settled",
  },
];

const data = {
  labels: ['A', 'B', 'C', 'D', 'E'],        // any labels you like
  datasets: [
    {
      data: [0, 3, 2, 5, 4],                // your values
      borderColor: '#3b82f6',
      borderWidth: 2,
      pointRadius: 0,                       // hide dots
      fill: false,
    },
  ],
};

const options = {
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false },
  },
  elements: { point: { radius: 0 } },
  scales: {
    x: { grid: { display: false }, ticks: { display: false } },
    y: { grid: { display: false }, ticks: { display: false } },
  },
};

/* ─── Page component ─── */
export default function InvestorsPage() {
  const [selected, setSelected] = useState<
    (typeof investorsData)[number] | null
  >(null);

  const { searchTerm, setSearchTerm } = useGlobalStore();

  const filtered = investorsData.filter(
    (i) =>
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* ── header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Investors</h1>
          <p className="text-muted-foreground">
            Manage investor portfolios and track performance
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search investors…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-64"
          />
        </div>
      </div>

      {/* ── table ── */}
      <Card>
        <CardHeader>
          <CardTitle>Investor Portfolio Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-48">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-semibold"
                    >
                      Investor
                      <ArrowUpDown className="ml-2 w-4 h-4" />
                    </Button>
                  </TableHead>
                  {/* <TableHead>ID</TableHead> */}
                  <TableHead>Class</TableHead>
                  <TableHead>Number Held</TableHead>
                  <TableHead className="text-right">Current NAV</TableHead>
                  <TableHead className="text-right">Unpaid Redeem</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  {/* <TableHead className="text-right">YTD P&L %</TableHead>
                  <TableHead className="text-center">Trend</TableHead> */}
                </TableRow>
              </TableHeader>

              <TableBody>
                {filtered.map((inv) => (
                  <TableRow
                    key={inv.id}
                    onClick={() => setSelected(inv)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    {/* Investor */}
                    <TableCell className="font-medium sticky left-0 bg-background">
                      {inv.name}
                    </TableCell>

                    {/* ID */}
                    {/* <TableCell>
                      <Badge variant="outline">{inv.id}</Badge>
                    </TableCell> */}

                    {/* Class */}
                    <TableCell>
                      <Badge variant="secondary">{inv.class}</Badge>
                    </TableCell>
                    
                    {/* Number Held */}
                    {/* <TableCell>
                      <Badge variant="outline">{inv.id}</Badge>
                    </TableCell> */}


                    {/* Current NAV */}
                    <TableCell className="text-right font-mono">
                      {formatCurrency(inv.currentNAV)}
                    </TableCell>

                    {/* Unpaid Redeem */}
                    <TableCell className="text-right font-mono">
                      {inv.unpaidRedeem > 0 ? (
                        <span className="text-destructive">
                          {formatCurrency(inv.unpaidRedeem)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* YTD P&L % */}
                    {/* <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {inv.ytdPL >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-success" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-destructive" />
                        )}
                        <span
                          className={
                            inv.ytdPL >= 0
                              ? "text-success"
                              : "text-destructive"
                          }
                        >
                          {formatPct(inv.ytdPL)}
                        </span>
                      </div>
                    </TableCell> */}
                    
                    {/* trend */}
                    {/* <TableCell>
                      <TrendLine></TrendLine>
                    </TableCell> */}

                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── detail sheet ── */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selected?.name}</SheetTitle>
          </SheetHeader>

          {selected && (
            <div className="mt-6">
              <Tabs defaultValue="overview">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="holdings">Holdings</TabsTrigger>
                  <TabsTrigger value="transactions">Transactions</TabsTrigger>
                  <TabsTrigger value="dividends">Dividends</TabsTrigger>
                </TabsList>

                {/* ─ overview ─ */}
                <TabsContent value="overview" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">
                          Current NAV
                        </p>
                        <p className="text-xl font-bold">
                          {formatCurrency(selected.currentNAV)}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">
                          YTD P&L
                        </p>
                        <p
                          className={`text-xl font-bold ${
                            selected.ytdPL >= 0
                              ? "text-success"
                              : "text-destructive"
                          }`}
                        >
                          {formatPct(selected.ytdPL)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">
                        Performance Trend
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={selected.spark.map((v, i) => ({
                              month: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
                                i
                              ],
                              v,
                            }))}
                          >
                            <Line
                              type="monotone"
                              dataKey="v"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
                              dot={{
                                fill: "hsl(var(--primary))",
                                strokeWidth: 2,
                                r: 4,
                              }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ─ transactions ─ */}
                <TabsContent value="transactions" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">
                        Recent Transactions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {mockTx.map((tx, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
                          >
                            <div>
                              <p className="font-medium text-sm">
                                {tx.type}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {tx.date}
                              </p>
                            </div>
                            <div className="text-right">
                              <p
                                className={`font-mono text-sm ${
                                  tx.amount >= 0
                                    ? "text-success"
                                    : "text-destructive"
                                }`}
                              >
                                {formatCurrency(Math.abs(tx.amount))}
                              </p>
                              <Badge
                                variant={
                                  tx.status === "Settled"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {tx.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* placeholders */}
                <TabsContent value="holdings" className="mt-4">
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Holdings details coming soon
                  </p>
                </TabsContent>

                <TabsContent value="dividends" className="mt-4">
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Dividend history coming soon
                  </p>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
