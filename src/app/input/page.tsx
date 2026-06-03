"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface RecentEntry {
  text: string;
  timestamp: string;
}

type BrowserSpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type BrowserSpeechRecognitionErrorEvent = Event & {
  error?: string;
};

type BrowserSpeechRecognition = EventTarget & {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const speechWindow = window as Window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
}

const EXAMPLES = [
  "Ate 200g of beef",
  "Drove 10 km to work",
  "Used air conditioning for 5 hours",
  "Took the subway round trip",
  "Flew from Tokyo to Osaka",
];

const CATEGORIES = [
  { icon: "🚗", label: "Transport", hint: "car, subway, flight" },
  { icon: "🥩", label: "Food", hint: "beef, coffee, delivery" },
  { icon: "⚡", label: "Energy", hint: "AC, laundry, bath" },
  { icon: "🛍️", label: "Consumer Goods", hint: "clothes, phone" },
  { icon: "🗑️", label: "Waste", hint: "trash, recycling" },
  { icon: "💻", label: "Services & Digital Life", hint: "video, cloud, hotel" },
];

function loadRecentEntries(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("carbonlens_recent_entries");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentEntry(text: string): void {
  const entries = loadRecentEntries().filter((entry) => entry.text !== text);
  entries.unshift({ text, timestamp: new Date().toISOString() });
  localStorage.setItem("carbonlens_recent_entries", JSON.stringify(entries.slice(0, 5)));
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function mergeTranscript(baseText: string, transcript: string): string {
  const trimmedBase = baseText.trim();
  const trimmedTranscript = transcript.trim();
  if (!trimmedTranscript) return trimmedBase;
  return trimmedBase ? `${trimmedBase}, ${trimmedTranscript}` : trimmedTranscript;
}

export default function InputPage() {
  const router = useRouter();
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const baseInputRef = useRef("");
  const transcriptRef = useRef("");
  const manuallyStoppingRef = useRef(false);
  const [input, setInput] = useState("");
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const speechSupported = useMemo(() => Boolean(getSpeechRecognitionConstructor()), []);

  useEffect(() => {
    setRecentEntries(loadRecentEntries());
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setElapsedSeconds(0);
      return;
    }
    const timer = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isLoading]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const appendText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput((prev) => mergeTranscript(prev, trimmed));
    setError(null);
  }, []);

  const stopVoice = useCallback(() => {
    manuallyStoppingRef.current = true;
    setVoiceStatus("Stopping recording and converting speech to text...");
    recognitionRef.current?.stop();
  }, []);

  const startVoice = useCallback(() => {
    if (!speechSupported || isLoading) {
      setError("This browser does not support speech recognition. Please use Chrome or Edge.");
      return;
    }

    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) return;

    baseInputRef.current = input;
    transcriptRef.current = "";
    manuallyStoppingRef.current = false;
    setError(null);
    setVoiceStatus("Recording. Tap the microphone again to stop.");

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceStatus("Recording. Tap the microphone again to stop.");
    };

    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0]?.transcript ?? "";
      }

      const trimmed = transcript.trim();
      transcriptRef.current = trimmed;
      if (trimmed) {
        setInput(mergeTranscript(baseInputRef.current, trimmed));
        setError(null);
        setVoiceStatus("Speech detected. Tap the microphone again to finish.");
      }
    };

    recognition.onerror = (event) => {
      const hadTranscript = transcriptRef.current.trim().length > 0;
      setIsListening(false);
      recognitionRef.current = null;

      if (hadTranscript || manuallyStoppingRef.current) {
        setVoiceStatus(null);
        return;
      }

      const message =
        event.error === "not-allowed"
          ? "Microphone access is blocked. Please allow microphone permission in your browser."
          : "Speech recognition did not complete. Please try again.";
      setError(message);
      setVoiceStatus(null);
    };

    recognition.onend = () => {
      const transcript = transcriptRef.current.trim();
      if (transcript) {
        setInput(mergeTranscript(baseInputRef.current, transcript));
        setError(null);
      } else if (manuallyStoppingRef.current) {
        setError("No speech was detected. Please move closer to the microphone and try again.");
      }

      manuallyStoppingRef.current = false;
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceStatus(null);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setError("Speech recognition could not start. Please try again.");
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceStatus(null);
    }
  }, [input, isLoading, speechSupported]);

  const toggleVoice = useCallback(() => {
    if (isListening) {
      stopVoice();
      return;
    }
    startVoice();
  }, [isListening, startVoice, stopVoice]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = input.trim();
      if (!trimmed) {
        setError("Please describe at least one activity.");
        return;
      }

      if (isListening) {
        stopVoice();
      }

      saveRecentEntry(trimmed);
      setRecentEntries(loadRecentEntries());
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/carbon/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: trimmed, userId: "default" }),
        });
        const result = await response.json();
        if (!result.success || !result.data) {
          setError(result.error || "The calculation service is unavailable. Please try again.");
          setIsLoading(false);
          return;
        }
        router.push(`/report?sessionId=${encodeURIComponent(result.data.session_id)}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed. Please try again.");
        setIsLoading(false);
      }
    },
    [input, isListening, router, stopVoice],
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-12">
        <header className="mb-5 text-center sm:mb-7">
          <h1 className="text-2xl font-bold text-gray-950 sm:text-4xl">
            🌍 What did you do today?
          </h1>
          <p className="mt-2 text-sm text-gray-600 sm:text-lg">
            Log activities with text or voice. AI calculates and saves your carbon footprint.
          </p>
        </header>

        <section className="mb-5">
          <p className="mb-2 text-sm font-medium text-gray-500">You can describe activities like:</p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
            {CATEGORIES.map((category) => (
              <div
                key={category.label}
                className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 sm:shrink sm:px-4"
              >
                <span className="mr-1.5">{category.icon}</span>
                <span className="font-medium text-gray-800">{category.label}</span>
                <span className="ml-2 whitespace-nowrap text-xs text-gray-400">
                  {category.hint}
                </span>
              </div>
            ))}
          </div>
        </section>

        <form onSubmit={handleSubmit} className="card p-4 shadow-lg sm:p-8">
          <label htmlFor="activity-input" className="sr-only">
            Activity description
          </label>

          <div className="relative">
            <textarea
              id="activity-input"
              rows={7}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setError(null);
              }}
              disabled={isLoading}
              placeholder="Example: I drove 10 km to work, ate 200g of beef for lunch, and used air conditioning for 5 hours."
              className="input-field min-h-[190px] resize-y pb-16 pr-4 text-base leading-relaxed sm:min-h-[210px]"
            />
            <button
              type="button"
              onClick={toggleVoice}
              disabled={isLoading}
              title={
                speechSupported
                  ? isListening
                    ? "Stop recording and convert to text"
                    : "Start voice input"
                  : "Speech recognition is not supported in this browser"
              }
              className={`absolute bottom-3 right-3 inline-flex h-12 w-12 items-center justify-center rounded-full border text-xl shadow-sm transition sm:h-11 sm:w-11 ${
                isListening
                  ? "border-red-200 bg-red-50 text-red-600"
                  : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
              } disabled:opacity-50`}
            >
              {isListening ? "■" : "🎤"}
            </button>
          </div>

          {voiceStatus && (
            <p className="mt-3 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">
              {voiceStatus}
            </p>
          )}

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => appendText(example)}
                disabled={isLoading}
                className="shrink-0 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-sm text-green-700 transition hover:bg-green-100 disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="btn-primary mt-5 w-full text-base sm:mt-6 sm:text-lg"
          >
            {isLoading ? `Calculating footprint... ${elapsedSeconds}s` : "Calculate footprint"}
          </button>

          {isLoading && (
            <p className="mt-3 text-center text-xs text-gray-400">
              The remote Agent usually needs 20-50 seconds. You will be taken to the report automatically.
            </p>
          )}
        </form>

        {recentEntries.length > 0 && (
          <section className="mt-7 sm:mt-8">
            <h2 className="mb-3 text-sm font-medium text-gray-500">Recent entries</h2>
            <div className="space-y-2">
              {recentEntries.slice(0, 3).map((entry) => (
                <button
                  key={entry.timestamp}
                  type="button"
                  onClick={() => setInput(entry.text)}
                  className="card-hover w-full px-4 py-3 text-left text-sm text-gray-600"
                >
                  <span className="line-clamp-2">{entry.text}</span>
                  <span className="mt-1 block text-xs text-gray-400">
                    {formatShortDate(entry.timestamp)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
