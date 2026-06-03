/**
 * Agent Engine API client.
 *
 * Proxies requests to Google Cloud Agent Engine. When AGENT_ENGINE_URL is not
 * configured, it returns deterministic local fallback reports for development.
 */

import type {
  AgentEngineResponse,
  CalculateRequest,
  CarbonReport,
  HistoryRequest,
  Suggestion,
} from "./types";
import { GoogleAuth } from "google-auth-library";

const AGENT_ENGINE_URL = process.env.AGENT_ENGINE_URL || "";
const GCP_TOKEN = process.env.GCP_SERVICE_ACCOUNT_TOKEN || "";
const IS_MOCK_MODE = !AGENT_ENGINE_URL;

const FACTORS: Record<string, { factor: number; category: string; label: string; amortize?: boolean }> = {
  gasoline_car_city: { factor: 0.2, category: "Transport", label: "Drove a gasoline car" },
  gasoline_car_highway: { factor: 0.15, category: "Transport", label: "Highway driving" },
  hybrid_car: { factor: 0.1, category: "Transport", label: "Drove a hybrid car" },
  ev_japan: { factor: 0.07, category: "Transport", label: "Drove an electric vehicle" },
  bus: { factor: 0.08, category: "Transport", label: "Took a bus" },
  subway: { factor: 0.03, category: "Transport", label: "Took the subway" },
  shinkansen: { factor: 0.02, category: "Transport", label: "Took the Shinkansen" },
  flight_short_economy: { factor: 0.25, category: "Transport", label: "Short-haul flight" },
  bicycle: { factor: 0, category: "Transport", label: "Biked" },
  walking: { factor: 0, category: "Transport", label: "Walked" },
  beef: { factor: 27, category: "Food", label: "Ate beef" },
  pork: { factor: 12.1, category: "Food", label: "Ate pork" },
  chicken: { factor: 6.9, category: "Food", label: "Ate chicken" },
  salmon_farmed: { factor: 5, category: "Food", label: "Ate salmon" },
  rice: { factor: 4, category: "Food", label: "Ate rice" },
  tofu: { factor: 2, category: "Food", label: "Ate tofu" },
  local_vegetables: { factor: 0.5, category: "Food", label: "Ate local vegetables" },
  coffee: { factor: 0.4, category: "Food", label: "Drank coffee" },
  ac_cooling: { factor: 0.69, category: "Energy", label: "Used air conditioning" },
  ac_heating: { factor: 0.91, category: "Energy", label: "Used heating" },
  washing_machine: { factor: 0.5, category: "Energy", label: "Used a washing machine" },
  dryer: { factor: 2, category: "Energy", label: "Used a dryer" },
  shower_10min: { factor: 1.5, category: "Energy", label: "Took a shower" },
  bath: { factor: 3, category: "Energy", label: "Took a bath" },
  cotton_tshirt_fast: { factor: 7, category: "Consumer Goods", label: "Bought a T-shirt", amortize: true },
  jeans: { factor: 33.4, category: "Consumer Goods", label: "Bought jeans", amortize: true },
  sneakers: { factor: 14, category: "Consumer Goods", label: "Bought sneakers", amortize: true },
  smartphone: { factor: 80, category: "Consumer Goods", label: "Bought a smartphone", amortize: true },
  mixed_landfill: { factor: 0.58, category: "Waste", label: "Disposed mixed waste" },
  plastic_bottle_recycle: { factor: -1.5, category: "Waste", label: "Recycled plastic bottles" },
  video_streaming_hd: { factor: 0.055, category: "Services & Digital Life", label: "Streamed HD video" },
  video_call: { factor: 0.035, category: "Services & Digital Life", label: "Had a video call" },
  online_shopping_delivery: { factor: 0.6, category: "Services & Digital Life", label: "Received online delivery" },
  hotel_stay: { factor: 12, category: "Services & Digital Life", label: "Stayed in a hotel" },
};

interface KeywordRule {
  regex: RegExp;
  activity: keyof typeof FACTORS;
  defaultQuantity: number;
}

