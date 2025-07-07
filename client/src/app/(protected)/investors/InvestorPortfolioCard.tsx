"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import InvestorPortfolioTable, {
  type InvestorRow,
} from "./InvestorPortfolioTable";

/* simple passthrough props --------------------------------------- */
type Props = {
  rows        : InvestorRow[];
  loading     : boolean;
  page        : number;
  pageCount   : number;
  onPageChange: (n: number) => void;
  onSelectRow : (r: InvestorRow) => void;
};

export default function InvestorPortfolioCard(props: Props) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Investor&nbsp;Portfolio&nbsp;Overview</CardTitle>
      </CardHeader>

      <CardContent className="h-full flex flex-col">
        {/*  takes the whole height and scrolls inside  */}
        <div className="flex-1 overflow-x-auto">
          <InvestorPortfolioTable {...props} />
        </div>
      </CardContent>
    </Card>
  );
}
