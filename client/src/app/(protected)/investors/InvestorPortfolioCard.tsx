"use client";
import InvestorPortfolioTable, { Investor } from "./InvestorPortfolioTable";

/* -------- props from parent ----------------------------------- */
type Props = {
  rows: Investor[];
  loading: boolean;
  page: number;
  pageCount: number;
  quickFilter: string; 
  onPageChange: (n: number) => void;
  onSelectRow: (r: Investor) => void;
  onOpenFiles?: (r: Investor) => void; 
};

export default function InvestorPortfolioCard(props: Props) {
  // const [filter, setFilter] = useState("");

    return (
    /* ⬇ plain <div> replaces the old <Card> wrapper */
    <div className="h-full flex flex-col space-y-4 mb-[20px]">
      {/* title */}
      {/* <h2 className="text-lg font-semibold">
        Investor&nbsp;Portfolio&nbsp;Overview
      </h2> */}

      {/* 🔍 quick-filter input */}
      {/* <div className="flex justify-end">
        <Input
          placeholder="Search investors or class here…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
      </div> */}

      {/* data grid */}
      <div className="flex overflow-x-auto h-screen">
        <InvestorPortfolioTable
          {...props}
          // quickFilter={filter}   /* – pass down the current filter */
          quickFilter={props.quickFilter}
          onOpenFiles={props.onOpenFiles}
        />
      </div>
    </div>
  );
}