const KEYWORD_RULES: KeywordRule[] = [
  { regex: /drive|drove|car|commute/i, activity: "gasoline_car_city", defaultQuantity: 20 },
  { regex: /highway/i, activity: "gasoline_car_highway", defaultQuantity: 50 },
  { regex: /hybrid/i, activity: "hybrid_car", defaultQuantity: 20 },
  { regex: /electric vehicle| ev\b/i, activity: "ev_japan", defaultQuantity: 20 },
  { regex: /bus/i, activity: "bus", defaultQuantity: 10 },
  { regex: /subway|metro|train/i, activity: "subway", defaultQuantity: 15 },
  { regex: /shinkansen|bullet train/i, activity: "shinkansen", defaultQuantity: 300 },
  { regex: /flight|flew|plane/i, activity: "flight_short_economy", defaultQuantity: 800 },
  { regex: /bike|bicycle/i, activity: "bicycle", defaultQuantity: 5 },
  { regex: /walk/i, activity: "walking", defaultQuantity: 2 },
  { regex: /beef|steak/i, activity: "beef", defaultQuantity: 0.2 },
  { regex: /pork/i, activity: "pork", defaultQuantity: 0.2 },
  { regex: /chicken/i, activity: "chicken", defaultQuantity: 0.2 },
  { regex: /salmon|fish/i, activity: "salmon_farmed", defaultQuantity: 0.15 },
  { regex: /rice/i, activity: "rice", defaultQuantity: 0.3 },
  { regex: /tofu/i, activity: "tofu", defaultQuantity: 0.2 },
  { regex: /vegetable/i, activity: "local_vegetables", defaultQuantity: 0.3 },
  { regex: /coffee/i, activity: "coffee", defaultQuantity: 2 },
  { regex: /air conditioning|ac|cooling/i, activity: "ac_cooling", defaultQuantity: 5 },
  { regex: /heating|heater/i, activity: "ac_heating", defaultQuantity: 5 },
  { regex: /laundry|washing machine/i, activity: "washing_machine", defaultQuantity: 1 },
  { regex: /dryer/i, activity: "dryer", defaultQuantity: 1 },
  { regex: /shower/i, activity: "shower_10min", defaultQuantity: 1 },
  { regex: /bath/i, activity: "bath", defaultQuantity: 1 },
  { regex: /t-shirt|shirt/i, activity: "cotton_tshirt_fast", defaultQuantity: 1 },
  { regex: /jeans/i, activity: "jeans", defaultQuantity: 1 },
  { regex: /sneakers|shoes/i, activity: "sneakers", defaultQuantity: 1 },
  { regex: /smartphone|phone/i, activity: "smartphone", defaultQuantity: 1 },
  { regex: /trash|waste|garbage/i, activity: "mixed_landfill", defaultQuantity: 1 },
  { regex: /recycle.*plastic|plastic.*recycle/i, activity: "plastic_bottle_recycle", defaultQuantity: 0.5 },
  { regex: /video|stream/i, activity: "video_streaming_hd", defaultQuantity: 2 },
  { regex: /video call|zoom|meet/i, activity: "video_call", defaultQuantity: 2 },
  { regex: /delivery|online shopping/i, activity: "online_shopping_delivery", defaultQuantity: 1 },
  { regex: /hotel/i, activity: "hotel_stay", defaultQuantity: 1 },
];

