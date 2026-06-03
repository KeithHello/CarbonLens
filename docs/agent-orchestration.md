# CarbonLens Agent Orchestration

## Runtime

- Platform: Google Cloud Vertex AI Agent Engine / Agent Platform
- Project: `gemini-api-paid-456415`
- Region: `us-central1`
- Display name: `carbonlens-agent`
- Model: `gemini-flash-latest`
- Framework: Google ADK
- Runtime entrypoint: `agent.agent_engine_app:adk_app`
- ADK app wrapper: `vertexai.preview.reasoning_engines.AdkApp`
- Min instances: `0`
- Max instances: `3`
- Telemetry: enabled via `GOOGLE_CLOUD_AGENT_ENGINE_ENABLE_TELEMETRY=true`

## Active Workflow

The root agent is a `SequentialAgent` named `carbonlens`.

Current active order:

```text
activity_parser -> factor_matcher -> benchmark_advisor
```

### 1. activity_parser

Type: `LlmAgent`

Purpose:

- Parse Chinese, English, or Japanese natural-language activity text.
- Extract candidate activities, quantities, units, and assumptions.
- Normalize units such as `km`, `kg`, `kWh`, `hours`, `servings`.
- Prefer known activity IDs such as `gasoline_car_city`, `beef`,
  `ac_cooling`, `video_streaming_hd`, and `hotel_stay`.

Output state key:

```text
parsed_activities
```

### 2. factor_matcher

Type: `LlmAgent`

Tools:

```text
MongoDB MCP
```

Purpose:

- Look up emission factors in `emission_factors`.
- Calculate per-activity and per-category CO2e.
- Preserve special cases such as negative factors for recycling.
- Return total CO2e and category breakdown.

Output state key:

```text
emission_calculation
```

### 3. benchmark_advisor

Type: `LlmAgent`

Tools:

```text
MongoDB MCP
```

Purpose:

- Read `global_benchmarks`.
- Read `user_entries` for personal history when available.
- Read `user_profiles` for preference context when available.
- Generate final `CarbonReport` JSON.

Output state key:

```text
carbon_report
```

Final required report shape:

```text
total_co2e_kg
breakdown
comparison
suggestions
trees_needed
session_id
timestamp
tier_label
anomaly_flag
```

## MongoDB MCP

Current connection mode:

```text
mongodb+srv://... via npx mongodb-mcp-server@1.11.0 over stdio
```

Used by:

- `factor_matcher`
- `benchmark_advisor`

Collections:

- `emission_factors`
- `global_benchmarks`
- `user_entries`
- `user_profiles`

Current categories in `emission_factors`:

- `Transport`
- `Food`
- `Energy`
- `Consumer Goods`
- `Waste`
- `Services & Digital Life`

## Persistence

There is a `persistence_agent` defined in `agent/agent.py`, but it is not active
in the deployed sequential chain.

Current production behavior:

- Agent Platform returns a `CarbonReport`.
- Next.js `/api/carbon/calculate` normalizes `timestamp` and `session_id`.
- Next.js saves the report directly into MongoDB `user_entries`.
- `/api/carbon/history` and `/api/carbon/report` read directly from MongoDB.

This split is intentional for now because direct API persistence is faster and
more stable than asking the LLM agent to persist as the last step.

## Performance Notes

The current chain runs three LLM agents sequentially and uses MongoDB MCP tool
calls in two of them. Typical API latency is around 20-50 seconds.

Main reasons:

- Three serial model calls.
- MCP tool calls add network/tool latency.
- `AGENT_MIN_INSTANCES=0` allows cold starts.

Potential optimizations:

- Set `AGENT_MIN_INSTANCES=1` for demos.
- Merge `activity_parser` and `factor_matcher`.
- Move emission factor matching into deterministic application code.
- Keep Agent Platform focused on explanation and suggestions.
