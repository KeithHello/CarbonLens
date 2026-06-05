"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import VoiceRecorder from "@/components/VoiceRecorder";

function dayKeyFromTimestamp(value?: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value ? new Date(value) : new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export default function VoicePage() {
  const router = useRouter();
  const [transcript, setTranscript] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTranscript = useCallback((text: string) => {
    setTranscript(text);
  }, []);

  const handleNavigateToInput = useCallback(() => {
    router.push("/record");
  }, [router]);

  const handleCalculate = useCallback(async () => {
    if (!transcript.trim()) {
      setError("Please record an activity before calculating.");
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const response = await fetch("/api/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: transcript, userId: "default" }),
      });

      const result = await response.json();

      if (!result.success || !result.data) {
        setError(result.error || "Calculation failed.");
        setIsCalculating(false);
        return;
      }

      router.push(
        `/insights/day?date=${encodeURIComponent(dayKeyFromTimestamp(result.data.timestamp))}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setIsCalculating(false);
    }
  }, [transcript, router]);

  return (
    <main className="min-h-screen animate-fadeIn bg-gradient-to-b from-green-50 to-white">
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-20">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            🎤 Voice Logging
          </h1>
          <p className="mt-3 text-gray-600">
            Say what you did today. CarbonLens turns your speech into an activity log.
          </p>
        </div>

        <div className="card p-8 sm:p-10">
          <VoiceRecorder
            onTranscript={handleTranscript}
            onNavigateToInput={handleNavigateToInput}
          />
        </div>

        {transcript && (
          <div className="mt-6 flex animate-slideUp flex-col gap-3 sm:flex-row">
            <button onClick={handleNavigateToInput} className="btn-outline flex-1">
              Edit as text
            </button>
            <button
              onClick={handleCalculate}
              disabled={isCalculating}
              className="btn-primary flex-1"
            >
              {isCalculating ? "Calculating..." : "Calculate footprint"}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 animate-slideUp rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-10 text-center">
          <p className="text-xs text-gray-400">Example phrases</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {[
              "I drove 20 km to work, ate beef for lunch, and used AC at home.",
              "I took the subway, ate a chicken rice bowl, and drank coffee.",
              "I bought vegetables by bike and did one load of laundry.",
            ].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setTranscript(example)}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 transition-colors hover:border-primary hover:text-primary"
              >
                {example.length > 48 ? `${example.slice(0, 48)}...` : example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