const SUGGESTIONS: Record<string, Omit<Suggestion, "rank">> = {
  Food: {
    title: "Shift one high-carbon meal",
    problem: "Meat-heavy meals can dominate a daily footprint.",
    suggestion: "Replace one beef or pork meal with chicken, tofu, or vegetables.",
    reduction_kg: 2.5,
    difficulty: "easy",
    category: "Food",
  },
  Transport: {
    title: "Swap part of the commute",
    problem: "Car travel is often a major source of daily emissions.",
    suggestion: "Use public transit, walking, biking, or carpooling for one trip.",
    reduction_kg: 1.8,
    difficulty: "medium",
    category: "Transport",
  },
  Energy: {
    title: "Tune home energy use",
    problem: "Cooling, heating, hot water, and drying add up quickly.",
    suggestion: "Adjust AC by 1-2°C, shorten hot-water use, or air-dry laundry.",
    reduction_kg: 1.5,
    difficulty: "easy",
    category: "Energy",
  },
  "Consumer Goods": {
    title: "Extend product lifetime",
    problem: "New goods carry manufacturing emissions.",
    suggestion: "Repair, reuse, buy second-hand, or keep devices longer.",
    reduction_kg: 1.2,
    difficulty: "medium",
    category: "Consumer Goods",
  },
  Waste: {
    title: "Improve recycling and food-waste handling",
    problem: "Mixed waste and food waste increase landfill emissions.",
    suggestion: "Separate recyclables and reduce avoidable food waste.",
    reduction_kg: 0.7,
    difficulty: "easy",
    category: "Waste",
  },
  "Services & Digital Life": {
    title: "Optimize digital and service use",
    problem: "Streaming, cloud storage, delivery, and hotel services also emit carbon.",
    suggestion: "Combine deliveries, clean unused cloud storage, and avoid unnecessary HD streaming.",
    reduction_kg: 0.6,
    difficulty: "easy",
    category: "Services & Digital Life",
  },
};

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (GCP_TOKEN) headers.Authorization = `Bearer ${GCP_TOKEN}`;
  return headers;
}

async function getAccessToken(): Promise<string | null> {
  if (GCP_TOKEN) return GCP_TOKEN;
  try {
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token ?? null;
  } catch {
    return null;
  }
}

async function buildAgentEngineHeaders(): Promise<Record<string, string>> {
  const headers = buildHeaders();
  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function buildStreamQueryUrl(): string {
  const base = AGENT_ENGINE_URL.replace(/\/$/, "");
  return base.endsWith(":streamQuery")
    ? `${base}?alt=sse`
    : `${base}:streamQuery?alt=sse`;
}

function extractAgentText(raw: string): string {
  let latest = "";
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const payload = trimmed.startsWith("data:")
      ? trimmed.slice("data:".length).trim()
      : trimmed;
    if (!payload || payload === "[DONE]") continue;
    try {
      const event = JSON.parse(payload);
      const text = event?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("");
      if (text) latest = text;
    } catch {
      latest = payload;
    }
  }
  return latest || raw;
}

function parseCarbonReportFromText(text: string): CarbonReport {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Agent response did not contain a JSON CarbonReport.");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as CarbonReport;
}

function generateSessionId(): string {
  return `sess_${Math.random().toString(36).slice(2, 14)}`;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function generateMockReport(input: string, userId?: string): CarbonReport {
  const records = [];

  for (const rule of KEYWORD_RULES) {
    if (!rule.regex.test(input)) continue;
    const factor = FACTORS[rule.activity];
    const quantity = rule.defaultQuantity;
    const kg = factor.amortize
      ? (factor.factor * quantity) / 365
      : factor.factor * quantity;
    records.push({
      id: `record_${records.length + 1}`,
      label: factor.label,
      category: factor.category,
      kg_co2e: round(kg, 3),
    });
  }

  if (records.length === 0) {
    records.push(
      { id: "record_1", label: "Mixed food activity", category: "Food", kg_co2e: 4.2 },
      { id: "record_2", label: "Mixed transport activity", category: "Transport", kg_co2e: 2.4 },
      { id: "record_3", label: "Mixed energy activity", category: "Energy", kg_co2e: 2.1 },
    );
  }

  const byCategory = new Map<string, number>();
  for (const record of records) {
    byCategory.set(record.category, (byCategory.get(record.category) || 0) + record.kg_co2e);
  }

  const total = round(records.reduce((sum, record) => sum + record.kg_co2e, 0), 3);
  let used = 0;
  const entries = Array.from(byCategory.entries());
  const breakdown = entries.map(([category, kg], index) => {
    const percentage =
      index === entries.length - 1 ? 100 - used : Math.round((Math.max(0, kg) / Math.max(0.01, total)) * 100);
    used += percentage;
    return { category, kg_co2e: round(kg), percentage };
  });

  const topCategories = entries
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category);
  const suggestions = topCategories
    .map((category, index) => ({ ...SUGGESTIONS[category], rank: index + 1 }))
    .filter(Boolean)
    .slice(0, 3) as Suggestion[];

  const globalAvg = 13.5;
  const nationalAvg = 10;
  const personalAvg = 8.5;

  return {
    total_co2e_kg: total,
    breakdown,
    records,
    input,
    comparison: {
      global_percentile: Math.min(98, Math.max(5, Math.round((total / globalAvg) * 55))),
      national_percentile: Math.min(98, Math.max(5, Math.round((total / nationalAvg) * 50))),
      vs_personal_avg: userId ? round(total / personalAvg, 2) : null,
      global_avg_kg: globalAvg,
      national_avg_kg: nationalAvg,
    },
    suggestions,
    trees_needed: round(total / 0.35, 1),
    session_id: generateSessionId(),
    timestamp: new Date().toISOString(),
    tier_label:
      total < 3.5 ? "Low emissions" : total < 6.8 ? "Moderate emissions" : total < 15.2 ? "Elevated emissions" : "High emissions",
    anomaly_flag: total > personalAvg * 1.5 ? "This entry is unusually high versus your recent average." : null,
  };
}

