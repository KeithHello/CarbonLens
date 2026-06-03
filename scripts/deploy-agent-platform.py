"""Deploy CarbonLens to Gemini Enterprise Agent Platform Runtime.

This follows the official Agent Runtime source-files deployment shape:
- source_packages
- entrypoint_module / entrypoint_object
- requirements_file
- class_methods
- env_vars
- build_options with installation_scripts/install_npx.sh
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import vertexai
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
AGENT_ENV = ROOT / "agent" / ".env"
RESOURCE_ID_FILE = ROOT / "agent" / ".agent_engine_resource.json"


def _load_env() -> dict[str, str]:
    env = {k: v for k, v in dotenv_values(AGENT_ENV).items() if v}
    # Avoid inherited shell variables silently overriding agent/.env.
    for key in ("GOOGLE_API_KEY", "GEMINI_API_KEY"):
        if key not in env:
            os.environ.pop(key, None)
    for key, value in env.items():
        os.environ[key] = value
    return env


def _runtime_env_vars(env: dict[str, str]) -> dict[str, Any]:
    """Filter env vars according to Agent Runtime guidance."""
    allowed = {
        "GOOGLE_API_KEY",
        "GEMINI_API_KEY",
        "GOOGLE_GENAI_USE_VERTEXAI",
        "MONGODB_MCP_URL",
        "AGENT_ENGINE_LOCATION",
        "AGENT_DISPLAY_NAME",
        "AGENT_MIN_INSTANCES",
        "AGENT_MAX_INSTANCES",
        "GEMINI_MODEL",
        "GOOGLE_CLOUD_AGENT_ENGINE_ENABLE_TELEMETRY",
    }
    return {key: env[key] for key in allowed if env.get(key)}


def _class_methods() -> list[dict[str, Any]]:
    return [
        {
            "name": "async_stream_query",
            "api_mode": "async_stream",
            "parameters": {
                "type": "object",
                "properties": {
                    "message": {
                        "anyOf": [
                            {"type": "string"},
                            {"type": "object", "additionalProperties": True},
                        ]
                    },
                    "user_id": {"type": "string"},
                    "session_id": {"type": "string", "nullable": True},
                    "run_config": {"type": "object", "nullable": True},
                },
                "required": ["message", "user_id"],
            },
        },
        {
            "name": "async_create_session",
            "api_mode": "async",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string"},
                    "session_id": {"type": "string", "nullable": True},
                    "state": {"type": "object", "nullable": True},
                },
                "required": ["user_id"],
            },
        },
        {
            "name": "async_get_session",
            "api_mode": "async",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string"},
                    "session_id": {"type": "string"},
                },
                "required": ["user_id", "session_id"],
            },
        },
        {
            "name": "async_list_sessions",
            "api_mode": "async",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string"},
                },
                "required": ["user_id"],
            },
        },
    ]


def main() -> None:
    env = _load_env()
    project = env.get("GOOGLE_CLOUD_PROJECT")
    location = env.get("AGENT_ENGINE_LOCATION", "us-central1")
    display_name = env.get("AGENT_DISPLAY_NAME", "carbonlens-agent")
    if not project:
        raise RuntimeError("GOOGLE_CLOUD_PROJECT is required in agent/.env")

    client = vertexai.Client(project=project, location=location)
    config: dict[str, Any] = {
        "display_name": display_name,
        "description": "CarbonLens multi-agent carbon footprint tracker.",
        "source_packages": [
            "agent",
            "system-instruction.md",
            "requirements.txt",
            "installation_scripts/install_npx.sh",
        ],
        "entrypoint_module": "agent.agent_engine_app",
        "entrypoint_object": "adk_app",
        "requirements_file": "requirements.txt",
        "class_methods": _class_methods(),
        "env_vars": _runtime_env_vars(env),
        "build_options": {
            "installation_scripts": ["installation_scripts/install_npx.sh"],
        },
        "agent_framework": "google-adk",
        "min_instances": int(env.get("AGENT_MIN_INSTANCES", "0")),
        "max_instances": int(env.get("AGENT_MAX_INSTANCES", "3")),
        "labels": {
            "app": "carbonlens",
            "framework": "google-adk",
        },
    }

    resource_id = os.environ.get("AGENT_ENGINE_ID")
    if not resource_id and RESOURCE_ID_FILE.exists():
        resource_id = json.loads(RESOURCE_ID_FILE.read_text(encoding="utf-8-sig")).get(
            "name"
        )

    if resource_id:
        remote_agent = client.agent_engines.update(name=resource_id, config=config)
    else:
        remote_agent = client.agent_engines.create(config=config)

    api_resource = getattr(remote_agent, "api_resource", remote_agent)
    result = {
        "name": getattr(api_resource, "name", resource_id),
        "display_name": getattr(api_resource, "display_name", display_name),
        "location": location,
    }
    RESOURCE_ID_FILE.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
