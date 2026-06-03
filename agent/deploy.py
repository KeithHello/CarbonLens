"""
Deploy CarbonLens Agent to Vertex AI Agent Engine.

Usage:
    python agent/deploy.py

Prerequisites:
    - gcloud CLI installed and authenticated
    - Vertex AI API enabled
    - GOOGLE_CLOUD_PROJECT env var set (or pass via --project)
    - MONGODB_MCP_URL env var set (pointing to MongoDB MCP Server)

The script creates (or updates) an Agent Engine deployment with:
    - Model: gemini-flash-latest
    - Auto-scaling: 0–3 instances
    - Region: us-central1 (required for Agent Engine)
"""

import argparse
import logging
import os
import sys

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(message)s",
)
logger = logging.getLogger("carbonlens.deploy")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "")
LOCATION = os.getenv("AGENT_ENGINE_LOCATION", "us-central1")
AGENT_DISPLAY_NAME = os.getenv("AGENT_DISPLAY_NAME", "carbonlens-agent")
MIN_INSTANCES = int(os.getenv("AGENT_MIN_INSTANCES", "0"))
MAX_INSTANCES = int(os.getenv("AGENT_MAX_INSTANCES", "3"))


def deploy() -> str:
    """
    Deploy the CarbonLens agent to Agent Engine.

    Returns the endpoint URL of the deployed agent.
    """
    # Import here so adk web / local dev does not require vertexai dep
    try:
        from google.cloud import aiplatform
    except ImportError:
        logger.error(
            "google-cloud-aiplatform not installed. "
            "Run: pip install google-cloud-aiplatform"
        )
        sys.exit(1)

    from agent.agent import root_agent

    # Project validation
    project = PROJECT_ID or _get_default_project()
    if not project:
        logger.error(
            "GOOGLE_CLOUD_PROJECT not set. Set it via environment variable "
            "or run: gcloud config set project YOUR_PROJECT_ID"
        )
        sys.exit(1)

    logger.info("Initializing Vertex AI: project=%s location=%s", project, LOCATION)
    aiplatform.init(project=project, location=LOCATION)

    # -----------------------------------------------------------------------
    # Deploy
    # -----------------------------------------------------------------------
    logger.info(
        "Deploying agent '%s' to Agent Engine...", AGENT_DISPLAY_NAME
    )

    remote_agent = aiplatform.AgentEngine.create(
        agent=root_agent,
        display_name=AGENT_DISPLAY_NAME,
        description=(
            "CarbonLens — Carbon footprint tracking agent for "
            "Google Cloud Rapid Agent Hackathon (MongoDB Track). "
            "Powered by Gemini 3.5 Flash + MongoDB MCP."
        ),
        min_instances=MIN_INSTANCES,
        max_instances=MAX_INSTANCES,
    )

    endpoint = getattr(remote_agent, "endpoint", "")
    if not endpoint:
        # Try alternate attribute names depending on SDK version
        endpoint = getattr(remote_agent, "resource_name", "")
        if not endpoint:
            logger.warning(
                "Could not extract endpoint URL from response. "
                "Check Google Cloud Console → Vertex AI → Agent Engine."
            )
            endpoint = "(see console)"

    logger.info("=" * 60)
    logger.info("  CarbonLens Agent deployed successfully!")
    logger.info("  Endpoint: %s", endpoint)
    logger.info("  Model:    gemini-flash-latest")
    logger.info("  Project:  %s", project)
    logger.info("  Region:   %s", LOCATION)
    logger.info("")
    logger.info("  Add this to your Next.js .env.local:")
    logger.info("  AGENT_ENGINE_URL=%s", endpoint)
    logger.info("=" * 60)

    return endpoint


def _get_default_project() -> str:
    """Try to read the default project from gcloud config."""
    import subprocess

    try:
        result = subprocess.run(
            ["gcloud", "config", "get-value", "project"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        project = result.stdout.strip()
        if project and "(unset)" not in project:
            return project
    except Exception:
        pass
    return ""


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Deploy CarbonLens to Vertex AI Agent Engine"
    )
    parser.add_argument(
        "--project",
        help="Google Cloud project ID (overrides GOOGLE_CLOUD_PROJECT env var)",
    )
    parser.add_argument(
        "--location",
        default=LOCATION,
        help="Agent Engine region (default: us-central1)",
    )
    parser.add_argument(
        "--name",
        default=AGENT_DISPLAY_NAME,
        help="Display name for the deployed agent",
    )
    args = parser.parse_args()

    if args.project:
        PROJECT_ID = args.project
    if args.location:
        LOCATION = args.location
    if args.name:
        AGENT_DISPLAY_NAME = args.name

    deploy()