function generateMockHistory(userId: string, days: number): CarbonReport[] {
  const scenarios = [
    "Drove 10 km, ate beef for lunch, and used air conditioning for 5 hours.",
    "Took the subway, ate chicken, streamed video, and did laundry.",
    "Worked from home, used heating, drank coffee, and joined a video call.",
    "Took a short flight, ate dinner out, and received one online delivery.",
    "Biked to buy vegetables, recycled plastic bottles, and took a shower.",
  ];

  return Array.from({ length: Math.min(days, 30) }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    const report = generateMockReport(scenarios[index % scenarios.length], userId);
    report.timestamp = date.toISOString();
    report.session_id = `sess_hist_${index}_${userId}`;
    return report;
  }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function calculateCarbon(
  request: CalculateRequest,
): Promise<AgentEngineResponse> {
  if (IS_MOCK_MODE) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    return { success: true, data: generateMockReport(request.input, request.userId) };
  }

  try {
    const response = await fetch(buildStreamQueryUrl(), {
      method: "POST",
      headers: await buildAgentEngineHeaders(),
      body: JSON.stringify({
        class_method: "async_stream_query",
        input: {
          user_id: request.userId || "default",
          message: request.input,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        error: `Agent Engine returned ${response.status}: ${errorText}`,
      };
    }

    const raw = await response.text();
    return { success: true, data: parseCarbonReportFromText(extractAgentText(raw)) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: `Failed to reach Agent Engine: ${message}`,
    };
  }
}

export async function getHistory(
  request: HistoryRequest,
): Promise<AgentEngineResponse> {
  const days = request.days ?? 30;

  if (IS_MOCK_MODE) {
    return { success: true, data_list: generateMockHistory(request.userId, days) };
  }

  try {
    const response = await fetch(buildStreamQueryUrl(), {
      method: "POST",
      headers: await buildAgentEngineHeaders(),
      body: JSON.stringify({
        class_method: "async_stream_query",
        input: {
          user_id: request.userId,
          message:
            `Return only JSON for this user's last ${days} carbon reports as ` +
            `{"reports":[CarbonReport...]}. Do not include markdown.`,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        error: `Agent Engine returned ${response.status}: ${errorText}`,
      };
    }

    const raw = await response.text();
    const text = extractAgentText(raw);
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1] ?? text;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    const data = start >= 0 && end > start
      ? JSON.parse(candidate.slice(start, end + 1))
      : { reports: [] };
    return { success: true, data_list: data.reports ?? data.data ?? [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: `Failed to reach Agent Engine: ${message}`,
    };
  }
}
