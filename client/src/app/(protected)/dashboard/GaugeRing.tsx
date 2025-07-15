// GaugeRing.tsx
"use client";
import { Doughnut } from "react-chartjs-2";
import {
  ArcElement,
  Tooltip,
  Legend,
  Chart as ChartJS,
  type ChartArea,
} from "chart.js";
import { ReactNode } from "react";

ChartJS.register(ArcElement, Tooltip, Legend);

type Props = {
  percentage: number;
  label: ReactNode;    
};

/* ---------------------------------------------
   Gradient helper – choose red >95 %, else green
---------------------------------------------- */
const makeGradient = (
  ctx: { chart: { ctx: CanvasRenderingContext2D; chartArea?: ChartArea } },
  isRed: boolean,
) => {
  const { ctx: g, chartArea } = ctx.chart;
  if (!chartArea)
    return isRed ? "#ef4444" : "#22c55e"; // first render fallback

  const grad = g.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);

  if (isRed) {
    grad.addColorStop(0, "#fca5a5"); // red-300
    grad.addColorStop(1, "#ef4444"); // red-500
  } else {
    grad.addColorStop(0, "#bbf7d0"); // green-200
    grad.addColorStop(1, "#22c55e"); // green-500
  }
  return grad;
};

export default function GaugeRing({ percentage, label }: Props) {
  const pctClamped = Math.min(Math.max(percentage, 0), 100);
  const isRed      = percentage > 95;

  const data = {
    labels: ["Outstanding", "Remaining"],
    datasets: [
      {
        data: [pctClamped, 100 - pctClamped],
        backgroundColor: (ctx: any) =>
          ctx.parsed !== undefined && ctx.dataIndex === 0
            ? makeGradient(ctx, isRed)
            : "#e5e7eb",
        hoverBackgroundColor: (ctx: any) =>
          ctx.dataIndex === 0 ? makeGradient(ctx, true) : "#e5e7eb",
        borderWidth: 0,
      },
    ],
  };

  const options = {
    rotation: 0,
    cutout: "75%", 
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  } as const;

  return (
    <div className="relative w-36 h-36">
      <Doughnut data={data} options={options} />
      <span
        className={`absolute inset-0 flex items-center justify-center
          font-bold text-2xl ${ isRed ? "text-red-700" : "text-green-600" }`}
      >
        {label}
      </span>
    </div>
  );
}
