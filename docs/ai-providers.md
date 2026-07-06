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

## Qwen PDF report skill

The built-in `report-generator` workflow includes a `report.qwen_pdf` node.
When the user selects PDF output, this node can call
`skill_pdf/run_report.py`, which asks Qwen for renderer-safe report JSON and
then builds the final PDF with code-controlled ReportLab layouts/charts.

```env
CHERRYFLOW_REPORT_PDF_SKILL=auto
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_API_KEY=local-or-empty
OPENAI_MODEL=Qwen2.5-72B-Instruct
```

`CHERRYFLOW_REPORT_PDF_SKILL=auto` falls back to the normal CherryFlow report
renderer if the Python skill or model endpoint is unavailable. Use
`CHERRYFLOW_REPORT_PDF_SKILL=required` when a failed Qwen PDF render should
fail the workflow run. The Python client also accepts `QWEN_API_KEY`,
`LM_API_TOKEN`, or `VLLM_API_KEY` as bearer-token aliases for local model
gateways.

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
