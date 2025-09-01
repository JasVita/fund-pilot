"use client";
import { useState, useEffect } from "react";
import { generateInvestmentReport } from "./pdfGenerator";
import { toast } from "sonner";
import { toStr } from "@/lib/report-format";
import type { TableRowData } from "../tables/InvestmentTable";
import type { DividendRow } from "./pptGenerator"; 
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5003";


type Options = {
  defaultInvestor?: string;
  fundId?: number;  
};

export const useReportGenerator = ({
  defaultInvestor = "Client Name",
  fundId,
}: Options = {}) => {
  /* modal & progress flags --------------------------------------- */
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  /* form data ----------------------------------------------------- */
  const [investor, setInvestor] = useState(defaultInvestor);
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  /* (optional) totals – left blank so they don’t show in slide 2 */
  const totals = {
    totalSubscriptionAmount: "",
    totalMarketValue: "",
    totalAfterDeduction: "",
    totalProfit: "",
  };

  /* -------------------------------------------------------------- */
  const handleGenerateReport = async () => {
    setIsGenerating(true);

    try {
      /* ---- A. core holdings (ALWAYS all‑fund) ------------------ */
      const res = await fetch( `${API_BASE}/investors/report?investor=${encodeURIComponent(investor)}`, { credentials: "include" } );

      if (!res.ok) throw new Error(await res.text());

      const { rows } = await res.json();
      const mapped: TableRowData[] = rows.map((r: any) => ({
        productName:         toStr(r.name),
        subscriptionTime:    toStr(r.sub_date),
        dataDeadline:        toStr(r.data_cutoff),
        subscriptionAmount:  toStr(r.subscribed),
        marketValue:         toStr(r.market_value),
        totalAfterDeduction: toStr(r.total_after_int),
        estimatedProfit:     toStr(r.pnl_pct),
      }));

      /* ---- B. dividend rows (optional, filtered by fund) ------- */
      const divQs = `?investor=${encodeURIComponent(investor)}` // + (fundId ? `&fund_id=${fundId}` : "");
      const divRes = await fetch(`${API_BASE}/investors/holdings/dividends${divQs}`, { credentials: "include" });
      const { rows: dividendRows = [] } = divRes.ok ? await divRes.json() : {};
      
      await generateInvestmentReport({
        investor,
        reportDate,
        tableData: mapped,
        dividendRows,  
        ...totals,
      });

      toast.success(
        `${investor}_investment_report_${reportDate}.pdf is downloaded.`,
        { description: "Report generated and downloaded successfully." }
      );
      setIsOpen(false);
    } catch (err) {
      toast.error("There was an error creating your PDF report. Please try again.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    /* state */
    isOpen,
    setIsOpen,
    isGenerating,
    /* actions */
    handleGenerateReport,
  };
};
