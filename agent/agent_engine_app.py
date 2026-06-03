"""Agent Platform Runtime entrypoint for CarbonLens."""

from google.adk.sessions import InMemorySessionService
from vertexai.preview.reasoning_engines import AdkApp

from agent.agent import root_agent


def build_session_service() -> InMemorySessionService:
    """Use in-memory sessions when running with Gemini API key auth."""
    return InMemorySessionService()


adk_app = AdkApp(
    agent=root_agent,
    env_vars={
        "GOOGLE_CLOUD_AGENT_ENGINE_ID": "carbonlens",
        "GOOGLE_GENAI_USE_VERTEXAI": "false",
    },
    session_service_builder=build_session_service,
)
