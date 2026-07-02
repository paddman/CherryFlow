# AI providers

## Local planner

`CHERRYFLOW_AI_PROVIDER=local`

The local planner uses prompt keywords to choose layout, theme, labels, and optional content sections. It is deterministic, fast, and useful for development or as a fallback.

## OpenAI-compatible provider

```env
CHERRYFLOW_AI_PROVIDER=openai
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_API_KEY=local
OPENAI_MODEL=qwen3.5-35b-a3b
```

CherryFlow sends the workflow contract, current schema when refining, and the user prompt to `/chat/completions`. The response must contain a JSON object matching the CherryFlow UI Schema. The API normalizes and validates it before returning it to the browser.

## OpenClaw bridge

```env
CHERRYFLOW_AI_PROVIDER=openclaw
OPENCLAW_BRIDGE_URL=http://localhost:18790
OPENCLAW_API_TOKEN=change-me
OPENCLAW_AGENT_ID=cherryflow-ui-builder
```

The included plugin client expects a small HTTP bridge with:

```text
POST /api/agents/run
GET  /api/agents/runs/:runId
```

The bridge should translate these calls to the OpenClaw Gateway, wait for the agent output, and return a JSON UI Schema. Keeping this bridge explicit avoids guessing or coupling CherryFlow to private Gateway frame details.
