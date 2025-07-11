"use client";
import React from 'react';
import { Button } from '@/components/ui/button';
import ReportBasicInfo from './ReportBasicInfo';
import InvestmentTable, { type TableRowData } from './InvestmentTable';
import ReportTotals from './ReportTotals';

type Totals = {
  totalSubscriptionAmount: string;
  totalMarketValue: string;
  totalAfterDeduction: string;
  totalProfit: string;
};

interface ReportFormProps {
  investor: string;
  reportDate: string;
  tableData: TableRowData[];

  totals: Totals;
  onInvestorChange: (value: string) => void;
  onReportDateChange: (value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  onUpdateCell: (rowIndex: number, field: keyof TableRowData, value: string) => void;
  onUpdateTotal: (field: keyof Totals, value: string) => void;
  onCancel: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

const ReportForm = ({
  investor,
  reportDate,
  tableData,
  totals,
  onInvestorChange,
  onReportDateChange,
  onAddRow,
  onRemoveRow,
  onUpdateCell,
  onUpdateTotal,
  onCancel,
  onGenerate,
  isGenerating
}: ReportFormProps) => {
  return (
    <div className="space-y-6">
      <ReportBasicInfo
        investor={investor}
        reportDate={reportDate}
        onInvestorChange={onInvestorChange}
        onReportDateChange={onReportDateChange}
      />

      <InvestmentTable
        tableData={tableData}
        onAddRow={onAddRow}
        onRemoveRow={onRemoveRow}
        onUpdateCell={onUpdateCell}
      />

      <ReportTotals
        totals={totals}
        onUpdateTotal={onUpdateTotal}
      />

      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? 'Generating...' : 'Generate PDF Report'}
        </Button>
      </div>
    </div>
  );
};

export default ReportForm;