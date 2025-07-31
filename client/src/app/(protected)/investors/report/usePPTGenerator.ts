"use client";
import { useState } from "react";
import { toast } from "sonner";
import { generateInvestmentPpt } from "./pptGenerator";    
import type { TableRowData } from "../tables/InvestmentTable";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5003";

export function usePPTGenerator({ defaultInvestor, fundId }: { defaultInvestor: string; fundId?: number; }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeneratePpt = async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      /* A. core holdings (all‑fund) */
      const res = await fetch( `${API_BASE}/investors/report?investor=${encodeURIComponent( defaultInvestor )}`, { credentials: "include" } );

      if (!res.ok) throw new Error(await res.text());

      const { rows } = await res.json();
      const mapped: TableRowData[] = rows.map((r: any) => ({
        productName:        r.name ?? "",
        subscriptionTime:    r.sub_date ?? "",
        dataDeadline:        r.data_cutoff ?? "",
        subscriptionAmount:  r.subscribed ?? "",
        marketValue:         r.market_value ?? "",
        totalAfterDeduction: r.total_after_int != null ? String(r.total_after_int) : "",
        estimatedProfit:     r.pnl_pct ?? "",
      }));


      /* B. dividend rows (optional) */
      const divQs = `?investor=${encodeURIComponent(defaultInvestor)}` + (fundId ? `&fund_id=${fundId}` : "") 
      const divRes = await fetch( `${API_BASE}/investors/holdings/dividends${divQs}`, { credentials: "include" } ); 
      const { rows: dividendRows = [] } = divRes.ok ? await divRes.json() : {};

      /* ---- generate & download ---------------------------------- */
      await generateInvestmentPpt({
        investor: defaultInvestor,
        reportDate: new Date().toISOString().split("T")[0],
        tableData: mapped,
        dividendRows,  
        /* leave totals blank so they don’t show on slide-2 footer */
        totalSubscriptionAmount: "",
        totalMarketValue: "",
        totalAfterDeduction: "",
        totalProfit: "",
      });

      toast.success(
        `${defaultInvestor} PPT report downloaded successfully.`
      );
    } catch (err) {
      toast.error("There was an error creating your PPT report.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return { isGenerating, handleGeneratePpt };
}
