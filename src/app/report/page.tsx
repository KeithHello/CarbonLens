"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ActivityRecord, CarbonReport, Suggestion } from "@/lib/types";
import EmissionPieChart from "@/components/EmissionPieChart";

type ReportWithInput = CarbonReport & {
  input?: string;
};

interface FeedbackEntry {
  suggestionTitle: string;
  reductionKg: number;
  suggestionText?: string;
  category?: string;
  difficulty?: Suggestion["difficulty"];
  accepted: boolean;
  timestamp: string;
}

function displayCategory(category: string): string {
  return category;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(value));
}

function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "No records";
  }
  return `${Math.max(0.1, value).toFixed(1)}x`;
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
    label: `${displayCategory(item.category)} activity`,
    category: item.category,
    kg_co2e: item.kg_co2e,
  }));
}

function saveFeedback(suggestion: Suggestion, accepted: boolean): void {
  const raw = localStorage.getItem("carbonlens_feedback");
  const entries: FeedbackEntry[] = raw ? JSON.parse(raw) : [];
  const filtered = entries.filter((entry) => entry.suggestionTitle !== suggestion.title);
  filtered.push({
    suggestionTitle: suggestion.title,
    reductionKg: suggestion.reduction_kg,
    suggestionText: suggestion.suggestion,
    category: suggestion.category,
    difficulty: suggestion.difficulty,
    accepted,
    timestamp: new Date().toISOString(),
  });
  localStorage.setItem("carbonlens_feedback", JSON.stringify(filtered));
}

function loadFeedbackMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem("carbonlens_feedback");
    const entries: FeedbackEntry[] = raw ? JSON.parse(raw) : [];
    return Object.fromEntries(entries.map((entry) => [entry.suggestionTitle, entry.accepted]));
  } catch {
    return {};
  }
}

function ReportSkeleton() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="mx-auto max-w-2xl px-4 py-14">
        <div className="animate-pulse space-y-5">
          <div className="h-8 w-48 rounded bg-gray-200" />
          <div className="card h-56" />
          <div className="card h-40" />
        </div>
      </div>
    </main>
  );
}

