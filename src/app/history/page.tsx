"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bar } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import type { CarbonReport } from "@/lib/types";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

type ViewMode = "chart" | "list";
type RangeMode = 7 | 30;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

function nationalAverage(report: CarbonReport): number {
  return report.comparison?.national_avg_kg || 10;
}

function colorForReport(report: CarbonReport): {
  bar: string;
  bg: string;
  border: string;
  text: string;
  label: string;
} {
  const average = nationalAverage(report);
  const ratio = average > 0 ? report.total_co2e_kg / average : 1;

  if (ratio <= 1) {
    if (ratio <= 0.35) {
      return {
        bar: "rgba(21, 128, 61, 0.9)",
        bg: "bg-green-100",
        border: "border-l-green-700",
        text: "text-green-900",
        label: "Well below national average",
      };
    }
    if (ratio <= 0.7) {
      return {
        bar: "rgba(34, 197, 94, 0.82)",
        bg: "bg-green-50",
        border: "border-l-green-500",
        text: "text-green-800",
        label: "Below national average",
      };
    }
    return {
      bar: "rgba(134, 239, 172, 0.82)",
      bg: "bg-emerald-50",
      border: "border-l-emerald-300",
      text: "text-emerald-800",
      label: "Slightly below national average",
    };
  }

  if (ratio <= 1.35) {
    return {
      bar: "rgba(251, 146, 60, 0.85)",
      bg: "bg-orange-50",
      border: "border-l-orange-300",
      text: "text-orange-800",
      label: "Slightly above national average",
    };
  }
  if (ratio <= 2.5) {
    return {
      bar: "rgba(239, 68, 68, 0.82)",
      bg: "bg-red-50",
      border: "border-l-red-500",
      text: "text-red-800",
      label: "Above national average",
    };
  }
  return {
    bar: "rgba(153, 27, 27, 0.9)",
    bg: "bg-red-100",
    border: "border-l-red-800",
    text: "text-red-900",
    label: "Far above national average",
  };
}

function buildChartData(reports: CarbonReport[]): ChartData<"bar"> {
  const chronological = [...reports].reverse();
  return {
    labels: chronological.map((report) => formatShortDate(report.timestamp)),
    datasets: [
      {
        label: "kg CO2e",
        data: chronological.map((report) => report.total_co2e_kg),
        backgroundColor: chronological.map((report) => colorForReport(report).bar),
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };
}

const chartOptions: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => `${(ctx.parsed.y ?? 0).toFixed(1)} kg CO2e`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 8,
      },
    },
    y: {
      beginAtZero: true,
      grid: { color: "rgba(0,0,0,0.06)" },
      ticks: { callback: (value) => `${value} kg` },
    },
  },
};

export default function HistoryPage() {
  const [allReports, setAllReports] = useState<CarbonReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("chart");
  const [rangeMode, setRangeMode] = useState<RangeMode>(7);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/carbon/history?userId=default&days=365");
      const result = await response.json();
      if (!result.success) {
        setError(result.error || "Failed to load history.");
        return;
      }
      setAllReports(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const reports = useMemo(
    () => allReports.slice(0, rangeMode),
    [allReports, rangeMode],
  );

  const average = useMemo(
    () =>
      reports.length
        ? reports.reduce((sum, report) => sum + report.total_co2e_kg, 0) / reports.length
        : 0,
    [reports],
  );

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-green-50 to-white">
        <div className="mx-auto max-w-4xl px-4 py-14">
          <div className="animate-pulse space-y-5">
            <div className="h-8 w-40 rounded bg-gray-200" />
            <div className="card h-72" />
            <div className="card h-24" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white pb-16">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-950 sm:text-3xl">
              Carbon Footprint History
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Latest {reports.length} records
              {reports.length > 0 ? `, average ${average.toFixed(1)} kg CO2e` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchHistory} className="btn-outline px-4 py-2 text-sm">
              Refresh
            </button>
            <Link href="/input" className="btn-primary px-4 py-2 text-sm">
              New entry
            </Link>
          </div>
        </header>

        <div className="mb-5 flex flex-wrap gap-3">
          <div className="flex rounded-lg border border-gray-200 bg-white p-1">
            {[
              { value: 7, label: "Last 7 days" },
              { value: 30, label: "Last 30 days" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setRangeMode(option.value as RangeMode)}
                className={`rounded-md px-4 py-2 text-sm font-medium ${
                  rangeMode === option.value
                    ? "bg-primary text-white"
                    : "text-gray-600 hover:text-primary"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex rounded-lg border border-gray-200 bg-white p-1">
            <button
              onClick={() => setViewMode("chart")}
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                viewMode === "chart"
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:text-primary"
              }`}
            >
              Chart
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                viewMode === "list"
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:text-primary"
              }`}
            >
              List
            </button>
          </div>
        </div>

        {error && (
          <div className="card mb-6 border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {reports.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="text-4xl">📊</div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">No records yet</h2>
            <p className="mt-2 text-gray-600">
              Finished calculations will be saved here automatically.
            </p>
            <Link href="/input" className="btn-primary mt-6 inline-block">
              Start logging
            </Link>
          </div>
        ) : (
          <>
            {viewMode === "chart" && (
              <section className="card mb-6 p-6 sm:p-8">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                  {rangeMode === 7 ? "Last 7 records" : "Last 30 records"}
                </h2>
                <div className="h-72">
                  <Bar data={buildChartData(reports)} options={chartOptions} />
                </div>
              </section>
            )}

            <section className="space-y-3">
              {reports.map((report) => {
                const color = colorForReport(report);
                return (
                  <Link
                    key={report.session_id}
                    href={`/report?sessionId=${encodeURIComponent(report.session_id)}`}
                    className={`card block border-l-4 p-4 transition hover:shadow-card-hover sm:p-5 ${color.bg} ${color.border}`}
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="min-w-[160px]">
                        <p className="text-sm font-semibold text-gray-950">
                          {formatDate(report.timestamp)}
                        </p>
                        <p className={`mt-1 text-xs font-medium ${color.text}`}>
                          {color.label}
                        </p>
                      </div>
                      <div className="hidden flex-1 sm:block">
                        <div className="h-3 overflow-hidden rounded-full bg-white/70">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, (report.total_co2e_kg / Math.max(1, nationalAverage(report) * 2.5)) * 100)}%`,
                              backgroundColor: color.bar,
                            }}
                          />
                        </div>
                      </div>
                      <div className="ml-auto text-right">
                        <p className={`text-xl font-bold ${color.text}`}>
                          {report.total_co2e_kg.toFixed(1)}
                        </p>
                        <p className="text-xs text-gray-500">kg CO2e</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
