"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useReportGenerator } from "../report/useReportGenerator";

interface Props {
  defaultInvestor: string;
  // defaultTableData: TableRowData[];
}

/** A one-click “Download report” button (no pop-up). */
const ReportGeneratorDialog = ({
  defaultInvestor,
  // defaultTableData,
}: Props) => {
  const { isGenerating, handleGenerateReport } = useReportGenerator({
    defaultInvestor,
    // defaultTableData,
  });

  return (
    <Button
      onClick={handleGenerateReport}
      disabled={isGenerating}
      variant="default"
      title={`Download report for ${defaultInvestor}`}
      className={`flex items-center gap-2 transition ${
        isGenerating ? "animate-pulse cursor-wait" : ""
      }`}
    >
      <Download className="h-4 w-4" />
      {isGenerating ? "Generating…" : "Download report"}
    </Button>
  );
};

export default ReportGeneratorDialog;
