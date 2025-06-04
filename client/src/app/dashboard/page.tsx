"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";   
import { KPICard } from "./KPICard";        
import {
  Download,
  Filter,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,        //  ← doughnut slices
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

/* ─── Helper — compact US-dollar formatter ─── */
const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);


/* ─── Raw data (your preferred “dictionary” arrays) ─── */
const aumRaw = [
  { month: "Jan", value: 125 },
  { month: "Feb", value: 128 },
  { month: "Mar", value: 132 },
  { month: "Apr", value: 129 },
  { month: "May", value: 135 },
  { month: "Jun", value: 142 },
  { month: "Jul", value: 138 },
  { month: "Aug", value: 145 },
  { month: "Sep", value: 148 },
  { month: "Oct", value: 152 },
  { month: "Nov", value: 155 },
  { month: "Dec", value: 158 },
];

const navRaw = [
  { month: "Jan", nav: 2.4, dividend: 0.8 },
  { month: "Feb", nav: 1.8, dividend: 1.2 },
  { month: "Mar", nav: 3.2, dividend: 0.9 },
  { month: "Apr", nav: -0.8, dividend: 1.1 },
  { month: "May", nav: 2.8, dividend: 0.95 },
  { month: "Jun", nav: 4.2, dividend: 1.3 },
];

const redeemRaw = [
  { investor: "Pension Fund Alpha", amount: 12.5, percentage: 8.2 },
  { investor: "Insurance Corp Beta", amount: 8.8, percentage: 5.7 },
  { investor: "Endowment Gamma", amount: 6.3, percentage: 4.1 },
  { investor: "Foundation Delta", amount: 4.4, percentage: 2.9 },
  { investor: "Trust Epsilon", amount: 3.1, percentage: 2.0 },
];

/* ─── charts ─── */
const aumChart = {
  labels: aumRaw.map((d) => d.month),
  datasets: [
    {
      label: "AUM",
      data: aumRaw.map((d) => d.value),
      fill: true,
      backgroundColor: "rgba(59,130,246,0.15)",
      borderColor: "#3b82f6",
      tension: 0.35,
      pointRadius: 0,
    },
  ],
};
const navChart = {
  labels: navRaw.map((d) => d.month),
  datasets: [
    {
      label: "NAV Value Totals",
      data: navRaw.map((d) => d.nav),
      backgroundColor: "#3b82f6",
      borderRadius: 3,
    },
    {
      label: "Dividends",
      data: navRaw.map((d) => d.dividend),
      backgroundColor: "#22c55e",
      borderRadius: 3,
    },
  ],
};

/* ─── Helper styles ─────────────────────────────────── */
const chartBoxClass = "relative w-full h-[300px]";

