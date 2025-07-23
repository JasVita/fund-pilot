"use client";
import { useState, useEffect } from "react";
import { generateInvestmentReport } from "./pdfGenerator";
import { toast } from "sonner";
import type { TableRowData } from "../tables/InvestmentTable";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5103";

type Options = {
  defaultInvestor?: string;
  fundId?: number;  
  // defaultTableData?: TableRowData[];
};

export const useReportGenerator = ({
  defaultInvestor = "Client Name",
  fundId,
  // defaultTableData = [],
}: Options = {}) => {
  /* modal & progress flags --------------------------------------- */
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  /* form data ----------------------------------------------------- */
  const [investor, setInvestor] = useState(defaultInvestor);
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  // const [tableData, setTableData] = useState<TableRowData[]>(defaultTableData);

  /* keep state in-sync when parent props change ------------------ */
  // useEffect(() => setInvestor(defaultInvestor), [defaultInvestor]);
  // useEffect(() => setTableData(defaultTableData), [defaultTableData]);
  const [tableData, setTableData] = useState<TableRowData[]>([]);

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
      // const qs = `?investor=${encodeURIComponent(investor)}` + (fundId ? `&fund_id=${fundId}` : "");
      // const res = await fetch(`${API_BASE}/investors/report${qs}`, { credentials: "include" });

      const res = await fetch( `${API_BASE}/investors/report?investor=${encodeURIComponent(investor)}`, { credentials: "include" } );

      if (!res.ok) throw new Error(await res.text());

      const { rows } = await res.json();
      const mapped: TableRowData[] = rows.map((r: any) => ({
        productName: r.name,
        subscriptionTime: r.sub_date,
        dataDeadline: r.data_cutoff,
        subscriptionAmount: r.subscribed,
        marketValue: r.market_value,
        totalAfterDeduction:
          r.total_after_int != null ? String(r.total_after_int) : "",
        estimatedProfit: r.pnl_pct ?? "",
      }));

      /* ---- B. dividend rows (optional, filtered by fund) ------- */
      const divQs = `?investor=${encodeURIComponent(investor)}` + (fundId ? `&fund_id=${fundId}` : "");
      const divRes = await fetch(`${API_BASE}/investors/holdings/dividends${divQs}`, { credentials: "include" });
      const { rows: dividendRows = [] } = divRes.ok ? await divRes.json() : {};
      // TODO: HANDLE LOGIC LATER
      
      await generateInvestmentReport({
        investor,
        reportDate,
        tableData: mapped,
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
