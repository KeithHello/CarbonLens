/**
 * Reset CarbonLens MongoDB data.
 *
 * Default mode restores a demo-ready initial state:
 * - emission factors
 * - global benchmarks
 * - one demo profile for user_id=default
 * - 200 deterministic demo carbon reports
 *
 * Use --empty to keep only base factor/benchmark data and clear user data.
 */

const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const ROOT_DIR = path.resolve(__dirname, "..");
const AGENT_ENV_FILE = path.join(ROOT_DIR, "agent", ".env");
const FACTORS_FILE = path.join(ROOT_DIR, "data", "emission_factors.json");
const BENCHMARKS_FILE = path.join(ROOT_DIR, "data", "global_benchmarks.json");
const DB_NAME = "carbonlens";
const DEMO_USER_ID = "default";
const DEMO_ENTRY_COUNT = 200;
const SPECIAL_YEAR = 2026;

const CAT = {
  transport: "Transport",
  food: "Food",
  energy: "Energy",
  goods: "Consumer Goods",
  waste: "Waste",
  digital: "Services & Digital Life",
};

function parseEnvFile(filePath) {
  const result = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    result[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return result;
}

function toDirectAtlasUri(uri) {
  if (!uri.startsWith("mongodb+srv://")) return uri;

  const parsed = new URL(uri);
  if (parsed.hostname !== "google-cloud-rapid-agen.zh3ug6z.mongodb.net") {
    return uri;
  }

  const hosts = [
    "ac-sgkwaam-shard-00-00.zh3ug6z.mongodb.net:27017",
    "ac-sgkwaam-shard-00-01.zh3ug6z.mongodb.net:27017",
    "ac-sgkwaam-shard-00-02.zh3ug6z.mongodb.net:27017",
  ].join(",");
  const params = new URLSearchParams(parsed.search);
  params.set("tls", "true");
  params.set("authSource", params.get("authSource") || "admin");
  params.set("retryWrites", params.get("retryWrites") || "true");
  params.set("w", params.get("w") || "majority");

  const auth = parsed.username
    ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
    : "";
  return `mongodb://${auth}${hosts}/${parsed.pathname.replace(/^\//, "")}?${params.toString()}`;
}

function getMongoUri() {
  const env = parseEnvFile(AGENT_ENV_FILE);
  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGODB_MCP_URL ||
    env.MONGODB_URI ||
    env.MONGODB_MCP_URL;
  if (!uri || !/^mongodb(\+srv)?:\/\//.test(uri)) {
    throw new Error("MongoDB URI is missing.");
  }
  return toDirectAtlasUri(uri);
}

async function ensureIndexes(db) {
  await db.collection("emission_factors").createIndex({ activity: 1 }, { unique: true });
  await db.collection("emission_factors").createIndex({ category: 1 });
  await db.collection("emission_factors").createIndex({ activity: "text", category: "text" });
  await db.collection("global_benchmarks").createIndex({ country_code: 1 }, { unique: true });
  await db.collection("user_entries").createIndex({ user_id: 1, timestamp: -1 });
  await db.collection("user_entries").createIndex({ session_id: 1 }, { unique: true, sparse: true });
  await db.collection("user_entries").createIndex({ "breakdown.category": 1 });
  await db.collection("user_profiles").createIndex({ user_id: 1 }, { unique: true });
  await db.collection("user_profiles").createIndex({ updated_at: -1 });
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function makeBreakdown(items) {
  const byCategory = new Map();
  for (const item of items) {
    byCategory.set(item.category, (byCategory.get(item.category) || 0) + item.kg_co2e);
  }
  const entries = Array.from(byCategory.entries());
  const total = Math.max(0.01, entries.reduce((sum, [, kg]) => sum + Math.max(0, kg), 0));
  let used = 0;
  return entries.map(([category, kg], index) => {
    const percentage =
      index === entries.length - 1
        ? 100 - used
        : Math.round((Math.max(0, kg) / total) * 100);
    used += percentage;
    return { category, kg_co2e: round(kg), percentage };
  });
}

function tierLabel(total) {
  if (total < 3.5) return "Low emissions";
  if (total < 6.8) return "Moderate emissions";
  if (total < 15.2) return "Elevated emissions";
  if (total < 42) return "High emissions";
  return "Extreme emissions";
}

function suggestionForCategory(category) {
  const templates = {
    [CAT.transport]: {
      title: "Swap part of the commute",
      problem: "Transport is one of the main emission sources in this entry.",
      suggestion: "For short trips, choose subway, bus, walking, or biking first.",
    },
    [CAT.food]: {
      title: "Reduce high-carbon foods",
      problem: "Beef, cheese, and other animal products have high unit emissions.",
      suggestion: "Try one or two meals per week with plant protein or chicken instead.",
    },
    [CAT.energy]: {
      title: "Optimize AC and hot-water use",
      problem: "Cooling, heating, hot water, and drying can quickly add up at home.",
      suggestion: "Adjust AC by 1-2 degrees and shorten hot-water use by a few minutes.",
    },
    [CAT.goods]: {
      title: "Extend product lifetimes",
      problem: "New clothes and electronics include manufacturing emissions.",
      suggestion: "Repair, reuse, buy second-hand, or choose durable products when possible.",
    },
    [CAT.waste]: {
      title: "Improve recycling and food-waste handling",
      problem: "Food waste and mixed landfill waste increase waste-sector emissions.",
      suggestion: "Separate recyclables and reduce avoidable food waste.",
    },
    [CAT.digital]: {
      title: "Optimize digital and service use",
      problem: "Streaming, cloud storage, delivery, and hotel services also have footprints.",
      suggestion: "Combine deliveries, clean unused cloud storage, and avoid unnecessary HD streaming.",
    },
  };
  return templates[category] || templates[CAT.energy];
}

function makeSuggestions(items) {
  return [...items]
    .filter((item) => item.kg_co2e > 0)
    .sort((a, b) => b.kg_co2e - a.kg_co2e)
    .slice(0, 3)
    .map((item, index) => {
      const template = suggestionForCategory(item.category);
      return {
        rank: index + 1,
        title: template.title,
        problem: template.problem,
        suggestion: template.suggestion,
        reduction_kg: round(Math.max(0.3, item.kg_co2e * 0.35)),
        difficulty: index === 0 ? "medium" : "easy",
        category: item.category,
      };
    });
}

const NORMAL_SCENARIOS = [
  {
    input: "Drove 10 km to work, ate 200g of beef for lunch, used air conditioning for 5 hours, and streamed HD video for 2 hours.",
    items: [
      { label: "Drove 10 km to work", category: CAT.transport, kg_co2e: 2.0 },
      { label: "Ate 200g of beef for lunch", category: CAT.food, kg_co2e: 5.4 },
      { label: "Used air conditioning for 5 hours", category: CAT.energy, kg_co2e: 3.45 },
      { label: "Streamed HD video for 2 hours", category: CAT.digital, kg_co2e: 0.11 },
    ],
  },
  {
    input: "Took the subway round trip, ate a chicken bento, used a laptop for 8 hours, and recycled plastic bottles.",
    items: [
      { label: "Took the subway round trip", category: CAT.transport, kg_co2e: 0.9 },
      { label: "Ate a chicken bento", category: CAT.food, kg_co2e: 1.4 },
      { label: "Used a laptop for 8 hours", category: CAT.energy, kg_co2e: 0.16 },
      { label: "Recycled plastic bottles", category: CAT.waste, kg_co2e: -0.4 },
    ],
  },
  {
    input: "Worked from home, used heating for 4 hours, did one load of laundry, and had a 2-hour video call.",
    items: [
      { label: "Used heating for 4 hours", category: CAT.energy, kg_co2e: 4.14 },
      { label: "Typical home meals", category: CAT.food, kg_co2e: 1.2 },
      { label: "Had a 2-hour video call", category: CAT.digital, kg_co2e: 0.07 },
    ],
  },
  {
    input: "Drove 25 km, ate a pork dish, took a bath, and produced 1 kg of mixed waste.",
    items: [
      { label: "Drove 25 km", category: CAT.transport, kg_co2e: 5.0 },
      { label: "Ate a pork dish", category: CAT.food, kg_co2e: 2.4 },
      { label: "Took a bath", category: CAT.energy, kg_co2e: 3.0 },
      { label: "Produced 1 kg of mixed waste", category: CAT.waste, kg_co2e: 0.58 },
    ],
  },
  {
    input: "Took the Shinkansen to Osaka, ate sushi and coffee for dinner, and bought one T-shirt.",
    items: [
      { label: "Took the Shinkansen to Osaka", category: CAT.transport, kg_co2e: 6.0 },
      { label: "Ate sushi and drank coffee", category: CAT.food, kg_co2e: 1.2 },
      { label: "Bought one T-shirt", category: CAT.goods, kg_co2e: 0.02 },
    ],
  },
  {
    input: "Flew from Tokyo to Osaka, ordered takeout dinner, used air conditioning for 3 hours, and received one online delivery.",
    items: [
      { label: "Flew from Tokyo to Osaka", category: CAT.transport, kg_co2e: 100 },
      { label: "Ordered takeout dinner", category: CAT.food, kg_co2e: 1.5 },
      { label: "Used air conditioning for 3 hours", category: CAT.energy, kg_co2e: 2.07 },
      { label: "Received one online delivery", category: CAT.digital, kg_co2e: 0.6 },
    ],
  },
  {
    input: "Bought new sneakers, used about 100 GB of cloud storage, ate local vegetables, and took the bus.",
    items: [
      { label: "Bought new sneakers", category: CAT.goods, kg_co2e: 0.04 },
      { label: "Used about 100 GB of cloud storage", category: CAT.digital, kg_co2e: 0.2 },
      { label: "Ate local vegetables", category: CAT.food, kg_co2e: 0.7 },
      { label: "Took the bus", category: CAT.transport, kg_co2e: 0.96 },
    ],
  },
  {
    input: "Stayed in a hotel for one night, ate at a restaurant, and took a taxi for 8 km.",
    items: [
      { label: "Stayed in a hotel for one night", category: CAT.digital, kg_co2e: 12.0 },
      { label: "Restaurant service overhead", category: CAT.digital, kg_co2e: 0.8 },
      { label: "Took a taxi for 8 km", category: CAT.transport, kg_co2e: 1.6 },
      { label: "Dinner food", category: CAT.food, kg_co2e: 2.2 },
    ],
  },
];

function createMayScenario(day) {
  const target = round(8 + ((day * 37) % 41) / 10, 1);
  const combos = [
    [CAT.transport, CAT.food, CAT.energy],
    [CAT.transport, CAT.food, CAT.digital],
    [CAT.energy, CAT.food, CAT.goods],
    [CAT.transport, CAT.energy, CAT.waste],
    [CAT.food, CAT.digital, CAT.waste],
    [CAT.transport, CAT.goods, CAT.digital],
  ];
  const cats = combos[day % combos.length];
  const first = round(target * 0.34, 2);
  const second = round(target * 0.39, 2);
  const third = round(target - first - second, 2);
  return {
    input: `May ${day}: A balanced mix of commuting, food, energy, goods, waste, or digital-service activities.`,
    items: [
      { label: `May ${day} ${cats[0]} activity`, category: cats[0], kg_co2e: first },
      { label: `May ${day} ${cats[1]} activity`, category: cats[1], kg_co2e: second },
      { label: `May ${day} ${cats[2]} activity`, category: cats[2], kg_co2e: third },
    ],
  };
}

function buildEntry(date, index, scenario, sessionPrefix) {
  const records = scenario.items.map((item, itemIndex) => ({
    id: `record_${itemIndex + 1}`,
    label: item.label || `${scenario.input}: ${item.category}`,
    category: item.category,
    kg_co2e: item.kg_co2e,
  }));
  const total = round(records.reduce((sum, item) => sum + item.kg_co2e, 0), 3);
  const previousThirtyDayAverage = 8.7 + ((index * 13) % 35) / 10;
  return {
    user_id: DEMO_USER_ID,
    session_id: `${sessionPrefix}_${date.toISOString().slice(0, 10).replace(/-/g, "")}_${String(index + 1).padStart(3, "0")}`,
    input: scenario.input,
    records,
    total_co2e_kg: total,
    breakdown: makeBreakdown(records),
    comparison: {
      global_percentile: Math.min(98, Math.max(5, Math.round((total / 13.5) * 55))),
      national_percentile: Math.min(98, Math.max(5, Math.round((total / 10) * 50))),
      vs_personal_avg: round(total / previousThirtyDayAverage, 2),
      global_avg_kg: 13.5,
      national_avg_kg: 10,
    },
    suggestions: makeSuggestions(records),
    trees_needed: round(total / 0.35, 1),
    timestamp: date.toISOString(),
    tier_label: tierLabel(total),
    anomaly_flag: total > 42 ? "This entry is unusually high versus your recent average." : null,
    demo: true,
    created_at: date.toISOString(),
    updated_at: date.toISOString(),
  };
}

function createDemoEntries(now = new Date()) {
  const entries = [];

  for (let day = 1; day <= 27; day += 1) {
    const date = new Date(Date.UTC(SPECIAL_YEAR, 4, day, 9 + (day % 8), 15, 0, 0));
    entries.push(buildEntry(date, entries.length, createMayScenario(day), "maydemo"));
  }

  let offset = 0;
  while (entries.length < DEMO_ENTRY_COUNT) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    date.setHours(8 + (offset % 10), 15, 0, 0);
    const isMaySpecial =
      date.getUTCFullYear() === SPECIAL_YEAR &&
      date.getUTCMonth() === 4 &&
      date.getUTCDate() >= 1 &&
      date.getUTCDate() <= 27;
    if (!isMaySpecial) {
      const base = NORMAL_SCENARIOS[offset % NORMAL_SCENARIOS.length];
      const scenario = JSON.parse(JSON.stringify(base));
      const variation = 0.78 + ((offset * 17) % 45) / 100;
      scenario.items = scenario.items.map((item) => ({
        ...item,
        kg_co2e: round(item.kg_co2e * variation, 3),
      }));
      entries.push(buildEntry(date, entries.length, scenario, "demo"));
    }
    offset += 1;
    if (offset > 400) break;
  }

  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

async function main() {
  const empty = process.argv.includes("--empty");
  const factors = JSON.parse(fs.readFileSync(FACTORS_FILE, "utf8"));
  const benchmarks = JSON.parse(fs.readFileSync(BENCHMARKS_FILE, "utf8"));
  const client = new MongoClient(getMongoUri(), { serverSelectionTimeoutMS: 15000 });

  await client.connect();
  try {
    const db = client.db(DB_NAME);

    await db.collection("emission_factors").deleteMany({});
    await db.collection("emission_factors").insertMany(factors);
    await db.collection("global_benchmarks").deleteMany({});
    await db.collection("global_benchmarks").insertMany(benchmarks);
    await db.collection("user_entries").deleteMany({});
    await db.collection("user_profiles").deleteMany({});
    await ensureIndexes(db);

    if (!empty) {
      const now = new Date();
      await db.collection("user_profiles").insertOne({
        user_id: DEMO_USER_ID,
        display_name: "Demo User",
        country: "Japan",
        preferences: {
          language: "en",
          voice_enabled: true,
          interested_categories: Object.values(CAT),
          rejected_categories: [],
        },
        demo: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });
      await db.collection("user_entries").insertMany(createDemoEntries(now));
    }

    const stats = {
      emission_factors: await db.collection("emission_factors").countDocuments(),
      global_benchmarks: await db.collection("global_benchmarks").countDocuments(),
      user_entries: await db.collection("user_entries").countDocuments(),
      user_profiles: await db.collection("user_profiles").countDocuments(),
      may_1_to_27: await db.collection("user_entries").countDocuments({
        timestamp: {
          $gte: `${SPECIAL_YEAR}-05-01T00:00:00.000Z`,
          $lte: `${SPECIAL_YEAR}-05-27T23:59:59.999Z`,
        },
      }),
      mode: empty ? "empty" : "demo",
    };
    console.log("MongoDB reset complete:", stats);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("MongoDB reset failed:", error.message);
  process.exit(1);
});
