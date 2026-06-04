"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  generateAdvicePlans,
  loadActiveAdvicePlan,
  mergeSelectedPlanWithLatest,
  saveActiveAdvicePlan,
} from "@/lib/advice";
import type { AdvicePlan, CarbonReport } from "@/lib/types";

type EditingDraft = Pick<
  AdvicePlan,
  "title" | "summary" | "short_term_action" | "mid_term_action" | "long_term_action"
>;

function createDraft(plan: AdvicePlan): EditingDraft {
  return {
    title: plan.title,
    summary: plan.summary,
    short_term_action: plan.short_term_action,
    mid_term_action: plan.mid_term_action,
    long_term_action: plan.long_term_action,
  };
}

function applyDraft(plan: AdvicePlan, draft: EditingDraft): AdvicePlan {
  return {
    ...plan,
    ...draft,
    user_edited: true,
    updated_at: new Date().toISOString(),
  };
}

function formatDate(value?: string): string {
  if (!value) return "Not selected";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdvicePage() {
  const [reports, setReports] = useState<CarbonReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<AdvicePlan | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditingDraft | null>(null);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/carbon/history?userId=default&days=30");
      const result = await response.json();
      if (!result.success) {
        setError(result.error || "Failed to load the last 30 days.");
        return;
      }
      setReports(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the last 30 days.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setActivePlan(loadActiveAdvicePlan());
    fetchReports();
  }, [fetchReports]);

  const generatedPlans = useMemo(() => generateAdvicePlans(reports), [reports]);

  useEffect(() => {
    setActivePlan((current) => {
      const merged = mergeSelectedPlanWithLatest(current, generatedPlans);
      if (merged && current && merged !== current) {
        saveActiveAdvicePlan(merged);
      }
      return merged;
    });
  }, [generatedPlans]);

  const plans = useMemo(
    () =>
      generatedPlans.map((plan) =>
        activePlan?.id === plan.id ? { ...plan, ...activePlan } : plan,
      ),
    [activePlan, generatedPlans],
  );

  const selectPlan = useCallback((plan: AdvicePlan) => {
    const saved = saveActiveAdvicePlan(plan);
    setActivePlan(saved);
    setEditingPlanId(null);
    setDraft(null);
  }, []);

  const beginEditing = useCallback((plan: AdvicePlan) => {
    setEditingPlanId(plan.id);
    setDraft(createDraft(plan));
  }, []);

  const saveEdit = useCallback(
    (plan: AdvicePlan) => {
      if (!draft) return;
      const editedPlan = applyDraft(plan, draft);
      selectPlan(editedPlan);
    },
    [draft, selectPlan],
  );

  const average = reports.length
    ? reports.reduce((sum, report) => sum + report.total_co2e_kg, 0) / reports.length
    : 0;

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white pb-16">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-green-700">
              30-day trend advice
            </p>
            <h1 className="mt-2 text-2xl font-bold text-gray-950 sm:text-3xl">
              Discovery Hub
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
              Choose one active reduction plan. These five options refresh from your
              latest 30-day carbon-footprint records.
            </p>
          </div>
          <button type="button" onClick={fetchReports} className="btn-outline px-4 py-2 text-sm">
            Refresh trends
          </button>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="card p-4">
            <p className="text-2xl font-extrabold text-primary">{reports.length}</p>
            <p className="mt-1 text-sm text-gray-500">records analyzed</p>
          </div>
          <div className="card p-4">
            <p className="text-2xl font-extrabold text-primary">
              {average ? average.toFixed(1) : "--"}
            </p>
            <p className="mt-1 text-sm text-gray-500">kg CO2e/day average</p>
          </div>
          <div className="card p-4">
            <p className="text-2xl font-extrabold text-primary">
              {activePlan ? "1" : "0"}
            </p>
            <p className="mt-1 text-sm text-gray-500">active selected plan</p>
          </div>
        </section>

        {activePlan && (
          <section className="mb-6 rounded-xl border border-green-200 bg-green-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700">
                  Current active plan
                </p>
                <h2 className="mt-2 text-lg font-semibold text-gray-950">{activePlan.title}</h2>
                <p className="mt-1 text-sm leading-6 text-green-800">
                  {activePlan.short_term_action}
                </p>
                <p className="mt-2 text-xs text-green-700">
                  Selected {formatDate(activePlan.selected_at)}
                </p>
              </div>
              <Link href="/record" className="btn-primary px-4 py-2 text-sm">
                Record with this plan
              </Link>
            </div>
          </section>
        )}

        {error && (
          <div className="card mb-6 border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="card h-48 animate-pulse bg-gray-100" />
            ))}
          </div>
        ) : (
          <section className="space-y-4">
            {plans.map((plan) => {
              const isSelected = activePlan?.id === plan.id;
              const isEditing = editingPlanId === plan.id;

              return (
                <article
                  key={plan.id}
                  className={`card p-5 sm:p-6 ${
                    isSelected ? "border-green-300 bg-green-50/70" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
                          {plan.rank}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                          {plan.primary_driver}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                          {plan.difficulty}
                        </span>
                        <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                          -{plan.estimated_reduction_kg.toFixed(1)} kg/day potential
                        </span>
                        {isSelected && (
                          <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-white">
                            Active
                          </span>
                        )}
                      </div>

                      {isEditing && draft ? (
                        <div className="space-y-3">
                          <input
                            value={draft.title}
                            onChange={(event) =>
                              setDraft({ ...draft, title: event.target.value })
                            }
                            className="input-field"
                          />
                          <textarea
                            value={draft.summary}
                            onChange={(event) =>
                              setDraft({ ...draft, summary: event.target.value })
                            }
                            className="input-field min-h-[80px]"
                          />
                          <textarea
                            value={draft.short_term_action}
                            onChange={(event) =>
                              setDraft({ ...draft, short_term_action: event.target.value })
                            }
                            className="input-field min-h-[70px]"
                          />
                          <textarea
                            value={draft.mid_term_action}
                            onChange={(event) =>
                              setDraft({ ...draft, mid_term_action: event.target.value })
                            }
                            className="input-field min-h-[70px]"
                          />
                          <textarea
                            value={draft.long_term_action}
                            onChange={(event) =>
                              setDraft({ ...draft, long_term_action: event.target.value })
                            }
                            className="input-field min-h-[70px]"
                          />
                        </div>
                      ) : (
                        <>
                          <h2 className="text-lg font-semibold text-gray-950">
                            {plan.title}
                          </h2>
                          <p className="mt-2 text-sm leading-6 text-gray-600">
                            {plan.summary}
                          </p>
                          <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">
                            {plan.evidence}
                          </p>
                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-lg border border-gray-100 bg-white p-3">
                              <p className="text-xs font-semibold uppercase text-gray-400">
                                Short-term
                              </p>
                              <p className="mt-1 text-sm text-gray-700">
                                {plan.short_term_action}
                              </p>
                            </div>
                            <div className="rounded-lg border border-gray-100 bg-white p-3">
                              <p className="text-xs font-semibold uppercase text-gray-400">
                                Mid-term
                              </p>
                              <p className="mt-1 text-sm text-gray-700">
                                {plan.mid_term_action}
                              </p>
                            </div>
                            <div className="rounded-lg border border-gray-100 bg-white p-3">
                              <p className="text-xs font-semibold uppercase text-gray-400">
                                Long-term
                              </p>
                              <p className="mt-1 text-sm text-gray-700">
                                {plan.long_term_action}
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEdit(plan)}
                          className="btn-primary px-4 py-2 text-sm"
                        >
                          Save and select
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPlanId(null);
                            setDraft(null);
                          }}
                          className="btn-outline px-4 py-2 text-sm"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => selectPlan(plan)}
                          className="btn-primary px-4 py-2 text-sm"
                        >
                          {isSelected ? "Keep selected" : "Select this plan"}
                        </button>
                        <button
                          type="button"
                          onClick={() => beginEditing(plan)}
                          className="btn-outline px-4 py-2 text-sm"
                        >
                          Edit plan
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
