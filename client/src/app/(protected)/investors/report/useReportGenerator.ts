"use client";
import { useState, useEffect } from "react";
import { generateInvestmentReport } from "./pdfGenerator";
import { toast } from "sonner";
<<<<<<< HEAD:client/src/hooks/useReportGenerator.ts
import type { TableRowData } from "@/components/pdfGenerator/InvestmentTable";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5003";
=======
import type { TableRowData } from "../tables/InvestmentTable";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5103";
>>>>>>> dev:client/src/app/(protected)/investors/report/useReportGenerator.ts

type Options = {
  defaultInvestor?: string;
  // defaultTableData?: TableRowData[];
};

export const useReportGenerator = ({
  defaultInvestor = "Client Name",
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
    // if (tableData.length === 0) {
    //   toast.error("No holdings to export.");
    //   return;
    // }

    setIsGenerating(true);
    try {
      /* fetch fresh rows from the new API ------------------------ */
      const res = await fetch(
        `${API_BASE}/investors/report?investor=${encodeURIComponent(investor)}`,
        { credentials: "include" }
      );
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
