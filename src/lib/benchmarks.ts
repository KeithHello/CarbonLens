import benchmarks from "../../data/global_benchmarks.json";

export interface BenchmarkReference {
  country: string;
  country_code: string;
  daily_kg_co2e: number;
  annual_tonnes_co2e: number;
  source: string;
  source_url: string;
  metric: string;
  year: number;
}

export interface StoredUserSettings {
  country?: string;
}

export const BENCHMARK_REFERENCES = benchmarks as BenchmarkReference[];

export const GLOBAL_REFERENCE =
  BENCHMARK_REFERENCES.find((benchmark) => benchmark.country_code === "GLOBAL") ??
  BENCHMARK_REFERENCES[0];

const DEFAULT_COUNTRY_CODE = "JP";

export function getCountryReference(countryCode?: string): BenchmarkReference {
  return (
    BENCHMARK_REFERENCES.find(
      (benchmark) => benchmark.country_code === (countryCode || DEFAULT_COUNTRY_CODE),
    ) ??
    BENCHMARK_REFERENCES.find((benchmark) => benchmark.country_code === DEFAULT_COUNTRY_CODE) ??
    GLOBAL_REFERENCE
  );
}

export function loadStoredCountryCode(): string {
  if (typeof window === "undefined") return DEFAULT_COUNTRY_CODE;
  try {
    const raw = window.localStorage.getItem("carbonlens_settings");
    const settings = raw ? (JSON.parse(raw) as StoredUserSettings) : {};
    return settings.country || DEFAULT_COUNTRY_CODE;
  } catch {
    return DEFAULT_COUNTRY_CODE;
  }
}

export function formatBenchmarkReference(reference: BenchmarkReference): string {
  return `${reference.source}, ${reference.year}. ${reference.metric}; ${reference.annual_tonnes_co2e.toFixed(2)} t CO2e/person/year converted to ${reference.daily_kg_co2e.toFixed(1)} kg CO2e/day.`;
}
