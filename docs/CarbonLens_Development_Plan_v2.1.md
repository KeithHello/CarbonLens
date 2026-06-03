# CarbonLens Development Plan v2.1

**Project:** CarbonLens  
**Competition:** Google Cloud Rapid Agent Hackathon, MongoDB track  
**Submission deadline:** June 11, 2026, 14:00 PDT

## Architecture

CarbonLens is an English-first carbon footprint demo built around three layers:

- Next.js frontend with text input, voice input, report, history, and settings pages.
- Google ADK multi-agent workflow deployed on Google Cloud Agent Engine.
- MongoDB Atlas accessed through the MongoDB MCP server for emission factors,
  benchmarks, user entries, and user profiles.

The frontend calls `/api/carbon/calculate`. The API route sends the activity text
to Agent Engine, normalizes the returned CarbonReport, and stores the result in
MongoDB so the history and report pages can read it quickly.

## Technology Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Agent runtime | Google Cloud Agent Engine | Hosted ADK runtime |
| Agent framework | Google ADK | Multi-agent orchestration |
| Model | `gemini-flash-latest` | Fast activity parsing and report generation |
| Data tool | MongoDB MCP server | Factor, benchmark, profile, and history access |
| Database | MongoDB Atlas | Demo and persisted user data |
| Frontend | Next.js App Router | Competition demo UI |
| Charts | Chart.js + react-chartjs-2 | Report and history visualization |
| Voice | Web Speech API | Browser-native speech-to-text |

## Agent Workflow

1. `activity_parser` extracts normalized activities, quantities, and units.
2. `factor_matcher` looks up emission factors through MongoDB MCP and calculates
   per-activity emissions.
3. `benchmark_advisor` compares the result with global, national, and personal
   benchmarks, then returns ranked reduction suggestions.

The deployed runtime uses Gemini API key mode with `GOOGLE_GENAI_USE_VERTEXAI=false`.
Telemetry is enabled through `GOOGLE_CLOUD_AGENT_ENGINE_ENABLE_TELEMETRY=true`.

## MongoDB Collections

- `emission_factors`: activity IDs, categories, units, factors, sources, confidence.
- `global_benchmarks`: global and country-level daily/annual averages.
- `user_entries`: saved CarbonReport documents and individual activity records.
- `user_profiles`: demo user preferences and future feedback personalization.

## Frontend Pages

- `/`: product overview and competition pitch.
- `/input`: natural language logging with integrated microphone input.
- `/voice`: dedicated speech input page.
- `/report`: carbon footprint report, breakdown, comparisons, record deletion, and suggestions.
- `/history`: recent 7-day or 30-day history with chart/list views.
- `/settings`: user preferences and adopted suggestion statistics.

## Demo Data

The reset script seeds:

- 70+ emission factors across all six categories.
- Global, Japan, United States, China, and India benchmarks.
- 200 deterministic demo records.
- Special May 1-May 27, 2026 records with daily emissions between 8 and 12 kg CO2e.

Run:

```bash
npm run reset:demo
```

To clear user data while keeping base factor and benchmark data:

```bash
node scripts/reset-demo-data.js --empty
```

## Current Status

Completed:

- Next.js frontend pages and mobile-friendly layout.
- Integrated text and voice logging.
- Report detail page with per-record deletion.
- History chart/list view with emission-based color scale.
- Local adoption statistics in settings.
- MongoDB Atlas seed/reset workflow.
- ADK multi-agent deployment script.
- Agent Engine deployment with `gemini-flash-latest`.

Remaining or optional improvements:

- Deploy the frontend to Cloud Run.
- Add full end-to-end browser automation coverage.
- Add richer personal profile persistence for suggestion feedback.
- Add production observability dashboards for latency and Agent tool calls.
