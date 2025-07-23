"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useReportGenerator } from "../report/useReportGenerator";

interface Props {
  defaultInvestor: string;
  fundId?: number;
  className?: string; 
}

const ReportGeneratorButton = ({ defaultInvestor, fundId, className }: Props) => {
  const { isGenerating, handleGenerateReport } = useReportGenerator({ defaultInvestor, fundId });

  return (
    <Button
      onClick={handleGenerateReport}
      disabled={isGenerating}
      variant="default"
      title={`Download report for ${defaultInvestor}`}
      className={
        `flex items-center gap-2 transition` +
        (isGenerating ? " animate-pulse cursor-wait" : "") +
        (className ? ` ${className}` : "") 
      }
    >
      <Download className="h-4 w-4" />
      {isGenerating ? "Generating PDF Report…" : "Download PDF Report"}
    </Button>
  );
};

export default ReportGeneratorButton;
