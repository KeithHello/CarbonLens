const assert = require("assert");
const {
  assertCarbonReport,
  extractSseEvents,
  getAccessToken,
  parseEnvFile,
  parseJsonFromText,
  textFromEvent,
} = require("./helpers");

async function runOnce() {
  const env = parseEnvFile(".env.local");
  const baseUrl = env.AGENT_ENGINE_URL;
  assert(baseUrl, "AGENT_ENGINE_URL must be set in .env.local");

  const token = await getAccessToken();
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}:streamQuery?alt=sse`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      class_method: "async_stream_query",
      input: {
        user_id: `test_user_${Date.now()}`,
        message:
          "Today I drove a gasoline car for 20 km, ate 200 g of beef, and used air conditioning for 5 hours. Return raw valid CarbonReport JSON only. No markdown.",
      },
    }),
  });

  assert(response.ok, `Agent Platform returned HTTP ${response.status}`);
  const raw = await response.text();
  const events = extractSseEvents(raw);
  assert(events.length > 0, "Agent Platform returned no SSE events.");

  const authors = events.map((event) => event.author).filter(Boolean);
  assert(authors.includes("activity_parser"), "activity_parser did not run");
  assert(authors.includes("factor_matcher"), "factor_matcher did not run");
  assert(authors.includes("benchmark_advisor"), "benchmark_advisor did not run");

  const lastText = textFromEvent(events[events.length - 1]);
  const report = parseJsonFromText(lastText);
  assertCarbonReport(report);
  assert(report.total_co2e_kg > 0, "total_co2e_kg must be positive");

  console.log("agent-platform.test.js OK", {
    authors: authors.join(" -> "),
    total_co2e_kg: report.total_co2e_kg,
  });
}

(async () => {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await runOnce();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        console.warn(`agent-platform.test.js retry ${attempt}: ${error.message}`);
      }
    }
  }
  throw lastError;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
