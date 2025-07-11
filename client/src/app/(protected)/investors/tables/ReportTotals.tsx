"use client";
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ReportTotalsProps {
  totals: {
    totalSubscriptionAmount: string;
    totalMarketValue: string;
    totalAfterDeduction: string;
    totalProfit: string;
  };
  onUpdateTotal: (field: keyof ReportTotalsProps['totals'], value: string) => void;
}

const ReportTotals = ({ totals, onUpdateTotal }: ReportTotalsProps) => {
  return (
    <div>
      <Label className="text-lg font-semibold mb-4 block">Totals</Label>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="totalSubscription">Total Subscription</Label>
          <Input
            id="totalSubscription"
            value={totals.totalSubscriptionAmount}
            onChange={(e) => onUpdateTotal('totalSubscriptionAmount', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="totalMarketValue">Total Market Value</Label>
          <Input
            id="totalMarketValue"
            value={totals.totalMarketValue}
            onChange={(e) => onUpdateTotal('totalMarketValue', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="totalAfterDeduction">Total After Deduction</Label>
          <Input
            id="totalAfterDeduction"
            value={totals.totalAfterDeduction}
            onChange={(e) => onUpdateTotal('totalAfterDeduction', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="totalProfit">Total Profit (%)</Label>
          <Input
            id="totalProfit"
            value={totals.totalProfit}
            onChange={(e) => onUpdateTotal('totalProfit', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default ReportTotals;