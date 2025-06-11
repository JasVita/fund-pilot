"use client";
import { useState, useEffect } from "react";
import { generateInvestmentReport } from "@/utils/pdfGenerator";
import { toast } from "sonner";
import type { TableRowData } from "@/components/pdfGenerator/InvestmentTable";

type Options = {
  defaultInvestor?: string;
  defaultTableData?: TableRowData[];
};

export const useReportGenerator = ({
  defaultInvestor = "Client Name",
  defaultTableData = [],
}: Options = {}) => {
  /* modal & progress flags --------------------------------------- */
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  /* form data ----------------------------------------------------- */
  const [investor, setInvestor] = useState(defaultInvestor);
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [tableData, setTableData] = useState<TableRowData[]>(defaultTableData);

  /* keep state in-sync when parent props change ------------------ */
  useEffect(() => setInvestor(defaultInvestor), [defaultInvestor]);
  useEffect(() => setTableData(defaultTableData), [defaultTableData]);

  /* (optional) totals – left blank so they don’t show in slide 2 */
  const totals = {
    totalSubscriptionAmount: "",
    totalMarketValue: "",
    totalAfterDeduction: "",
    totalProfit: "",
  };

  /* -------------------------------------------------------------- */
  const handleGenerateReport = async () => {
    if (tableData.length === 0) {
      toast.error("No holdings to export.");
      return;
    }

    setIsGenerating(true);
    try {
      await generateInvestmentReport({
        investor,
        reportDate,
        tableData,
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
