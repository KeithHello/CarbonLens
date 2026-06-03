"use client";

import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import type { ChartData, ChartOptions } from "chart.js";
import type { EmissionBreakdown } from "@/lib/types";

ChartJS.register(ArcElement, Tooltip, Legend);

interface EmissionPieChartProps {
  breakdown: EmissionBreakdown[];
  compact?: boolean;
}

const PIE_COLORS = [
  "rgba(46,125,50,0.85)",
  "rgba(102,187,106,0.85)",
  "rgba(165,214,167,0.85)",
  "rgba(200,230,201,0.85)",
  "rgba(232,245,233,0.85)",
  "rgba(34,197,94,0.55)",
];

const PIE_BORDERS = [
  "#2E7D32",
  "#66BB6A",
  "#A5D6A7",
  "#C8E6C9",
  "#E8F5E9",
  "#22C55E",
];

const CATEGORY_EMOJI: Record<string, string> = {
  Food: "🥩",
  Transport: "🚗",
  Energy: "⚡",
  "Consumer Goods": "🛍️",
  Waste: "🗑️",
  "Services & Digital Life": "💻",
};

function displayCategory(category: string): string {
  return category;
}

export default function EmissionPieChart({
  breakdown,
  compact = false,
}: EmissionPieChartProps) {
  if (!breakdown || breakdown.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        No breakdown data yet
      </div>
    );
  }

  const labels = breakdown.map((item) => {
    const category = displayCategory(item.category);
    return `${CATEGORY_EMOJI[category] || ""} ${category}`.trim();
  });

  const data: ChartData<"pie"> = {
    labels,
    datasets: [
      {
        data: breakdown.map((item) => item.kg_co2e),
        backgroundColor: PIE_COLORS.slice(0, breakdown.length),
        borderColor: PIE_BORDERS.slice(0, breakdown.length),
        borderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<"pie"> = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          padding: compact ? 10 : 16,
          usePointStyle: true,
          pointStyleWidth: 10,
          font: { size: compact ? 11 : 13 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.label || "";
            const value = ctx.parsed;
            const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            return `${label}: ${value.toFixed(1)} kg (${pct}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="mx-auto max-w-xs sm:max-w-sm">
      <Pie data={data} options={options} />
    </div>
  );
}
