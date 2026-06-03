"""
CarbonLens Agent — Carbon Footprint Tracking with Gemini + MongoDB MCP.

Uses Google ADK (Agent Development Kit) for agent creation and orchestration.
Connects to MongoDB Atlas via the official MongoDB MCP Server.
Deploys to Vertex AI Agent Engine.

Project: Google Cloud Rapid Agent Hackathon (MongoDB Track)
"""

import logging
import os

from dotenv import load_dotenv
from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.tools.mcp_tool import (
    MCPToolset,
    StdioConnectionParams,
    StreamableHTTPConnectionParams,
)
from mcp.client.stdio import StdioServerParameters

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("carbonlens")

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
load_dotenv()

MONGODB_MCP_URL = os.getenv(
    "MONGODB_MCP_URL",
    "http://localhost:8080/mcp",
)
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")

# ---------------------------------------------------------------------------
# System Instruction
# ---------------------------------------------------------------------------
# Load the complete rulebook that contains emission factors (70 entries),
# tier classification rules, suggestion matching engine, tree offset
# calculator, and report output format.
_SYSTEM_INSTRUCTION_PATH = os.path.join(
    os.path.dirname(__file__), "..", "system-instruction.md"
)

def _load_system_instruction() -> str:
    """Load system instruction from file, with inline fallback."""
    try:
        with open(_SYSTEM_INSTRUCTION_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        logger.info(
            "Loaded system instruction: %d chars from %s",
            len(content),
            _SYSTEM_INSTRUCTION_PATH,
        )
        # Strip the markdown header comment lines that are not part of the
        # actual instruction the agent should follow.
        lines = content.split("\n")
        start_idx = 0
        for i, line in enumerate(lines):
            if line.startswith("## 1. CORE IDENTITY"):
                start_idx = i
                break
        return "\n".join(lines[start_idx:])
    except FileNotFoundError:
        logger.warning("system-instruction.md not found, using minimal fallback")
        return _FALLBACK_INSTRUCTION


_FALLBACK_INSTRUCTION = """\
You are CarbonLens, a carbon footprint tracking AI agent.

When a user describes daily activities, you:
1. Parse activities from natural language
2. Match each activity to an emission factor via MongoDB find
3. Calculate total CO2e and breakdown by category
4. Compare against global benchmarks and user history
5. Generate prioritized reduction suggestions
6. Calculate tree offset equivalent
7. Persist result to MongoDB user_entries
8. Output a structured carbon report
"""

# ---------------------------------------------------------------------------
# MCP Toolset — MongoDB
# ---------------------------------------------------------------------------

def _create_mcp_toolset() -> MCPToolset:
    """Configure connection to MongoDB MCP Server."""
    if MONGODB_MCP_URL.startswith(("mongodb://", "mongodb+srv://")):
        logger.info("Starting MongoDB MCP over stdio from Atlas connection string")
        return MCPToolset(
            connection_params=StdioConnectionParams(
                server_params=StdioServerParameters(
                    command="npx",
                    args=["-y", "mongodb-mcp-server@1.11.0"],
                    env={
                        "MDB_MCP_CONNECTION_STRING": MONGODB_MCP_URL,
                    },
                ),
            ),
        )

    logger.info("Connecting to MongoDB MCP over Streamable HTTP at: %s", MONGODB_MCP_URL)
    return MCPToolset(
        connection_params=StreamableHTTPConnectionParams(
            url=MONGODB_MCP_URL,
        ),
    )

# ---------------------------------------------------------------------------
# Agent Creation
# ---------------------------------------------------------------------------

def _build_activity_parser_agent() -> LlmAgent:
    """Parse user activity text into normalized candidate activities."""
    return LlmAgent(
        model=GEMINI_MODEL,
        name="activity_parser",
        description=(
            "Parses natural-language daily activity descriptions into "
            "structured candidate activities, quantities, units, and assumptions."
        ),
        generate_content_config={"temperature": 0},
        instruction="""\
You are the CarbonLens activity parser.

Given a user message in English:
1. Extract all daily activities that may affect carbon emissions.
2. Infer quantities only when the user is vague; mark every inferred value.
3. Normalize units to km, kg, L, kWh, hours, servings, uses, or pieces.
4. Prefer activity IDs from CarbonLens data, such as gasoline_car_city,
   beef, ac_cooling, electricity_japan, bus, subway, rice, chicken,
   video_streaming_hd, video_call, online_shopping_delivery, hotel_stay.
5. Return concise structured JSON for downstream agents.
6. Use English labels, categories, assumptions, and notes.

Do not calculate emissions. Do not persist data.
""",
        output_key="parsed_activities",
    )


def _build_factor_matching_agent(mcp_tools: MCPToolset) -> LlmAgent:
    """Match parsed activities to MongoDB emission factors."""
    return LlmAgent(
        model=GEMINI_MODEL,
        name="factor_matcher",
        description=(
            "Looks up emission factors in MongoDB and calculates category "
            "emissions for parsed activities."
        ),
        generate_content_config={"temperature": 0},
        instruction="""\
You are the CarbonLens factor matcher and calculator.

Use MongoDB MCP tools for every factor lookup:
- Query emission_factors with find by activity/category/regex.
- Never invent a factor if MongoDB has a relevant entry.
- The database is already known as carbonlens and collections are already
  known. Do not call list_databases, list_collections, discovery, schema, or
  any tool whose exact name is not presented to you by the tool runtime.

Input is available in state key parsed_activities.
For every activity:
1. Call only an available MongoDB MCP find/search tool against
   emission_factors. Do not claim "source: MongoDB" unless a tool result was
   used.
2. Calculate kg CO2e = quantity * factor.
3. Apply consumer-goods amortization over 365 days when relevant.
4. Preserve negative factors for recycling.
5. Return structured JSON with matched factors, per-activity emissions,
   total_co2e_kg, and breakdown by category.
6. Use English category labels only: Transport, Food, Energy,
   Consumer Goods, Waste, Services & Digital Life.

If the exact MongoDB MCP find/search tool is unavailable or tool names are not
shown, do not call any tool. Use the CarbonLens fallback factors and set
"tool_warning": "MongoDB MCP lookup was not completed".
""",
        tools=[mcp_tools],
        output_key="emission_calculation",
    )


def _build_benchmark_advisor_agent(mcp_tools: MCPToolset) -> LlmAgent:
    """Compare emissions with benchmarks and generate suggestions."""
    return LlmAgent(
        model=GEMINI_MODEL,
        name="benchmark_advisor",
        description=(
            "Compares results with global/national/personal history and "
            "generates ranked carbon reduction suggestions."
        ),
        generate_content_config={"temperature": 0},
        instruction="""\
You are the CarbonLens benchmark and suggestion specialist.

Use MongoDB MCP tools:
- Read global_benchmarks for country/global daily averages.
- Read user_entries for 30-day personal history when user_id exists.
- Read user_profiles for preferences and feedback weights when available.

Input is available in state key emission_calculation.
Produce:
1. global_percentile and national_percentile
2. vs_personal_avg when history exists, otherwise null
3. tier_label and anomaly_flag
4. top 3-5 ranked suggestions using priority = reduction * feasibility * personalization
5. trees_needed using cedar-tree default: Daily_CO2e_kg / 0.35

Return raw valid JSON only. Do not wrap it in markdown fences. Do not add
comments, trailing commas, ellipses, explanations, or any text outside JSON.
Use double-quoted JSON property names and string values.
All user-facing text must be English.

Return only this exact CarbonReport JSON shape:
{
  "total_co2e_kg": number,
  "breakdown": [
    {"category": string, "kg_co2e": number, "percentage": number}
  ],
  "comparison": {
    "global_percentile": number,
    "national_percentile": number,
    "vs_personal_avg": number | null,
    "global_avg_kg": number,
    "national_avg_kg": number
  },
  "suggestions": [
    {
      "rank": number,
      "title": string,
      "problem": string,
      "suggestion": string,
      "reduction_kg": number,
      "difficulty": "easy" | "medium" | "hard",
      "category": string
    }
  ],
  "trees_needed": number,
  "session_id": string,
  "timestamp": string,
  "tier_label": string,
  "anomaly_flag": string | null
}

Do not include activities, matched_factors, category_breakdown,
breakdown_by_category, priority, feasibility_score, or any non-schema keys.
Do not persist it.
""",
        tools=[mcp_tools],
        output_key="carbon_report",
    )


def _build_persistence_agent(mcp_tools: MCPToolset) -> LlmAgent:
    """Persist final report and user profile updates to MongoDB."""
    return LlmAgent(
        model=GEMINI_MODEL,
        name="persistence_agent",
        description="Persists CarbonLens reports and profile updates to MongoDB.",
        generate_content_config={"temperature": 0},
        instruction="""\
You are the CarbonLens persistence specialist.

Input is available in state key carbon_report.
Use MongoDB MCP tools:
1. Call MongoDB MCP insert-many to insert the exact final report into
   user_entries with user_id and timestamp.
2. Call MongoDB MCP find/insert-many as needed to create a user_profiles
   document on first interaction if missing.
3. Store feedback/preferences only when the user explicitly provides them.

Return the same CarbonReport JSON unchanged after persistence. Do not merge in
parsed activities or matched factors. If persistence fails, include a concise
persistence_warning field but otherwise keep the CarbonReport schema unchanged.
""",
        tools=[mcp_tools],
        output_key="persisted_report",
    )


def create_agent() -> SequentialAgent:
    """
    Create the CarbonLens multi-agent workflow.

    A SequentialAgent is used so each request always passes through parsing,
    factor matching, benchmark/suggestion generation, and persistence. This
    avoids stopping after a single delegated specialist response.
    """
    system_instruction = _load_system_instruction()
    mcp_tools = _create_mcp_toolset()
    sub_agents = [
        _build_activity_parser_agent(),
        _build_factor_matching_agent(mcp_tools),
        _build_benchmark_advisor_agent(mcp_tools),
    ]

    agent = SequentialAgent(
        name="carbonlens",
        description=(
            "CarbonLens carbon footprint workflow: parse, match factors, "
            "compare, advise, and persist."
        ),
        sub_agents=sub_agents,
    )

    logger.info(
        "CarbonLens multi-agent coordinator created: model=%s sub_agents=%d",
        GEMINI_MODEL,
        len(sub_agents),
    )
    return agent


# ---------------------------------------------------------------------------
# Module-level instance (for adk web / adk run)
# ---------------------------------------------------------------------------
root_agent = create_agent()
