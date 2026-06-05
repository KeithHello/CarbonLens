"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { loadActiveAdvicePlan } from "@/lib/advice";
import type { AdvicePlan } from "@/lib/types";

interface UserSettings {
  country: string;
  diet: string;
  transport: string;
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

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [activeAdvice, setActiveAdvice] = useState<AdvicePlan | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setActiveAdvice(loadActiveAdvicePlan());
  }, []);

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
          <Link href="/discovery-hub" className="btn-outline mt-4 inline-block px-4 py-2 text-sm">
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
      </div>
    </main>
  );
}
