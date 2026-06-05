"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import EmissionPieChart from "@/components/EmissionPieChart";
import type { ActivityRecord, CarbonReport, EmissionBreakdown } from "@/lib/types";
import {
  formatBenchmarkReference,
  getCountryReference,
  GLOBAL_REFERENCE,
  loadStoredCountryCode,
  type BenchmarkReference,
} from "@/lib/benchmarks";

type ReportWithInput = CarbonReport & { input?: string };

interface CategorySummary {
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
    weekday: "long",
  }).format(new Date(`${value}T12:00:00`));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRatio(total: number, average: number): string {
  if (!average || !Number.isFinite(average)) return "No baseline";
  const percentage = Math.round((total / average) * 100);
  return `${percentage}% of daily average`;
}

function recordsFromReport(report: ReportWithInput): ActivityRecord[] {
  if (report.records && report.records.length > 0) return report.records;
  if (report.breakdown.length === 1) {
    return [
      {
        id: "record_1",
        label: report.input || "This activity",
        category: report.breakdown[0].category,
        kg_co2e: report.total_co2e_kg,
      },
    ];
  }
  return report.breakdown.map((item, index) => ({
    id: `record_${index + 1}`,
    label: `${item.category} activity`,
    category: item.category,
    kg_co2e: item.kg_co2e,
  }));
}

function buildCategorySummary(reports: ReportWithInput[]): CategorySummary[] {
  const total = reports.reduce((sum, report) => sum + report.total_co2e_kg, 0);
  const byCategory = new Map<string, number>();
  for (const report of reports) {
    for (const item of report.breakdown ?? []) {
      byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + item.kg_co2e);
    }
  }
  return Array.from(byCategory.entries())
    .map(([category, kg]) => ({
      category,
      kg_co2e: kg,
      percentage: total > 0 ? (kg / total) * 100 : 0,
    }))
    .sort((a, b) => b.kg_co2e - a.kg_co2e);
}

function buildDailyBreakdown(categories: CategorySummary[]): EmissionBreakdown[] {
  let used = 0;
  return categories.map((category, index) => {
    const percentage =
      index === categories.length - 1
        ? Math.max(0, 100 - used)
        : Math.round(category.percentage);
    used += percentage;
    return {
      category: category.category,
      kg_co2e: Math.round(category.kg_co2e * 1000) / 1000,
      percentage,
    };
  });
}

function dailyTier(total: number, nationalAverage: number): string {
  if (!nationalAverage) return "Daily footprint";
  const ratio = total / nationalAverage;
  if (ratio <= 0.35) return "Well below national average";
  if (ratio <= 0.7) return "Below national average";
  if (ratio <= 1) return "Slightly below national average";
  if (ratio <= 1.35) return "Slightly above national average";
  if (ratio <= 2.5) return "Above national average";
  return "Far above national average";
}

