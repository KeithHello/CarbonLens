const fs = require("fs");
const dns = require("dns");
const assert = require("assert");
const { GoogleAuth } = require("google-auth-library");

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

async function getAccessToken() {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  assert(token.token, "Google ADC did not return an access token.");
  return token.token;
}

function extractSseEvents(raw) {
  const events = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "[DONE]") continue;
    const payload = trimmed.startsWith("data:")
      ? trimmed.slice("data:".length).trim()
      : trimmed;
    if (!payload || payload === "[DONE]") continue;
    try {
      events.push(JSON.parse(payload));
    } catch {
      // Ignore non-JSON event framing.
    }
  }
  return events;
}

function textFromEvent(event) {
  return (event?.content?.parts || [])
    .map((part) => part.text || "")
    .join("");
}

function parseJsonFromText(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  assert(start >= 0 && end > start, "Text does not contain a JSON object.");
  return JSON.parse(candidate.slice(start, end + 1));
}

function assertCarbonReport(report) {
  const required = [
    "total_co2e_kg",
    "breakdown",
    "comparison",
    "suggestions",
    "trees_needed",
    "session_id",
    "timestamp",
    "tier_label",
    "anomaly_flag",
  ];
  for (const key of required) {
    assert(Object.prototype.hasOwnProperty.call(report, key), `Missing ${key}`);
  }
  assert.strictEqual(typeof report.total_co2e_kg, "number");
  assert(Array.isArray(report.breakdown), "breakdown must be an array");
  assert(Array.isArray(report.suggestions), "suggestions must be an array");
  assert.strictEqual(typeof report.comparison, "object");
  for (const key of [
    "global_percentile",
    "national_percentile",
    "global_avg_kg",
    "national_avg_kg",
  ]) {
    assert.strictEqual(typeof report.comparison[key], "number", `comparison.${key}`);
  }
}

function forcePublicDns() {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

module.exports = {
  assertCarbonReport,
  extractSseEvents,
  forcePublicDns,
  getAccessToken,
  parseEnvFile,
  parseJsonFromText,
  textFromEvent,
};
