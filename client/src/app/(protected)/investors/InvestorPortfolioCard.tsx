"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import InvestorPortfolioTable, { Investor } from "./InvestorPortfolioTable";

/* -------- props from parent ----------------------------------- */
type Props = {
  rows: Investor[];
  loading: boolean;
  page: number;
  pageCount: number;
  onPageChange: (n: number) => void;
  onSelectRow: (r: Investor) => void;
};

export default function InvestorPortfolioCard(props: Props) {
  const [filter, setFilter] = useState("");

    return (
    /* ⬇ plain <div> replaces the old <Card> wrapper */
    <div className="h-full flex flex-col space-y-4 mb-[20px]">
      {/* title */}
      <h2 className="text-lg font-semibold">
        Investor&nbsp;Portfolio&nbsp;Overview
      </h2>

      {/* 🔍 quick-filter input */}
      <Input
        placeholder="Search investors or class here…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        className="max-w-sm"
      />

      {/* data grid */}
      <div className="flex overflow-x-auto h-screen">
        <InvestorPortfolioTable
          {...props}
          quickFilter={filter}   /* – pass down the current filter */
        />
      </div>
    </div>
  );
}