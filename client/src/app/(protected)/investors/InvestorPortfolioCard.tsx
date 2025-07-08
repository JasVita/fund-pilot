"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import InvestorPortfolioTable, { InvestorRow } from "./InvestorPortfolioTable";

/* -------- props from parent ----------------------------------- */
type Props = {
  rows        : InvestorRow[];
  loading     : boolean;
  page        : number;
  pageCount   : number;
  onPageChange: (n: number) => void;
  onSelectRow : (r: InvestorRow) => void;
};

export default function InvestorPortfolioCard(props: Props) {
  const [filter, setFilter] = useState("");

  return (
    <Card className="h-full mb-[20px]">  {/* 20-px bottom margin */}
      <CardHeader className="flex flex-col gap-2">
        <CardTitle>Investor&nbsp;Portfolio&nbsp;Overview</CardTitle>

        {/* 🔍 keyword search */}
        <Input
          placeholder="Search investors or class here…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="max-w-sm"
        />
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-x-auto">
          <InvestorPortfolioTable
            {...props}
            quickFilter={filter}   /* ← pass down */
          />
        </div>
      </CardContent>
    </Card>
  );
}
