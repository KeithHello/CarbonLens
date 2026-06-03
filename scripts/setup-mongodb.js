/**
 * CarbonLens MongoDB setup.
 *
 * Reads the MongoDB Atlas connection string from agent/.env (MONGODB_MCP_URL),
 * imports seed data, and creates the collections/indexes expected by the ADK
 * agent and MongoDB MCP tools.
 */

const fs = require("fs");
const path = require("path");
const dns = require("dns");
const { MongoClient } = require("mongodb");

const ROOT_DIR = path.resolve(__dirname, "..");
const AGENT_ENV_FILE = path.join(ROOT_DIR, "agent", ".env");
const FACTORS_FILE = path.join(ROOT_DIR, "data", "emission_factors.json");
const BENCHMARKS_FILE = path.join(ROOT_DIR, "data", "global_benchmarks.json");

function parseEnvFile(filePath) {
  const result = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    result[key] = value;
  }
  return result;
}

function assertMongoUri(uri) {
  if (!uri || !/^mongodb(\+srv)?:\/\//.test(uri)) {
    throw new Error(
      "agent/.env MONGODB_MCP_URL must be a mongodb:// or mongodb+srv:// URI for database setup.",
    );
  }
}

async function recreateCollection(db, name, indexes) {
  const existing = await db.listCollections({ name }).toArray();
  if (existing.length === 0) {
    await db.createCollection(name);
  }
  for (const index of indexes) {
    await db.collection(name).createIndex(index.keys, index.options || {});
  }
}

async function main() {
  const env = parseEnvFile(AGENT_ENV_FILE);
  const uri = env.MONGODB_MCP_URL;
  assertMongoUri(uri);

  // Some local DNS resolvers refuse Atlas SRV lookups. Force public resolvers
  // for this setup script so mongodb+srv:// can resolve consistently.
  dns.setServers(["8.8.8.8", "1.1.1.1"]);

  const factors = JSON.parse(fs.readFileSync(FACTORS_FILE, "utf8"));
  const benchmarks = JSON.parse(fs.readFileSync(BENCHMARKS_FILE, "utf8"));

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("carbonlens");

    await db.collection("emission_factors").deleteMany({});
    await db.collection("emission_factors").insertMany(factors);
    await db.collection("emission_factors").createIndex(
      { activity: 1 },
      { unique: true },
    );
    await db.collection("emission_factors").createIndex({ category: 1 });
    await db.collection("emission_factors").createIndex({
      activity: "text",
      category: "text",
    });

    await db.collection("global_benchmarks").deleteMany({});
    await db.collection("global_benchmarks").insertMany(benchmarks);
    await db.collection("global_benchmarks").createIndex(
      { country_code: 1 },
      { unique: true },
    );

    await recreateCollection(db, "user_entries", [
      { keys: { user_id: 1, timestamp: -1 } },
      { keys: { session_id: 1 }, options: { unique: true, sparse: true } },
      { keys: { "breakdown.category": 1 } },
    ]);

    await recreateCollection(db, "user_profiles", [
      { keys: { user_id: 1 }, options: { unique: true } },
      { keys: { updated_at: -1 } },
    ]);

    const stats = {
      emission_factors: await db.collection("emission_factors").countDocuments(),
      global_benchmarks: await db.collection("global_benchmarks").countDocuments(),
      user_entries: await db.collection("user_entries").countDocuments(),
      user_profiles: await db.collection("user_profiles").countDocuments(),
    };

    console.log("MongoDB setup complete:", stats);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("MongoDB setup failed:", error.message);
  process.exit(1);
});
