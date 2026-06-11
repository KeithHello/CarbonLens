# CarbonLens

CarbonLens is an English-first carbon footprint tracker built for the Google Cloud Rapid Agent Hackathon.

It combines:

- a Next.js frontend for text, voice, report, history, and settings workflows
- a Google ADK multi-agent backend deployed on Google Cloud Agent Engine
- MongoDB Atlas accessed through the MongoDB MCP server
- Gemini Flash for fast parsing, matching, and report generation

## What It Does

1. Users describe daily activities in natural language.
2. The agent parses activities, looks up emission factors, and calculates CO2e.
3. The result is compared with global, national, and personal benchmarks.
4. Ranked reduction suggestions are generated and tracked locally.
5. Reports and history are persisted in MongoDB for later review.

## Architecture

The current production flow is:

- `Next.js` frontend
- `/api/carbon/calculate` proxy route
- `Agent Engine` multi-agent workflow
- `MongoDB MCP` tool access
- `MongoDB Atlas` persistence for reports, benchmarks, and demo data

The active agent orchestration is:

```text
activity_parser -> factor_matcher -> benchmark_advisor
```

The deployed agent uses:

- `gemini-flash-latest`
- `GOOGLE_GENAI_USE_VERTEXAI=false`
- `GOOGLE_CLOUD_AGENT_ENGINE_ENABLE_TELEMETRY=true`

## Key Features

- Natural language logging in English
- Voice input with the browser Web Speech API
- Report page with category breakdown, comparison, and tree offset reference
- History page with chart and list views
- Record deletion at both the report and single-record level
- Local adoption statistics in settings
- Demo data reset script with deterministic sample records

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14 App Router + TypeScript |
| Styling | Tailwind CSS |
| Charts | Chart.js + react-chartjs-2 |
| Agent framework | Google ADK |
| Agent runtime | Google Cloud Agent Engine |
| Model | Gemini Flash |
| Database | MongoDB Atlas |
| MCP server | `mongodb-mcp-server` |
| Voice | Web Speech API |

## Project Structure

```text
src/
  app/
    page.tsx        # Landing page
    input/page.tsx  # Text input page
    voice/page.tsx  # Voice input page
    report/page.tsx # Carbon report
    history/page.tsx# History view
    settings/page.tsx
    api/carbon/     # API routes
  components/
    CarbonGauge.tsx
    EmissionPieChart.tsx
    TrendLineChart.tsx
    VoiceRecorder.tsx
  lib/
    agent-client.ts
    mongodb.ts
    types.ts
agent/
  agent.py
  agent_engine_app.py
  deploy.py
data/
  emission_factors.json
  global_benchmarks.json
scripts/
  reset-demo-data.js
  import-commands.mongosh.js
docs/
  agent-orchestration.md
  demo-data.md
  CarbonLens_Development_Plan_v2.1.md
```

## Getting Started

### Frontend

```bash
npm install
npm run dev
```

Open the app at the local URL printed by Next.js.

### Agent

The agent is deployed to Google Cloud Agent Engine and can also be run locally with ADK tooling if needed.

### Demo Data

Restore the demo dataset:

```bash
npm run reset:demo
```

Restore base collections only:

```bash
npm run reset:empty
```

## Environment

The frontend expects server-side environment variables in `.env.local`.

The agent uses `agent/.env` for MongoDB and Google Cloud settings.

Important values include:

- `AGENT_ENGINE_URL`
- `GCP_SERVICE_ACCOUNT_TOKEN`
- `GOOGLE_GENAI_USE_VERTEXAI`
- `GOOGLE_CLOUD_AGENT_ENGINE_ENABLE_TELEMETRY`
- `MONGODB_MCP_URL`

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run reset:demo
npm run reset:empty
npm run test
npm run test:data
npm run test:mongodb
npm run test:agent
npm run test:api
```

## Validation

The repo includes tests for:

- seed and factor data
- MongoDB connectivity and collection counts
- Agent Platform orchestration
- end-to-end API persistence

## Demo Data

The seeded dataset includes:

- 70 emission factors
- 5 benchmark regions
- 200 deterministic demo records
- 27 May records covering May 1 to May 27, 2026

See [`docs/demo-data.md`](docs/demo-data.md) for the reset and verification workflow.

## Documentation

- [`docs/agent-orchestration.md`](docs/agent-orchestration.md)
- [`docs/demo-data.md`](docs/demo-data.md)
- [`docs/CarbonLens_Development_Plan_v2.1.md`](docs/CarbonLens_Development_Plan_v2.1.md)

## License

MIT
