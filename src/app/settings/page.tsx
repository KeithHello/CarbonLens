"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadActiveAdvicePlan } from "@/lib/advice";
import type { AdvicePlan } from "@/lib/types";

interface UserSettings {
  country: string;
  diet: string;
  transport: string;
}

interface FeedbackEntry {
  suggestionTitle?: string;
  title?: string;
  reductionKg?: number;
  suggestionText?: string;
  category?: string;
  difficulty?: "easy" | "medium" | "hard";
  accepted: boolean;
  timestamp: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  country: "JP",
  diet: "balanced",
  transport: "car",
};

const COUNTRY_OPTIONS = [
  { value: "JP", label: "Japan" },
  { value: "US", label: "United States" },
  { value: "CN", label: "China" },
  { value: "IN", label: "India" },
  { value: "GLOBAL", label: "Global average" },
];

const DIET_OPTIONS = [
  { value: "balanced", label: "Balanced diet" },
  { value: "flexitarian", label: "Flexitarian" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
];

const TRANSPORT_OPTIONS = [
  { value: "car", label: "Gasoline car" },
  { value: "hybrid", label: "Hybrid car" },
  { value: "ev", label: "Electric vehicle" },
  { value: "public", label: "Public transit" },
];

const DIFFICULTY_LABELS: Record<NonNullable<FeedbackEntry["difficulty"]>, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

function displayCategory(category: string): string {
  return category;
}

function loadSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem("carbonlens_settings");
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: UserSettings): void {
  localStorage.setItem("carbonlens_settings", JSON.stringify(settings));
}

function loadFeedback(): FeedbackEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("carbonlens_feedback");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function formatFeedbackDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [activeAdvice, setActiveAdvice] = useState<AdvicePlan | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setFeedback(loadFeedback());
    setActiveAdvice(loadActiveAdvicePlan());
  }, []);

  const stats = useMemo(() => {
    const accepted = feedback.filter((entry) => entry.accepted);
    const rejected = feedback.filter((entry) => !entry.accepted);
    return {
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
      totalReduction: accepted.reduce((sum, entry) => sum + (entry.reductionKg ?? 0), 0),
    };
  }, [feedback]);

  const acceptedSuggestions = useMemo(
    () =>
      feedback
        .filter((entry) => entry.accepted)
        .slice()
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        ),
    [feedback],
  );

  const updateSetting = useCallback(
    (key: keyof UserSettings, value: string) => {
      const next = { ...settings, [key]: value };
      setSettings(next);
      saveSettings(next);
      setIsSaved(true);
      window.setTimeout(() => setIsSaved(false), 1600);
    },
    [settings],
  );

  const clearFeedback = useCallback(() => {
    localStorage.removeItem("carbonlens_feedback");
    setFeedback([]);
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white pb-16">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-7">
          <h1 className="text-2xl font-bold text-gray-950 sm:text-3xl">Profile</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tune your preferences and review the reduction plan you selected.
          </p>
          {isSaved && (
            <span className="mt-3 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              Saved
            </span>
          )}
        </header>

        <section className="card mb-6 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-gray-900">Selected Reduction Plan</h2>
          {activeAdvice ? (
            <div className="mt-4 rounded-xl border border-green-100 bg-green-50 p-4">
              <p className="text-sm font-semibold text-gray-950">{activeAdvice.title}</p>
              <p className="mt-1 text-sm leading-6 text-green-800">
                {activeAdvice.short_term_action}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500">
              No active plan yet. Choose one in Discovery Hub.
            </p>
          )}
          <Link href="/advice" className="btn-outline mt-4 inline-block px-4 py-2 text-sm">
            Open Discovery Hub
          </Link>
        </section>

        <section className="card mb-6 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-gray-900">Country</h2>
          <p className="mb-4 mt-1 text-sm text-gray-500">
            Used to select the most relevant national emissions benchmark.
          </p>
          <select
            value={settings.country}
            onChange={(event) => updateSetting("country", event.target.value)}
            className="input-field"
          >
            {COUNTRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </section>

        <section className="card mb-6 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-gray-900">Diet Preference</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {DIET_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateSetting("diet", option.value)}
                className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                  settings.diet === option.value
                    ? "border-primary bg-green-50 font-medium text-primary"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card mb-6 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-gray-900">Main Transport Mode</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {TRANSPORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateSetting("transport", option.value)}
                className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                  settings.transport === option.value
                    ? "border-primary bg-green-50 font-medium text-primary"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card p-6 sm:p-8">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <h2 className="text-lg font-semibold text-gray-900">Adoption Stats</h2>
          </div>
          <p className="mb-5 text-sm text-gray-500">
            These stats come from the report page's Try it button and are stored locally in this browser.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-3xl font-extrabold text-primary">
                {stats.acceptedCount}
              </p>
              <p className="mt-1 text-sm text-gray-600">Adopted suggestions</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-3xl font-extrabold text-gray-700">
                {stats.rejectedCount}
              </p>
              <p className="mt-1 text-sm text-gray-600">Skipped suggestions</p>
            </div>
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-3xl font-extrabold text-primary">
                {stats.totalReduction.toFixed(1)}
              </p>
              <p className="mt-1 text-sm text-gray-600">kg CO2e estimated reduction</p>
            </div>
          </div>

          {stats.acceptedCount === 0 ? (
            <p className="mt-4 text-sm text-gray-400">
              Open any report and choose Try it on a suggestion. The adopted suggestion will appear here.
            </p>
          ) : (
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  Adopted Suggestions
                </h3>
                <span className="text-xs text-gray-400">
                  Latest {acceptedSuggestions.length}
                </span>
              </div>
              <div className="space-y-3">
                {acceptedSuggestions.map((entry, index) => {
                  const title = entry.suggestionTitle || entry.title || "Untitled suggestion";
                  return (
                    <article
                      key={`${title}-${entry.timestamp}-${index}`}
                      className="rounded-xl border border-green-100 bg-green-50/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-gray-950">{title}</h4>
                          {entry.suggestionText && (
                            <p className="mt-1 text-sm leading-6 text-green-800">
                              {entry.suggestionText}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-primary">
                          -{(entry.reductionKg ?? 0).toFixed(1)} kg
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        {entry.category && (
                          <span className="rounded-full bg-white px-2 py-1">
                            {displayCategory(entry.category)}
                          </span>
                        )}
                        {entry.difficulty && (
                          <span className="rounded-full bg-white px-2 py-1">
                            {DIFFICULTY_LABELS[entry.difficulty]}
                          </span>
                        )}
                        <span>{formatFeedbackDate(entry.timestamp)}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
              <p className="mt-4 text-sm text-green-700">
                Nice progress. Adopted suggestions help you steadily lower your personal footprint.
              </p>
            </div>
          )}

          {feedback.length > 0 && (
            <button
              type="button"
              onClick={clearFeedback}
              className="mt-5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              Clear adoption stats
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