function SuggestionsCard({ suggestions }: { suggestions: Suggestion[] }) {
  const [feedback, setFeedback] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setFeedback(loadFeedbackMap());
  }, []);

  if (!suggestions.length) return null;

  const handleFeedback = (suggestion: Suggestion, accepted: boolean) => {
    saveFeedback(suggestion, accepted);
    setFeedback((current) => ({ ...current, [suggestion.title]: accepted }));
  };

  return (
    <section className="card p-6 sm:p-8">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Reduction Suggestions</h2>
      <div className="space-y-3">
        {suggestions.map((suggestion) => {
          const current = feedback[suggestion.title];
          return (
            <div
              key={suggestion.rank}
              className={`rounded-lg border p-4 ${
                current === true
                  ? "border-green-200 bg-green-50"
                  : current === false
                    ? "border-gray-200 bg-gray-50 opacity-70"
                    : "border-gray-100"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
                  {suggestion.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-950">{suggestion.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{suggestion.problem}</p>
                  <p className="mt-1 text-sm font-medium text-primary-700">
                    {suggestion.suggestion}
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    Estimated reduction{" "}
                    <span className="font-semibold text-green-700">
                      {suggestion.reduction_kg.toFixed(1)} kg CO2e
                    </span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleFeedback(suggestion, true)}
                      className="rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 transition hover:bg-green-200"
                    >
                      {current === true ? "Adopted" : "Try it"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFeedback(suggestion, false)}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-200"
                    >
                      {current === false ? "Skipped" : "Not now"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecordDetailsCard({
  report,
  onDeleteRecord,
  deletingRecordId,
}: {
  report: ReportWithInput;
  onDeleteRecord: (recordId: string) => void;
  deletingRecordId: string | null;
}) {
  const records = recordsFromReport(report);
  return (
    <section className="card mb-6 p-6 sm:p-8">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Entry Details</h2>
      <div className="rounded-lg bg-gray-50 p-4">
        <p className="text-sm text-gray-500">Original input</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-800">
          {report.input || "No original input was saved for this report."}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {records.map((record, index) => (
          <div key={record.id} className="rounded-lg border border-gray-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-700">
                    {index + 1}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {displayCategory(record.category)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium leading-6 text-gray-900">
                  {record.label}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {record.kg_co2e.toFixed(1)} kg CO2e
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDeleteRecord(record.id)}
                disabled={deletingRecordId === record.id}
                className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                {deletingRecordId === record.id ? "Deleting" : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        <p className="text-sm font-medium text-gray-700">Category summary</p>
        {report.breakdown.map((item) => (
          <div key={item.category}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">{displayCategory(item.category)}</span>
              <span className="text-gray-600">
                {item.kg_co2e.toFixed(1)} kg CO2e · {item.percentage}%
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, item.percentage)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [report, setReport] = useState<ReportWithInput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (!sessionId) {
      setError("Missing sessionId. The report cannot be loaded.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/carbon/report?sessionId=${encodeURIComponent(sessionId)}&userId=default`,
      );
      const result = await response.json();
      if (!result.success) {
        setError(result.error || "Failed to load report.");
        setReport(null);
        return;
      }
      setReport(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report.");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const deleteRecord = useCallback(
    async (recordId: string) => {
      if (!sessionId) return;
      const confirmed = window.confirm(
        "Delete this activity record? The report total will be recalculated.",
      );
      if (!confirmed) return;

      setDeletingRecordId(recordId);
      setError(null);
      try {
        const response = await fetch(
          `/api/carbon/report/record?sessionId=${encodeURIComponent(sessionId)}&recordId=${encodeURIComponent(recordId)}&userId=default`,
          { method: "DELETE" },
        );
        const result = await response.json();
        if (!result.success) {
          setError(result.error || "Failed to delete record.");
          return;
        }
        if (result.reportDeleted || !result.data) {
          router.push("/insights");
          return;
        }
        setReport(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete record.");
      } finally {
        setDeletingRecordId(null);
      }
    },
    [router, sessionId],
  );

  const deleteReport = useCallback(async () => {
    if (!sessionId) return;
    const confirmed = window.confirm(
      "Delete this entire carbon footprint report? This cannot be undone.",
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/carbon/report?sessionId=${encodeURIComponent(sessionId)}&userId=default`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!result.success) {
        setError(result.error || "Failed to delete report.");
        return;
      }
      router.push("/insights");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete report.");
    } finally {
      setIsDeleting(false);
    }
  }, [router, sessionId]);

  if (isLoading) return <ReportSkeleton />;

  if (!report) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-green-50 to-white">
        <div className="mx-auto max-w-2xl px-4 py-14">
          <div className="card p-8 text-center">
            <h1 className="text-xl font-semibold text-gray-950">Report unavailable</h1>
            <p className="mt-2 text-gray-600">{error || "This record could not be found."}</p>
            <button onClick={() => router.push("/insights")} className="btn-primary mt-6">
              Back to history
            </button>
          </div>
        </div>
      </main>
    );
  }

  const globalRatio = report.comparison?.global_avg_kg
    ? report.total_co2e_kg / report.comparison.global_avg_kg
    : null;
  const nationalRatio = report.comparison?.national_avg_kg
    ? report.total_co2e_kg / report.comparison.national_avg_kg
    : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white pb-16">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-6">
          <p className="text-sm text-gray-500">{formatDate(report.timestamp)}</p>
          <h1 className="text-2xl font-bold text-gray-950 sm:text-3xl">Carbon Footprint Report</h1>
        </header>

        <section className="card mb-6 overflow-hidden">
          <div className="bg-primary p-6 text-white sm:p-8">
            <p className="text-sm font-medium opacity-80">Total emissions</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-5xl font-extrabold">
                {report.total_co2e_kg.toFixed(1)}
              </span>
              <span className="pb-2 text-lg font-medium opacity-90">kg CO2e</span>
            </div>
            {report.tier_label && (
              <p className="mt-3 text-sm opacity-90">{report.tier_label}</p>
            )}
          </div>
        </section>

        <section className="card mb-6 p-6 sm:p-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Emission Sources</h2>
          <EmissionPieChart breakdown={report.breakdown} compact />
        </section>

        <section className="card mb-6 p-6 sm:p-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Comparison</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Global average</p>
              <p className="mt-1 text-xl font-bold text-gray-950">
                {report.comparison.global_avg_kg} kg
              </p>
              <p className="mt-1 text-sm text-gray-600">
                This entry is about {formatRatio(globalRatio)}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-500">National average</p>
              <p className="mt-1 text-xl font-bold text-gray-950">
                {report.comparison.national_avg_kg} kg
              </p>
              <p className="mt-1 text-sm text-gray-600">
                This entry is about {formatRatio(nationalRatio)}
              </p>
            </div>
          </div>
          {report.comparison.vs_personal_avg !== null && (
            <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
              Compared with your recent average, this entry is about{" "}
              {formatRatio(report.comparison.vs_personal_avg)}.
            </p>
          )}
        </section>

        <RecordDetailsCard
          report={report}
          onDeleteRecord={deleteRecord}
          deletingRecordId={deletingRecordId}
        />

        <SuggestionsCard suggestions={report.suggestions ?? []} />

        <section className="card mt-6 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-gray-900">Tree Offset Reference</h2>
          <p className="mt-2 text-gray-600">
            This footprint equals about{" "}
            <span className="font-semibold text-primary-700">
              {report.trees_needed.toFixed(1)}
            </span>{" "}
            cedar trees absorbing carbon for one day. Reducing emissions is better than
            offsetting; trees are a helpful supplement, not a substitute.
          </p>
        </section>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button onClick={() => router.push("/record")} className="btn-primary">
            Record another entry
          </button>
          <button onClick={() => router.push("/insights")} className="btn-outline">
            View history
          </button>
          <button
            onClick={deleteReport}
            disabled={isDeleting}
            className="rounded-xl border-2 border-red-200 px-6 py-3 font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete report"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ReportContent />
    </Suspense>
  );
}
