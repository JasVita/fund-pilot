"use client";
import { useState } from "react";
import { toast } from "sonner";
import { generateInvestmentPpt } from "./pptGenerator";    
import type { TableRowData } from "../tables/InvestmentTable";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5003";

export function usePPTGenerator({ defaultInvestor, fundId }: { defaultInvestor: string; fundId?: number; }) {
  const [isGenerating, setIsGenerating] = useState(false);

  // ⬇︎ helper: sum "1,234\n5,678" -> 6912
  const sumTokens = (v: unknown): number =>
    String(v ?? "")
      .split("\n")
      .map(t => Number(String(t).replace(/,/g, "").trim()))
      .filter(Number.isFinite)
      .reduce((a, b) => a + b, 0);

  const handleGeneratePpt = async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      /* A. core holdings (all-fund) */
      const res = await fetch(
        `${API_BASE}/investors/report?investor=${encodeURIComponent(defaultInvestor)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(await res.text());

      const { rows } = await res.json();

      // ⬇︎ compute totals (per your rules)
      let totalSub = 0, totalMkt = 0, totalAfter = 0;
      rows.forEach((r: any) => {
        const sub = sumTokens(r.subscribed);
        const mkt = sumTokens(r.market_value);
        const after = Number.isFinite(Number(r.total_after_int))
          ? Number(r.total_after_int)
          : mkt; // use 市值 if 含息後總額 missing
        totalSub   += sub;
        totalMkt   += mkt;
        totalAfter += after;
      });
      const totalPct = totalSub > 0 ? ((totalAfter - totalSub) / totalSub) * 100 : 0;

      const mapped: TableRowData[] = rows.map((r: any) => ({
        productName:         r.name ?? "",
        subscriptionTime:    r.sub_date ?? "",
        dataDeadline:        r.data_cutoff ?? "",
        subscriptionAmount:  r.subscribed ?? "",
        marketValue:         r.market_value ?? "",
        totalAfterDeduction: r.total_after_int != null ? String(r.total_after_int) : "",
        estimatedProfit:     r.pnl_pct ?? "",
      }));

      /* B. dividend rows (optional) */
      const divQs = `?investor=${encodeURIComponent(defaultInvestor)}`; // + (fundId ? `&fund_id=${fundId}` : "")
      const divRes = await fetch(`${API_BASE}/investors/holdings/dividends${divQs}`, { credentials: "include" });
      const { rows: dividendRows = [] } = divRes.ok ? await divRes.json() : {};

      /* ---- generate & download ---------------------------------- */
      await generateInvestmentPpt({
        investor: defaultInvestor,
        reportDate: new Date().toISOString().split("T")[0],
        tableData: mapped,
        dividendRows,
        // ⬇︎ send totals to the slide
        totalSubscriptionAmount: totalSub.toFixed(2),
        totalMarketValue:        totalMkt.toFixed(2),
        totalAfterDeduction:     totalAfter.toFixed(2),
        totalProfit:             totalPct.toFixed(2), // no % sign; the slide adds it
      });

      toast.success(`${defaultInvestor} PPT report downloaded successfully.`);
    } catch (err) {
      toast.error("There was an error creating your PPT report.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return { isGenerating, handleGeneratePpt };
}
