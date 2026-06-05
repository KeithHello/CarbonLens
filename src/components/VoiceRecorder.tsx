"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionError extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionError) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type MicrophonePermissionStatus = {
  ok: boolean;
  message?: string;
};

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

async function requestMicrophoneAccess(): Promise<MicrophonePermissionStatus> {
  if (typeof navigator === "undefined") return { ok: true };

  const permissionNavigator = navigator as Navigator & {
    permissions?: {
      query: (descriptor: { name: string }) => Promise<{ state: PermissionState }>;
    };
  };

  try {
    const permission = await permissionNavigator.permissions?.query({
      name: "microphone",
    });
    if (permission?.state === "denied") {
      return {
        ok: false,
        message:
          "Microphone access is blocked. Please enable microphone permission from the browser address bar or site settings, then try again.",
      };
    }
  } catch {
    // Browser may not support microphone permission queries.
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      message:
        "Microphone access is unavailable in this browser or connection. Please use Chrome or Edge over HTTPS, or use text input.",
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return {
        ok: false,
        message:
          "Microphone permission was denied. Please allow microphone access in your browser or system privacy settings, then tap the microphone again.",
      };
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return {
        ok: false,
        message:
          "No microphone was found. Please connect or enable a microphone, then try again.",
      };
    }
    return {
      ok: false,
      message:
        "Could not check the microphone. Please confirm microphone permission and try again.",
    };
  }
}

const ACTIVITY_TAGS: { regex: RegExp; emoji: string; label: string }[] = [
  { regex: /drive|car|taxi|gasoline|commute/i, emoji: "🚗", label: "Transport" },
  { regex: /subway|train|bus|public transit/i, emoji: "🚇", label: "Public transit" },
  { regex: /flight|fly|plane|airport/i, emoji: "✈️", label: "Flight" },
  { regex: /beef|pork|chicken|fish|meal|lunch|dinner|coffee/i, emoji: "🥩", label: "Food" },
  { regex: /air conditioning|heater|heating|laundry|bath|shower|electricity/i, emoji: "⚡", label: "Energy" },
  { regex: /shirt|clothes|phone|laptop|shoes|buy|purchase/i, emoji: "🛍️", label: "Consumer goods" },
  { regex: /trash|waste|recycle|compost/i, emoji: "🗑️", label: "Waste" },
  { regex: /video|stream|cloud|online|delivery|hotel|restaurant/i, emoji: "💻", label: "Services & digital life" },
];

interface VoiceRecorderProps {
  onTranscript: (text: string, tags: { emoji: string; label: string }[]) => void;
  onNavigateToInput: () => void;
}

