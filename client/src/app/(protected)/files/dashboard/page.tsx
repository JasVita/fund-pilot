/* ──────────────────────────────────────────────────────────
   Files Dashboard  ➜  Missing‑files dashboard
────────────────────────────────────────────────────────── */
"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils"; 
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote, FileWarning, FileText, AlertTriangle } from "lucide-react";


/* ─── API helpers ───────────────────────────────────────── */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5103";

type Fund = { fund_id: number; fund_name: string };

/* ─── summary‑card helpers ──────────────────────────────── */
function cardStyles(count: number, variant: "total" | "section") {
  if (count === 0)
    return { bg: "bg-green-50", num: "text-green-600 font-bold" };

  /* count > 0 */
  if (variant === "total")
    return { bg: "bg-gray-100", num: "" };          // light grey
  return { bg: "bg-red-50", num: "text-red-600 font-bold" }; // light red
}

function SummaryCard({ icon, label, count, variant = "section", highlight = false }: {
  icon: React.ReactNode
  label: string
  count: number
  variant?: "total" | "section"
  highlight?: boolean  
}) {
  const { bg, num } = cardStyles(count, variant)
  const labelClass = highlight ? "text-base font-semibold text-gray-900" : "text-base text-muted-foreground"

  return (
    <Card className={cn(bg)}>
      <CardHeader className="space-y-1">
        <CardDescription className={cn("flex items-center gap-1", labelClass)}>
          {icon}
          {label}
        </CardDescription>
        <CardTitle className={cn("text-3xl", num)}>{count}</CardTitle>
      </CardHeader>
    </Card>
  )
}


/* ─── PAGE ──────────────────────────────────────────────── */
export default function FilesMissingDashboard() {
  /* Fund selector state ----------------------------------- */
  const [funds, setFunds] = useState<Fund[]>([]);
  const [selectedFund, setSelectedFund] = useState<string>("all");
  const [isLoadingFunds, setIsLoadingFunds] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/funds`, {
          credentials: "include",
        });
        setFunds(await res.json());
      } catch (err) {
        console.error("Fund list fetch error:", err);
      } finally {
        setIsLoadingFunds(false);
      }
    })();
  }, []);

  /* — counts (placeholder – swap for API data later) —— */
  const bankMissing     = 12;
  const investorMissing = 8;
  const notesMissing    = 25;
  const totalMissing    = bankMissing + investorMissing + notesMissing;

  return (
    <div className="p-6 space-y-6">
      {/* ── header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Files Dashboard</h1>
          <p className="text-muted-foreground">
            Track and manage missing files across your portfolio
          </p>
        </div>

        {/* Fund selector */}
        <Select
          value={selectedFund}
          onValueChange={setSelectedFund}
          disabled={isLoadingFunds}
        >
          <SelectTrigger className="min-w-[20rem]">
            <SelectValue placeholder="All Funds" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All&nbsp;Funds</SelectItem>
            {funds.map((f) => (
              <SelectItem key={f.fund_id} value={String(f.fund_id)}>
                {f.fund_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── summary cards ─────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
            icon={<Banknote className="w-4 h-4 text-muted-foreground" />}
            label="Bank Statements Missing"
            count={bankMissing}
            highlight                /* ◀︎ add */
        />
        <SummaryCard
            icon={<FileText className="w-4 h-4 text-muted-foreground" />}
            label="Investor Statements Missing"
            count={investorMissing}
            highlight                /* ◀︎ add */
        />
        <SummaryCard
            icon={<FileWarning className="w-4 h-4 text-muted-foreground" />}
            label="Contact Notes Missing"
            count={notesMissing}
            highlight                /* ◀︎ add */
        />
        <SummaryCard
            icon={<AlertTriangle className="w-4 h-4 text-muted-foreground" />}
            label="Total Missing Files"
            count={totalMissing}
            variant="total"          /* keep default size */
        />
        </section>

      {/* ── Missing Bank Statements table ─────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5" />
            Missing Bank Statements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Separator />
          <div className="grid grid-cols-3 font-medium">
            <span>Fund</span>
            <span>Date</span>
            <span>Status</span>
          </div>
          <Separator />
          {[
            { fund: "Annum Global Capital Income Fund SP", date: "2024-03" },
            { fund: "Annum 全球PE基金第一期",                 date: "2024-03" },
            { fund: "Annum 全球大趨勢基金",                   date: "2024-06" },
          ].map((row, idx) => (
            <div key={idx} className="grid grid-cols-3 py-1 items-center">
              <span>{row.fund}</span>
              <span>{row.date}</span>
              <Badge variant="destructive" className="w-fit text-xs">
                Missing
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Missing Investor Statements table ─────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Missing Investor Statements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Separator />
          <div className="grid grid-cols-4 font-medium">
            <span>Fund</span>
            <span>Investor</span>
            <span>Date</span>
            <span>Status</span>
          </div>
          <Separator />
          {[
            { fund: "Annum Global Capital Income Fund SP", investor: "Pension Fund XYZ", date: "2024-03" },
            { fund: "Annum 全球私募市場基金",                 investor: "Insurance Co ABC", date: "2024-03" },
          ].map((row, idx) => (
            <div key={idx} className="grid grid-cols-4 py-1 items-center">
              <span>{row.fund}</span>
              <span>{row.investor}</span>
              <span>{row.date}</span>
              <Badge variant="destructive" className="w-fit text-xs">
                Missing
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Missing Contact Notes table ───────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileWarning className="w-5 h-5" />
            Missing Contact Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Separator />
          <div className="grid grid-cols-4 font-medium">
            <span>Contact</span>
            <span>Company</span>
            <span>Date</span>
            <span>Status</span>
          </div>
          <Separator />
          {[
            { contact: "John Smith",   company: "ABC Capital",     date: "2024-01-15" },
            { contact: "Sarah Johnson", company: "XYZ Investments", date: "2024-02-10" },
          ].map((row, idx) => (
            <div key={idx} className="grid grid-cols-4 py-1 items-center">
              <span>{row.contact}</span>
              <span>{row.company}</span>
              <span>{row.date}</span>
              <Badge variant="destructive" className="w-fit text-xs">
                Missing
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
