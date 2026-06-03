# CarbonLens 🌍

AI-powered carbon footprint tracker for the **Google Cloud Rapid Agent Hackathon 2026**.

Built with **Gemini 3.5 Flash + Vertex AI Agent Builder + MongoDB MCP**.

## How It Works

1. 🎤 **Speak** or ✏️ **type** your daily activities in natural language
2. AI agent matches activities to 64 emission factors and calculates your carbon footprint
3. Compare your footprint against global and national benchmarks
4. Get personalized, ranked reduction suggestions with difficulty levels
5. Track your progress over time with charts and history

## Architecture

```
User Browser (Next.js 14)
        │
        ├── Voice/Text Input
        │
        ▼
CarbonLens Frontend ──► /api/carbon/calculate
        │                      │
        │                      ▼
        │              Agent Engine (Gemini 3.5 Flash)
        │                      │
        │                      ├── MongoDB MCP Server (find/insert)
        │                      │         │
        │                      ▼         ▼
        │               MongoDB Atlas
        │               ├── emission_factors (64 entries)
        │               ├── user_entries
        │               ├── global_benchmarks (5 countries)
        │               └── user_profiles
        │
        ▼
    Report Page
    ├── Pie Chart (category breakdown)
    ├── Gauge (global + national percentile)
    ├── Trend Line (30-day history with anomaly detection)
    └── Reduction Suggestions (with feedback buttons)
```

## Features

- **Natural Language Input** — describe your day in Chinese, English, or Japanese
- **Voice Input** — Web Speech API with real-time activity detection tags
- **64 Emission Factors** — transport, food, energy, consumer goods, waste
- **5-Tier Classification** — from low to extreme with per-country benchmarks
- **Personalized Suggestions** — 14 reduction methods ranked by feasibility
- **Carbon Gauge** — SVG semicircle visualization of your global/national percentile
- **30-Day Trend** — line chart with anomaly highlights
- **User Preferences** — country, diet, transport settings persisted locally
- **Dark-ready** — Tailwind-based design with consistent green brand palette

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS + custom animations |
| Charts | Chart.js (react-chartjs-2) |
| AI Agent | Vertex AI Agent Builder + Gemini 3.5 Flash |
| Data | MongoDB Atlas via MCP Server |
| Voice | Web Speech API (`zh-CN`) |
| Deploy | Google Cloud Run + Cloud Build |
| CI | GitHub Actions |

## Quick Start

### Frontend (Next.js)

```bash
npm install
npm run dev
```

Open http://localhost:3000
(Mock mode active by default — no cloud setup needed)

### Agent (ADK + MongoDB MCP)

```bash
# 1. Install Python dependencies
pip install -r agent/requirements.txt

# 2. Start MongoDB MCP Server (requires Node.js)
npx mongodb-mcp-server@latest setup

# 3. Configure agent/.env from agent/.env.example
#    Set GOOGLE_CLOUD_PROJECT and MONGODB_MCP_URL

# 4. Run agent locally with ADK Dev UI
adk web
# → Open http://localhost:8000, select "carbonlens" agent

# 5. Deploy to Agent Engine
python agent/deploy.py
```

## Environment Variables

Create `.env.local`:

```bash
# Leave empty for local mock mode:
AGENT_ENGINE_URL=

# Only needed for production (Agent Engine + GCP):
# GCP_SERVICE_ACCOUNT_TOKEN=your-service-account-token
```

## Deploy to Cloud Run

```bash
# One-click deploy via Cloud Build
gcloud builds submit --config=cloudbuild.yaml

# Or manually:
docker build -t gcr.io/$PROJECT_ID/carbonlens .
docker push gcr.io/$PROJECT_ID/carbonlens
gcloud run deploy carbonlens \
  --image=gcr.io/$PROJECT_ID/carbonlens \
  --region=asia-northeast1 \
  --platform=managed \
  --allow-unauthenticated
```

## Project Structure

```
carbonlens/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── layout.tsx            # Root layout + NavBar
│   │   ├── input/page.tsx        # Text input
│   │   ├── voice/page.tsx        # Voice input (Web Speech API)
│   │   ├── report/page.tsx       # Carbon footprint report
│   │   ├── history/page.tsx      # 30-day history + bar chart
│   │   ├── settings/page.tsx     # User preferences
│   │   └── api/carbon/           # API routes
│   ├── components/
│   │   ├── CarbonGauge.tsx       # SVG semicircle gauge
│   │   ├── EmissionPieChart.tsx  # Chart.js pie chart
│   │   ├── TrendLineChart.tsx    # Chart.js line chart
│   │   └── VoiceRecorder.tsx     # Web Speech API logic
│   └── lib/
│       ├── agent-client.ts       # Agent Engine API client + mock
│       └── types.ts              # TypeScript type definitions
├── agent/
│   ├── agent.py                  # ADK Agent definition (Gemini + MCP)
│   ├── deploy.py                 # Deploy to Vertex AI Agent Engine
│   ├── requirements.txt          # Python dependencies
│   └── .env.example              # Agent environment template
├── data/
│   ├── emission_factors.json     # 64 emission factors
│   └── benchmarks.json           # 5 country benchmarks
├── scripts/
│   └── import-factors.js         # MongoDB import script
├── system-instruction.md         # Agent Builder system instruction
├── Dockerfile
├── cloudbuild.yaml
└── .github/workflows/ci.yml
```

## MongoDB Track

This project competes in the **MongoDB Track** of the Google Cloud Rapid Agent Hackathon.

Key MongoDB integration points:
- **MCP Server** connects Agent Engine directly to MongoDB Atlas
- Agent uses `find` to query emission factors by activity/category
- Agent uses `insert-many` to persist each user calculation
- Agent uses `aggregate` for 30-day trend and percentile analysis
- Agent uses `update` for user profile preferences and feedback learning

See `system-instruction.md` for the full Agent Builder configuration with all MongoDB tool definitions.

## License

MIT — see [LICENSE](LICENSE)