export default function VoiceRecorder({
  onTranscript,
  onNavigateToInput,
}: VoiceRecorderProps) {
  const [isSupported, setIsSupported] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [tags, setTags] = useState<{ emoji: string; label: string }[]>([]);
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullTranscriptRef = useRef("");

  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(Boolean(SpeechRec));
  }, []);

  const detectActivities = useCallback((text: string) => {
    const found: { emoji: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const tag of ACTIVITY_TAGS) {
      if (tag.regex.test(text) && !seen.has(tag.label)) {
        found.push({ emoji: tag.emoji, label: tag.label });
        seen.add(tag.label);
      }
    }
    return found;
  }, []);

  const publishTranscript = useCallback(
    (text: string) => {
      const detected = detectActivities(text);
      setTags(detected);
      onTranscript(text, detected);
    },
    [detectActivities, onTranscript],
  );

  const resetSilenceTimer = useCallback(() => {
    if (silenceRef.current) clearTimeout(silenceRef.current);
    silenceRef.current = setTimeout(() => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }, 10000);
  }, []);

  const startRecording = useCallback(async () => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setIsSupported(false);
      return;
    }

    setError(null);
    setTranscript("");
    setInterimTranscript("");
    setTags([]);
    setTimer(0);
    fullTranscriptRef.current = "";
    setPermissionDenied(false);
    setIsProcessing(true);
    setStatusMessage("Checking microphone permission...");

    const microphone = await requestMicrophoneAccess();
    if (!microphone.ok) {
      setPermissionDenied(true);
      setError(microphone.message || "Please enable microphone permission and try again.");
      setStatusMessage("Microphone permission is required to record voice.");
      setIsProcessing(false);
      setIsRecording(false);
      return;
    }

    setStatusMessage("Microphone is ready. Starting recording...");
    setIsRecording(true);

    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsRecording(true);
      setIsProcessing(false);
      setStatusMessage(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = "";
      let interim = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalText) {
        fullTranscriptRef.current = `${fullTranscriptRef.current} ${finalText}`.trim();
        setTranscript(fullTranscriptRef.current);
        publishTranscript(fullTranscriptRef.current);
        resetSilenceTimer();
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionError) => {
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        setPermissionDenied(true);
        setError(
          "Microphone access is blocked. Please allow microphone permission in your browser or system settings, then try again.",
        );
        setStatusMessage("Microphone permission is required to record voice.");
        setIsRecording(false);
        setIsProcessing(false);
        return;
      }
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }
      setError(`Speech recognition error: ${event.message || event.error}`);
    };

    recognition.onend = () => {
      setIsRecording(false);
      setIsProcessing(false);
      setStatusMessage(null);
      setInterimTranscript("");
      if (timerRef.current) clearInterval(timerRef.current);
      if (fullTranscriptRef.current) {
        publishTranscript(fullTranscriptRef.current);
      }
    };

    try {
      recognition.start();
      timerRef.current = setInterval(() => {
        setTimer((value) => value + 1);
      }, 1000);
      resetSilenceTimer();
    } catch {
      setError("Speech recognition could not start.");
      setStatusMessage(null);
      setIsRecording(false);
      setIsProcessing(false);
    }
  }, [publishTranscript, resetSilenceTimer]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      setIsProcessing(true);
      recognitionRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (silenceRef.current) clearTimeout(silenceRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (timerRef.current) clearInterval(timerRef.current);
      if (silenceRef.current) clearTimeout(silenceRef.current);
    };
  }, []);

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  if (!isSupported) {
    return (
      <div className="text-center">
        <div className="mb-4 text-5xl">🎙️</div>
        <h2 className="text-lg font-semibold text-gray-900">
          Speech recognition is not supported
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Please use Chrome or Edge, or switch to text input.
        </p>
        <button onClick={onNavigateToInput} className="btn-primary mt-6 inline-block">
          Use text input
        </button>
      </div>
    );
  }

  if (permissionDenied) {
    return (
      <div className="text-center">
        <div className="mb-4 text-5xl">🎤</div>
        <h2 className="text-lg font-semibold text-gray-900">Microphone access is blocked</h2>
        <p className="mt-2 text-sm text-gray-600">
          {error ||
            "Allow microphone permission from the browser address bar or site settings, then try again."}
        </p>
        <button onClick={onNavigateToInput} className="btn-primary mt-6 inline-block">
          Use text input
        </button>
        <button
          onClick={() => {
            setPermissionDenied(false);
            startRecording();
          }}
          className="btn-outline mt-3 block w-full"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        className={`relative flex h-[120px] w-[120px] items-center justify-center rounded-full text-white shadow-lg transition-all duration-300 ${
          isRecording
            ? "animate-pulse-ring bg-red-500 hover:bg-red-600"
            : "bg-primary hover:scale-105 hover:bg-primary-700"
        } ${isProcessing ? "animate-spin bg-gray-400" : ""}`}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
      >
        {isProcessing ? (
          <span className="text-2xl">...</span>
        ) : isRecording ? (
          <span className="text-3xl">■</span>
        ) : (
          <span className="text-4xl">🎤</span>
        )}
      </button>

      <div className="mt-4 text-center">
        {isProcessing ? (
          <p className="text-sm font-medium text-gray-500">Processing speech...</p>
        ) : isRecording ? (
          <p className="flex items-center gap-2 text-sm font-medium text-red-500">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Recording {formatTimer(timer)}
          </p>
        ) : (
          <p className="text-sm text-gray-500">Tap to start recording</p>
        )}
        {statusMessage && (
          <p className="mt-2 text-xs font-medium text-primary">{statusMessage}</p>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {(transcript || interimTranscript) && (
        <div className="mt-6 w-full">
          <div className="card p-4">
            <p className="text-sm text-gray-700">
              {transcript}
              {interimTranscript && (
                <span className="italic text-gray-400"> {interimTranscript}</span>
              )}
            </p>
          </div>

          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag.label}
                  className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-sm text-green-700"
                >
                  {tag.emoji} {tag.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { ACTIVITY_TAGS };
