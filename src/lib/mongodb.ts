import fs from "fs";
import path from "path";
import dns from "dns";
import { MongoClient, type Db } from "mongodb";
import type { ActivityRecord, CarbonReport, EmissionBreakdown } from "./types";

const DB_NAME = "carbonlens";

let clientPromise: Promise<MongoClient> | null = null;

function parseEnvFile(filePath: string): Record<string, string> {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const values: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      values[key] = value;
    }
    return values;
  } catch {
    return {};
  }
}

function getMongoUri(): string {
  const root = process.cwd();
  const agentEnv = parseEnvFile(path.join(root, "agent", ".env"));
  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGODB_MCP_URL ||
    agentEnv.MONGODB_URI ||
    agentEnv.MONGODB_MCP_URL;

  if (!uri || !/^mongodb(\+srv)?:\/\//.test(uri)) {
    throw new Error("MongoDB connection string is not configured.");
  }

  return shouldUseDirectAtlasUri() ? toDirectAtlasUri(uri) : uri;
}

function shouldUseDirectAtlasUri(): boolean {
  return process.env.MONGODB_USE_DIRECT_ATLAS_URI === "true";
}

function toDirectAtlasUri(uri: string): string {
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

async function getClient(): Promise<MongoClient> {
  if (!clientPromise) {
    const dnsServers = process.env.MONGODB_DNS_SERVERS;
    if (dnsServers) {
      dns.setServers(dnsServers.split(",").map((server) => server.trim()));
    }
    clientPromise = new MongoClient(getMongoUri()).connect();
  }
  return clientPromise;
}

export async function getCarbonlensDb(): Promise<Db> {
  const client = await getClient();
  return client.db(DB_NAME);
}

export async function saveCarbonReport(
  report: CarbonReport,
  userId: string,
  input: string,
): Promise<CarbonReport> {
  const db = await getCarbonlensDb();
  const now = new Date().toISOString();
  const safeSessionId = /^[A-Za-z0-9_-]{6,80}$/.test(report.session_id)
    ? report.session_id
    : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const normalized: CarbonReport = {
    ...report,
    timestamp: now,
    session_id: safeSessionId,
    input,
    records: normalizeActivityRecords(report, input),
  };

  await db.collection("user_entries").updateOne(
    { session_id: normalized.session_id },
    {
      $set: {
        ...normalized,
        user_id: userId,
        input,
        updated_at: now,
      },
      $setOnInsert: {
        created_at: now,
      },
    },
    { upsert: true },
  );

  return normalized;
}

function normalizeActivityRecords(
  report: CarbonReport,
  input: string,
): ActivityRecord[] {
  if (Array.isArray(report.records) && report.records.length > 0) {
    return report.records.map((record, index) => ({
      id: record.id || `record_${index + 1}`,
      label: record.label || record.category || `Record ${index + 1}`,
      category: record.category || "Mixed",
      kg_co2e: Number(record.kg_co2e) || 0,
    }));
  }

  if (report.breakdown.length === 1) {
    return [
      {
        id: "record_1",
        label: input,
        category: report.breakdown[0].category,
        kg_co2e: report.total_co2e_kg,
      },
    ];
  }

  return report.breakdown.map((item, index) => ({
    id: `record_${index + 1}`,
    label: `${item.category} activity`,
    category: item.category,
    kg_co2e: item.kg_co2e,
  }));
}

function buildBreakdownFromRecords(records: ActivityRecord[]): EmissionBreakdown[] {
  const byCategory = new Map<string, number>();
  for (const record of records) {
    byCategory.set(record.category, (byCategory.get(record.category) || 0) + record.kg_co2e);
  }

  const total = Array.from(byCategory.values()).reduce((sum, value) => sum + value, 0);
  let used = 0;
  const entries = Array.from(byCategory.entries());
  return entries.map(([category, kg], index) => {
    const kg_co2e = Math.round(kg * 1000) / 1000;
    const percentage =
      total <= 0
        ? index === 0
          ? 100
          : 0
        : index === entries.length - 1
          ? 100 - used
          : Math.round((kg / total) * 100);
    used += percentage;
    return { category, kg_co2e, percentage };
  });
}

export async function getCarbonReportBySession(
  sessionId: string,
  userId = "default",
): Promise<CarbonReport | null> {
  const db = await getCarbonlensDb();
  const doc = await db.collection("user_entries").findOne(
    { session_id: sessionId, user_id: userId },
    { projection: { _id: 0 } },
  );
  return doc as unknown as CarbonReport | null;
}

export async function deleteCarbonReportBySession(
  sessionId: string,
  userId = "default",
): Promise<boolean> {
  const db = await getCarbonlensDb();
  const result = await db.collection("user_entries").deleteOne({
    session_id: sessionId,
    user_id: userId,
  });
  return result.deletedCount > 0;
}

export async function deleteActivityRecordById(
  sessionId: string,
  recordId: string,
  userId = "default",
): Promise<{ deleted: boolean; reportDeleted: boolean; report?: CarbonReport }> {
  const db = await getCarbonlensDb();
  const collection = db.collection("user_entries");
  const doc = await collection.findOne(
    { session_id: sessionId, user_id: userId },
    { projection: { _id: 0 } },
  );

  if (!doc) {
    return { deleted: false, reportDeleted: false };
  }

  const report = doc as unknown as CarbonReport;
  const records = normalizeActivityRecords(report, report.input || "").filter(
    (record) => record.id !== recordId,
  );

  if (records.length === normalizeActivityRecords(report, report.input || "").length) {
    return { deleted: false, reportDeleted: false };
  }

  if (records.length === 0) {
    await collection.deleteOne({ session_id: sessionId, user_id: userId });
    return { deleted: true, reportDeleted: true };
  }

  const total = Math.round(records.reduce((sum, record) => sum + record.kg_co2e, 0) * 1000) / 1000;
  const updatedReport: CarbonReport = {
    ...report,
    records,
    total_co2e_kg: total,
    breakdown: buildBreakdownFromRecords(records),
    trees_needed: Math.round((total / 0.35) * 10) / 10,
    updated_at: new Date().toISOString(),
  } as CarbonReport & { updated_at: string };

  await collection.updateOne(
    { session_id: sessionId, user_id: userId },
    {
      $set: {
        records: updatedReport.records,
        total_co2e_kg: updatedReport.total_co2e_kg,
        breakdown: updatedReport.breakdown,
        trees_needed: updatedReport.trees_needed,
        updated_at: new Date().toISOString(),
      },
    },
  );

  return { deleted: true, reportDeleted: false, report: updatedReport };
}

export async function listCarbonReports(
  userId: string,
  days: number,
): Promise<CarbonReport[]> {
  const db = await getCarbonlensDb();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const docs = await db
    .collection("user_entries")
    .find(
      {
        user_id: userId,
        timestamp: { $gte: since.toISOString() },
      },
      { projection: { _id: 0 } },
    )
    .sort({ timestamp: -1 })
    .limit(Math.min(days * 20, 1000))
    .toArray();

  return docs as unknown as CarbonReport[];
}
