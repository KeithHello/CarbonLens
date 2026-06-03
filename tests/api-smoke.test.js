const assert = require("assert");

const BASE_URL = process.env.CARBONLENS_BASE_URL || "http://localhost:3001";

async function jsonFetch(path, options) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${path} did not return JSON: ${text.slice(0, 120)}`);
  }
  assert(response.ok, `${path} returned HTTP ${response.status}: ${text}`);
  return data;
}

(async () => {
  const input = `API smoke test ${Date.now()}: Drove 10 km to work and ate 200g of beef`;
  const startedAt = Date.now();
  const calculated = await jsonFetch("/api/carbon/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, userId: "default" }),
  });

  assert(calculated.success, "calculate response must succeed");
  assert(calculated.data?.session_id, "calculate response must include session_id");
  assert(calculated.data?.timestamp, "calculate response must include timestamp");
  assert.strictEqual(calculated.meta?.persisted, true, "report must be persisted");

  const sessionId = calculated.data.session_id;
  const history = await jsonFetch("/api/carbon/history?userId=default&days=30");
  assert(history.success, "history response must succeed");
  assert(
    history.data.some((report) => report.session_id === sessionId),
    "history must include the newly persisted report",
  );

  const report = await jsonFetch(
    `/api/carbon/report?userId=default&sessionId=${encodeURIComponent(sessionId)}`,
  );
  assert(report.success, "report response must succeed");
  assert.strictEqual(report.data.session_id, sessionId, "report session_id must match");
  assert.strictEqual(report.data.timestamp, calculated.data.timestamp);

  console.log("api-smoke.test.js OK", {
    elapsed_seconds: Math.round((Date.now() - startedAt) / 100) / 10,
    session_id: sessionId,
    persisted: calculated.meta.persisted,
    history_count: history.data.length,
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
