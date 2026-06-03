const assert = require("assert");
const fs = require("fs");

const factors = JSON.parse(fs.readFileSync("data/emission_factors.json", "utf8"));
const benchmarks = JSON.parse(fs.readFileSync("data/global_benchmarks.json", "utf8"));

assert.strictEqual(factors.length, 70, "Expected 70 emission factors.");
assert.strictEqual(benchmarks.length, 5, "Expected 5 global benchmarks.");

const activities = new Set();
for (const factor of factors) {
  assert(factor.activity, "factor.activity is required");
  assert(factor.category, `factor.category is required for ${factor.activity}`);
  assert.strictEqual(
    typeof factor.factor_kg_co2e,
    "number",
    `factor_kg_co2e must be a number for ${factor.activity}`,
  );
  assert(!activities.has(factor.activity), `Duplicate activity ${factor.activity}`);
  activities.add(factor.activity);
}

for (const code of ["GLOBAL", "JP", "US", "CN", "IN"]) {
  assert(
    benchmarks.some((benchmark) => benchmark.country_code === code),
    `Missing benchmark ${code}`,
  );
}

console.log("data.test.js OK");