function DayDetailContent() {
  const searchParams = useSearchParams();
  const selectedDate = searchParams.get("date");
  const [reports, setReports] = useState<ReportWithInput[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingRecordKey, setDeletingRecordKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nationalReference, setNationalReference] = useState<BenchmarkReference>(() =>
    getCountryReference(),
  );

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/insights?userId=default&days=365");
      const result = await response.json();
      if (!result.success) {
        setError(result.error || "Failed to load daily records.");
        return;
      }
      const dayReports = ((result.data ?? []) as ReportWithInput[])
        .filter((report) => selectedDate && dayKey(report.timestamp) === selectedDate)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setReports(dayReports);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load daily records.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    setNationalReference(getCountryReference(loadStoredCountryCode()));
  }, []);

  const total = useMemo(
    () => reports.reduce((sum, report) => sum + report.total_co2e_kg, 0),
    [reports],
  );
  const categories = useMemo(() => buildCategorySummary(reports), [reports]);
  const breakdown = useMemo(() => buildDailyBreakdown(categories), [categories]);
  const globalAverage = useMemo(
    () => (reports.length ? GLOBAL_REFERENCE.daily_kg_co2e : 0),
    [reports.length],
  );
  const nationalAverage = useMemo(
    () => (reports.length ? nationalReference.daily_kg_co2e : 0),
    [nationalReference.daily_kg_co2e, reports.length],
  );

  const deleteRecord = useCallback(
    async (report: ReportWithInput, record: ActivityRecord) => {
      const confirmed = window.confirm("Delete this carbon footprint record?");
      if (!confirmed) return;

      const recordKey = `${report.session_id}:${record.id}`;
      setDeletingRecordKey(recordKey);
      setError(null);
      try {
        const response = await fetch(
          `/api/insights/report/record?sessionId=${encodeURIComponent(report.session_id)}&recordId=${encodeURIComponent(record.id)}&userId=default`,
          { method: "DELETE" },
        );
        const result = await response.json();
        if (!result.success) {
          setError(result.error || "Failed to delete record.");
          return;
        }

        setReports((current) => {
          if (result.reportDeleted || !result.data) {
            return current.filter((item) => item.session_id !== report.session_id);
          }
          return current.map((item) =>
            item.session_id === report.session_id ? result.data : item,
          );
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete record.");
      } finally {
        setDeletingRecordKey(null);
      }
    },
    [],
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white pb-16">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/insights" className="text-sm font-medium text-primary hover:text-primary-700">
              Back to Insights
            </Link>
            <h1 className="mt-3 text-2xl font-bold text-gray-950 sm:text-3xl">
              Carbon Footprint Report
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {selectedDate ? formatDate(selectedDate) : "Daily records"} · {reports.length}{" "}
              {reports.length === 1 ? "entry" : "entries"} recorded
            </p>
          </div>
          <Link href="/record" className="btn-primary px-4 py-2 text-sm">
            New entry
          </Link>
        </header>

        {isLoading ? (
          <div className="space-y-4">
            <div className="card h-32 animate-pulse bg-gray-100" />
            <div className="card h-48 animate-pulse bg-gray-100" />
          </div>
        ) : error ? (
          <div className="card border-red-200 bg-red-50 p-5 text-red-700">{error}</div>
        ) : reports.length === 0 ? (
          <div className="card p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-950">No records for this date</h2>
            <p className="mt-2 text-gray-600">Try another day from Insights.</p>
          </div>
        ) : (
          <>
            <section className="card mb-6 overflow-hidden">
              <div className="bg-primary p-6 text-white sm:p-8">
                <p className="text-sm font-medium opacity-80">Total emissions</p>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-5xl font-extrabold">{total.toFixed(1)}</span>
                  <span className="pb-2 text-lg font-medium opacity-90">kg CO2e</span>
                </div>
                <p className="mt-3 text-sm opacity-90">
                  {dailyTier(total, nationalAverage)}
                </p>
              </div>
            </section>

            <section className="card mb-6 p-6 sm:p-8">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Emission Sources</h2>
              <EmissionPieChart breakdown={breakdown} compact />
              <div className="mt-5 flex flex-wrap gap-2">
                {breakdown.map((category) => (
                  <span
                    key={category.category}
                    className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-green-800"
                  >
                    {category.category} {category.kg_co2e.toFixed(1)} kg · {category.percentage}%
                  </span>
                ))}
              </div>
            </section>

            <section className="card mb-6 p-6 sm:p-8">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Daily Comparison</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">Global daily average</p>
                  <p className="mt-1 text-xl font-bold text-gray-950">
                    {globalAverage.toFixed(1)} kg
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {formatRatio(total, globalAverage)}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">
                    {nationalReference.country} daily average
                  </p>
                  <p className="mt-1 text-xl font-bold text-gray-950">
                    {nationalAverage.toFixed(1)} kg
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {formatRatio(total, nationalAverage)}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-green-50 px-4 py-3 text-green-800">
                  <p className="font-semibold">Global Reference</p>
                  <p className="mt-1 leading-6">{formatBenchmarkReference(GLOBAL_REFERENCE)}</p>
                  <a
                    href={GLOBAL_REFERENCE.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block font-medium text-primary hover:text-primary-700"
                  >
                    View source
                  </a>
                </div>
                <div className="rounded-lg bg-green-50 px-4 py-3 text-green-800">
                  <p className="font-semibold">{nationalReference.country} Reference</p>
                  <p className="mt-1 leading-6">{formatBenchmarkReference(nationalReference)}</p>
                  <a
                    href={nationalReference.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block font-medium text-primary hover:text-primary-700"
                  >
                    View source
                  </a>
                </div>
              </div>
            </section>

            <section className="card p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-gray-900">Daily Records</h2>
              <p className="mt-1 text-sm text-gray-500">
                All carbon footprint records saved on this date.
              </p>
              <div className="mt-5 space-y-4">
              {reports.map((report, reportIndex) => (
                <article key={report.session_id} className="rounded-lg border border-gray-100 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-950">
                        Entry {reportIndex + 1} · {formatTime(report.timestamp)}
                      </p>
                      <p className="mt-1 max-w-2xl text-sm text-gray-600">
                        {report.input || "No original input saved."}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-primary">
                        {report.total_co2e_kg.toFixed(1)}
                      </p>
                      <p className="text-xs text-gray-500">kg CO2e</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {recordsFromReport(report).map((record, index) => (
                      <div
                        key={record.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 flex-1 text-gray-700">
                          {index + 1}. {record.label}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-gray-600">
                          {record.category}
                        </span>
                        <span className="font-semibold text-gray-900">
                          {record.kg_co2e.toFixed(1)} kg
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteRecord(report, record)}
                          disabled={deletingRecordKey === `${report.session_id}:${record.id}`}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingRecordKey === `${report.session_id}:${record.id}`
                            ? "Deleting"
                            : "Delete"}
                        </button>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default function InsightDayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-green-50" />}>
      <DayDetailContent />
    </Suspense>
  );
}