/* ─── Component ─────────────────────────────────────── */
export default function Page() {
  return (
    <div className="p-6 space-y-6">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* <Select defaultValue="12m">
            <SelectTrigger className="w-32">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">1 Month</SelectItem>
              <SelectItem value="3m">3 Months</SelectItem>
              <SelectItem value="6m">6 Months</SelectItem>
              <SelectItem value="12m">12 Months</SelectItem>
              <SelectItem value="ytd">YTD</SelectItem>
            </SelectContent>
          </Select> */}

          <Select defaultValue="all">
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Annum Asia New Dividend Income Fund</SelectItem>
              {/* <SelectItem value="equity">Equity Fund</SelectItem>
              <SelectItem value="bond">Bond Fund</SelectItem>
              <SelectItem value="hybrid">Hybrid Fund</SelectItem> */}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* <KPICard title="Net Cash" value="$158.2M" change="+12.5%" changeType="positive" description="vs previous period" icon={DollarSign} /> */}
        <KPICard title="Net Cash" value="$158.2M" change="" changeType="neutral" description="" icon={DollarSign} />
        <KPICard title="MoM P&L" value="+8.7%" change="+2.3% vs avg" changeType="positive" description="Month over month" icon={TrendingUp} />
        <KPICard title="Unsettled Redemptions" value="$35.0M" change="15 pending" changeType="neutral" description="Awaiting settlement" icon={AlertTriangle} />
      </div>

      {/* AUM & NAV charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>$ Net Cash Trend</CardTitle></CardHeader>
          <CardContent>
            <div className={chartBoxClass}>
              <Line
                data={aumChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false } },
                    y: {
                      ticks: { callback: () => "" },
                      grid: { color: "rgba(0,0,0,0.05)" },
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>NAV Value Totals vs Dividends</CardTitle></CardHeader>
          <CardContent>
            <div className={chartBoxClass}>
              <Bar
                data={navChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "top" } },
                  scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: "rgba(0,0,0,0.05)" } },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Outstanding Redemptions */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-lg">Outstanding Redemptions</CardTitle>
          <Badge variant="outline" className="text-destructive border-destructive">
            22.1% of Net Cash
          </Badge>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* gauge doughnut */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-36 h-36">
                <Doughnut
                  data={{
                    labels: ["Outstanding", "Remaining"],
                    datasets: [
                      {
                        data: [22.1, 77.9],
                        backgroundColor: [
                          "#ef4444",
                          "#e5e7eb",
                        ],
                        borderWidth: 0,
                      },
                    ],
                  }}
                  options={{
                    rotation: 0,
                    cutout: "75%",
                    plugins: {
                      legend: { display: false },
                      tooltip: { enabled: false },
                    },
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-destructive font-bold text-2xl">
                  22.1%
                </span>
              </div>
              <p className="mt-4 text-sm text-center text-muted-foreground">
                Total Outstanding<br />
                <span className="font-medium">$35.0M</span>
              </p>
            </div>

            {/* progress bars */}
            <div className="lg:col-span-2 space-y-4">
              <h4 className="font-medium">Top 5 Redemption Requests</h4>
              {redeemRaw.map((row) => (
                <div key={row.investor} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{row.investor}</span>
                    <span className="text-destructive">
                      {formatCurrency(row.amount)} ({row.percentage}%)
                    </span>
                  </div>
                  <Progress
                    value={row.percentage * 4}
                    className="h-2 [&>div[role=progressbar]]:bg-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <footer className="flex justify-between text-sm text-muted-foreground">
        <span>Last file processed: NAV_2024_12_03.xlsx • 2 errors found</span>
        <span>Last updated: {new Date().toLocaleString()}</span>
      </footer>
    </div>
  );
}




// "use client";

// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Button } from "@/components/ui/button";
// import { Download } from "lucide-react";
// import { Line, Bar, Doughnut } from "react-chartjs-2";
// import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Title, Filler } from "chart.js";

// ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Title, Filler);

// export default function Page() {
//   return (
//     <div className="flex flex-col gap-6 p-4">

//       {/* Header */}
//       <div className="flex items-center justify-between gap-4">
//         <div className="flex gap-4">
//           <Select defaultValue="1-month">
//             <SelectTrigger className="w-[180px]">
//               <SelectValue placeholder="Select period" />
//             </SelectTrigger>
//             <SelectContent>
//               <SelectItem value="1-month">1 Month</SelectItem>
//               <SelectItem value="3-month">3 Months</SelectItem>
//               <SelectItem value="6-month">6 Months</SelectItem>
//               <SelectItem value="12-month">12 Months</SelectItem>
//               <SelectItem value="ytd">YTD</SelectItem>
//             </SelectContent>
//           </Select>

//           <Select defaultValue="all">
//             <SelectTrigger className="w-[180px]">
//               <SelectValue placeholder="Select fund type" />
//             </SelectTrigger>
//             <SelectContent>
//               <SelectItem value="all">All Funds</SelectItem>
//               <SelectItem value="equity">Equity Funds</SelectItem>
//               <SelectItem value="bond">Bond Funds</SelectItem>
//               <SelectItem value="hybrid">Hybrid Funds</SelectItem>
//             </SelectContent>
//           </Select>
//         </div>
//         <Button variant="outline">
//           <Download className="h-4 w-4 mr-2" /> Export Report
//         </Button>
//       </div>

//       {/* Cards */}
//       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//         {[
//           { title: "Net Cash", value: "$120,000" },
//           { title: "PnL", value: "$15,400" },
//           { title: "Unsettled Redemptions", value: "$8,500" },
//         ].map((card) => (
//           <Card key={card.title}>
//             <CardHeader>
//               <CardTitle>{card.title}</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <span className="text-2xl font-bold">{card.value}</span>
//             </CardContent>
//           </Card>
//         ))}
//       </div>

//       {/* Charts */}
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//         <Card>
//           <CardHeader>
//             <CardTitle>AUM Trend</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <Line
//               data={{
//                 labels: ["Jan", "Feb", "Mar", "Apr", "May"],
//                 datasets: [{
//                   label: "AUM",
//                   data: [100, 120, 115, 130, 125],
//                   fill: true,
//                   backgroundColor: "rgba(75, 192, 192, 0.2)",
//                   borderColor: "rgba(75, 192, 192, 1)",
//                   tension: 0.4,
//                 }],
//               }}
//             />
//           </CardContent>
//         </Card>
//         <Card>
//           <CardHeader>
//             <CardTitle>NAV Value Total vs Dividends</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <Bar
//               data={{
//                 labels: ["Jan", "Feb", "Mar", "Apr", "May"],
//                 datasets: [
//                   { label: "NAV Change", data: [5, -2, 4, -1, 3], backgroundColor: "rgba(153, 102, 255, 0.6)" },
//                   { label: "Dividends", data: [1, 1, 1, 2, 1.5], backgroundColor: "rgba(255, 159, 64, 0.6)" },
//                 ],
//               }}
//             />
//           </CardContent>
//         </Card>
//       </div>

//       {/* Outstanding Redemption */}
//       <Card>
//         <CardHeader>
//           <CardTitle>Outstanding Redemptions</CardTitle>
//         </CardHeader>
//         <CardContent className="grid md:grid-cols-2 gap-4">
//           <Doughnut
//             data={{
//               labels: ["Processed", "Pending"],
//               datasets: [{ data: [60, 40], backgroundColor: ["#22c55e", "#ef4444"] }],
//             }}
//           />
//           <div className="space-y-2">
//             {["Fund A - 40%", "Fund B - 25%", "Fund C - 15%", "Fund D - 10%", "Fund E - 10%"].map((item) => (
//               <div key={item} className="w-full bg-muted rounded-full overflow-hidden">
//                 <div className="bg-primary py-1 px-2 text-sm font-semibold text-white" style={{ width: item.split(" - ")[1] }}>{item}</div>
//               </div>
//             ))}
//           </div>
//         </CardContent>
//       </Card>

//       {/* Footer */}
//       <footer className="flex justify-between text-sm text-muted-foreground">
//         <div>Last file: Portfolio_0524.csv</div>
//         <div>Updated: 2024-06-03 10:15 AM</div>
//       </footer>
//     </div>
//   );
// }
