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

interface DailyCarbonSummary {
  dayKey: string;
  timestamp: string;
  reports: CarbonReport[];
  total_co2e_kg: number;
  national_avg_kg: number;
  categories: DailyCategorySummary[];
}

interface DailyCategorySummary {
  category: string;
  kg_co2e: number;
  percentage: number;
}

function dayKey(value: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

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

function nationalAverage(summary: DailyCarbonSummary): number {
  return summary.national_avg_kg || 10;
}

function colorForSummary(summary: DailyCarbonSummary): {
  bar: string;
  bg: string;
  border: string;
  text: string;
  label: string;
} {
  const average = nationalAverage(summary);
  const ratio = average > 0 ? summary.total_co2e_kg / average : 1;

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

function buildDailySummaries(reports: CarbonReport[]): DailyCarbonSummary[] {
  const groups = new Map<string, CarbonReport[]>();
  for (const report of reports) {
    const key = dayKey(report.timestamp);
    groups.set(key, [...(groups.get(key) ?? []), report]);
  }

  return Array.from(groups.entries())
    .map(([key, groupedReports]) => {
      const sorted = [...groupedReports].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      const total = sorted.reduce((sum, report) => sum + report.total_co2e_kg, 0);
      const byCategory = new Map<string, number>();
      for (const report of sorted) {
        for (const item of report.breakdown ?? []) {
          byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + item.kg_co2e);
        }
      }
      const categories = Array.from(byCategory.entries())
        .map(([category, kg]) => ({
          category,
          kg_co2e: kg,
          percentage: total > 0 ? (kg / total) * 100 : 0,
        }))
        .sort((a, b) => b.kg_co2e - a.kg_co2e);
      const nationalAverageTotal = sorted.reduce(
        (sum, report) => sum + (report.comparison?.national_avg_kg || 10),
        0,
      );
      return {
        dayKey: key,
        timestamp: sorted[0].timestamp,
        reports: sorted,
        total_co2e_kg: total,
        national_avg_kg: nationalAverageTotal / Math.max(1, sorted.length),
        categories,
      };
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function buildChartData(summaries: DailyCarbonSummary[]): ChartData<"bar"> {
  const chronological = [...summaries].reverse();
  return {
    labels: chronological.map((summary) => formatShortDate(summary.timestamp)),
    datasets: [
      {
        label: "kg CO2e",
        data: chronological.map((summary) => summary.total_co2e_kg),
        backgroundColor: chronological.map((summary) => colorForSummary(summary).bar),
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
      const response = await fetch("/api/insights?userId=default&days=365");
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

  const allDailySummaries = useMemo(() => buildDailySummaries(allReports), [allReports]);

  const dailySummaries = useMemo(
    () => allDailySummaries.slice(0, rangeMode),
    [allDailySummaries, rangeMode],
  );

  const average = useMemo(
    () =>
      dailySummaries.length
        ? dailySummaries.reduce((sum, summary) => sum + summary.total_co2e_kg, 0) /
          dailySummaries.length
        : 0,
    [dailySummaries],
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
              Carbon Insights
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Latest {dailySummaries.length} days
              {dailySummaries.length > 0 ? `, average ${average.toFixed(1)} kg CO2e/day` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchHistory} className="btn-outline px-4 py-2 text-sm">
              Refresh
            </button>
            <Link href="/record" className="btn-primary px-4 py-2 text-sm">
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

        {dailySummaries.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="text-4xl">📊</div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">No records yet</h2>
            <p className="mt-2 text-gray-600">
              Finished calculations will be saved here automatically.
            </p>
            <Link href="/record" className="btn-primary mt-6 inline-block">
              Start recording
            </Link>
          </div>
        ) : (
          <>
            {viewMode === "chart" && (
              <section className="card mb-6 p-6 sm:p-8">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                  {rangeMode === 7 ? "Last 7 days" : "Last 30 days"}
                </h2>
                <div className="h-72">
                  <Bar data={buildChartData(dailySummaries)} options={chartOptions} />
                </div>
              </section>
            )}

            <section className="space-y-3">
              {dailySummaries.map((summary) => {
                const color = colorForSummary(summary);
                return (
                  <Link
                    key={summary.dayKey}
                    href={`/insights/day?date=${encodeURIComponent(summary.dayKey)}`}
                    className={`card block border-l-4 p-4 transition hover:shadow-card-hover sm:p-5 ${color.bg} ${color.border}`}
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="min-w-[160px]">
                        <p className="text-sm font-semibold text-gray-950">
                          {formatDate(summary.timestamp)}
                        </p>
                        <p className={`mt-1 text-xs font-medium ${color.text}`}>
                          {color.label}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {summary.reports.length}{" "}
                          {summary.reports.length === 1 ? "entry" : "entries"} recorded
                        </p>
                      </div>
                      <div className="hidden flex-1 sm:block">
                        <div className="h-3 overflow-hidden rounded-full bg-white/70">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, (summary.total_co2e_kg / Math.max(1, nationalAverage(summary) * 2.5)) * 100)}%`,
                              backgroundColor: color.bar,
                            }}
                          />
                        </div>
                      </div>
                      <div className="ml-auto text-right">
                        <p className={`text-xl font-bold ${color.text}`}>
                          {summary.total_co2e_kg.toFixed(1)}
                        </p>
                        <p className="text-xs text-gray-500">kg CO2e</p>
                      </div>
                    </div>
                    <div className="mt-4 border-t border-white/70 pt-3">
                      <div className="flex flex-wrap gap-2">
                        {summary.categories.slice(0, 4).map((category) => (
                          <span
                            key={category.category}
                            className="rounded-full bg-white/75 px-3 py-1.5 text-xs font-medium text-gray-700"
                          >
                            {category.category} {category.kg_co2e.toFixed(1)} kg
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-gray-500">
                        Open daily details to review the records behind this total.
                      </p>
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
