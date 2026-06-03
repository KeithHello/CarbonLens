"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import type { ChartData, ChartOptions } from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

interface TrendDataPoint {
  date: string;
  value: number;
}

interface TrendLineChartProps {
  data: TrendDataPoint[];
  average: number;
}

export default function TrendLineChart({ data, average }: TrendLineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        No trend data yet
      </div>
    );
  }

  const labels = data.map((point) => {
    const date = new Date(point.date);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  });

  const values = data.map((point) => point.value);
  const anomalyThreshold = average * 1.5;

  const chartData: ChartData<"line"> = {
    labels,
    datasets: [
      {
        label: "Daily footprint (kg)",
        data: values,
        borderColor: "#2E7D32",
        backgroundColor: "rgba(46,125,50,0.12)",
        borderWidth: 2.5,
        pointBackgroundColor: values.map((value) =>
          value > anomalyThreshold ? "#EF5350" : "#2E7D32",
        ),
        pointBorderColor: values.map((value) =>
          value > anomalyThreshold ? "#D32F2F" : "#2E7D32",
        ),
        pointRadius: values.map((value) => (value > anomalyThreshold ? 6 : 4)),
        pointHoverRadius: 8,
        fill: true,
        tension: 0.3,
      },
      {
        label: "30-day average",
        data: Array(data.length).fill(average),
        borderColor: "rgba(156,163,175,0.6)",
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: "index",
    },
    plugins: {
      legend: {
        position: "top",
        labels: {
          usePointStyle: true,
          padding: 16,
          font: { size: 12 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const value = (ctx.parsed.y ?? 0).toFixed(1);
            const isAnomaly =
              ctx.datasetIndex === 0 && (ctx.parsed.y ?? 0) > anomalyThreshold;
            const suffix = ctx.datasetIndex === 1 ? " (average)" : "";
            return `${isAnomaly ? "High day: " : ""}${value} kg CO2e${suffix}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(0,0,0,0.05)" },
        ticks: {
          callback: (value) => `${value} kg`,
          font: { size: 11 },
        },
      },
    },
  };

  return (
    <div className="h-64 sm:h-72">
      <Line data={chartData} options={options} />
    </div>
  );
}
