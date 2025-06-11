
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ReportBasicInfoProps {
  investor: string;
  reportDate: string;
  onInvestorChange: (value: string) => void;
  onReportDateChange: (value: string) => void;
}

const ReportBasicInfo = ({ 
  investor, 
  reportDate, 
  onInvestorChange, 
  onReportDateChange 
}: ReportBasicInfoProps) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="investor">Investor Name</Label>
        <Input
          id="investor"
          value={investor}
          onChange={(e) => onInvestorChange(e.target.value)}
          placeholder="Enter investor name"
        />
      </div>
      <div>
        <Label htmlFor="reportDate">Report Date</Label>
        <Input
          id="reportDate"
          type="date"
          value={reportDate}
          onChange={(e) => onReportDateChange(e.target.value)}
        />
      </div>
    </div>
  );
};

export default ReportBasicInfo;
