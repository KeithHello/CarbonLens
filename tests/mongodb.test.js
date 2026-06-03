const assert = require("assert");
const { MongoClient } = require("mongodb");
const { forcePublicDns, parseEnvFile } = require("./helpers");

forcePublicDns();

(async () => {
  const env = parseEnvFile("agent/.env");
  const uri = env.MONGODB_MCP_URL;
  assert(/^mongodb(\+srv)?:\/\//.test(uri || ""), "MONGODB_MCP_URL must be a MongoDB URI.");

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db("carbonlens");
    const counts = {
      emission_factors: await db.collection("emission_factors").countDocuments(),
      global_benchmarks: await db.collection("global_benchmarks").countDocuments(),
    };
    assert.strictEqual(counts.emission_factors, 70, "MongoDB emission_factors count");
    assert.strictEqual(counts.global_benchmarks, 5, "MongoDB global_benchmarks count");

    const collections = await db.listCollections().toArray();
    for (const name of [
      "emission_factors",
      "global_benchmarks",
      "user_entries",
      "user_profiles",
    ]) {
      assert(collections.some((collection) => collection.name === name), `Missing ${name}`);
    }

    const factorIndexes = await db.collection("emission_factors").indexes();
    assert(
      factorIndexes.some((index) => index.name.includes("activity")),
      "Missing emission_factors activity index",
    );

    console.log("mongodb.test.js OK", counts);
  } finally {
    await client.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
