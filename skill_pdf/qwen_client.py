"""
Calls a local Qwen model served via vLLM's OpenAI-compatible API and asks it
to return ONLY the report JSON (never asks it to draw anything).

Usage:
    from qwen_client import generate_report_json
    report = generate_report_json(raw_data_text, instruction="...")
    build_pdf(report, "out.pdf")
"""
import json
import os
import time
import requests
from templates import LAYOUTS
from chart_renderers import RENDERERS

VLLM_BASE_URL = "http://localhost:8000/v1"   # Paddba's vLLM endpoint
MODEL_NAME = "Qwen2.5-72B-Instruct"          # swap for whatever tag vLLM serves
CONNECT_TIMEOUT_SECONDS = 10
READ_TIMEOUT_SECONDS = 120
HTTP_RETRIES = 2
HTTP_BACKOFF_SECONDS = 0.75


class QwenNetworkError(RuntimeError):
    """Raised when the vLLM HTTP call fails before model JSON can be validated."""


class QwenJSONValidationError(RuntimeError):
    """Raised when Qwen responds but never returns valid report JSON."""


def _auth_headers():
    """Use the same env names as CherryFlow plus common local-model aliases."""
    token = (
        os.getenv("QWEN_API_KEY")
        or os.getenv("OPENAI_API_KEY")
        or os.getenv("LM_API_TOKEN")
        or os.getenv("VLLM_API_KEY")
    )
    return {"Authorization": f"Bearer {token}"} if token else {}


def _env_flag(name, default=True):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "off", "no", "none", ""}


def _should_use_guided_json(base_url, use_guided_json):
    """vLLM supports extra_body.guided_json; hosted APIs usually do not."""
    if not use_guided_json:
        return False
    if not _env_flag("QWEN_USE_GUIDED_JSON", True):
        return False
    host = base_url.lower()
    if "api.deepseek.com" in host:
        return False
    return True

# Minimal schema: forces valid JSON + a "pages" array where every page has a
# "layout" string. We do NOT try to fully constrain every layout's fields via
# guided_json (gets unwieldy with 8 layout shapes) — instead the system
# prompt below documents the exact shapes, and _validate() below catches
# anything Qwen gets wrong before we ever touch matplotlib.
REPORT_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "pages": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"layout": {"type": "string"}},
                "required": ["layout"],
            },
        }
    },
    "required": ["pages"],
}

SYSTEM_PROMPT = f"""You are a report-planning engine. You NEVER draw charts —
you only output a JSON object describing what should go on each page.
Respond with ONLY valid JSON. No markdown fences, no commentary.

Available page layouts (page_spec["layout"]): {list(LAYOUTS.keys())}
Available chart types (chart_spec["type"]): {list(RENDERERS.keys())}

Shapes:
- cover: {{"layout":"cover","title","subtitle","meta"}}
- full_chart: {{"layout":"full_chart","heading","body","chart":{{...}}}}
- two_col_charts: {{"layout":"two_col_charts","heading","charts":[{{...}},{{...}}]}}
- three_col_charts: {{"layout":"three_col_charts","heading","charts":[{{...}},{{...}},{{...}}]}}
- chart_with_table: {{"layout":"chart_with_table","heading","chart":{{...}},"table":{{"headers":[...],"rows":[[...]]}}}}
- kpi_grid: {{"layout":"kpi_grid","heading","kpis":[{{"label","value","delta"}}]}}
- table_only: {{"layout":"table_only","heading","body","table":{{"headers":[...],"rows":[[...]]}}}}
- text_block: {{"layout":"text_block","heading","body"}}
- timeline: {{"layout":"timeline","heading","body","events":[{{"date","label","detail","severity":"normal|warning|high"}}]}}

Chart specs:
- line: {{"type":"line","title","x":[...],"series":{{"name":[nums]}}}}
- bar: {{"type":"bar","title","labels":[...],"values":[...]}}
- barh: {{"type":"barh","title","labels":[...],"values":[...]}}
- pie: {{"type":"pie","title","labels":[...],"values":[...]}}
- stacked_area: {{"type":"stacked_area","title","x":[...],"series":{{"name":[nums]}}}}
- grouped_bar: {{"type":"grouped_bar","title","labels":[...],"series":{{"name":[nums]}}}}
- heatmap: {{"type":"heatmap","title","x":["00:00",...],"y":["Mon",...],"values":[[nums],...],"unit":"Gbps"}}
- gauge: {{"type":"gauge","title","value":72,"min":0,"max":100,"threshold":80,"unit":"%"}}

Only ever use numbers/labels found in or directly computable from the data
you're given. Never invent statistics.
"""


def _extract_json(text):
    """Strip fences and parse the first JSON object even if the model adds trailing text."""
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Model response content was empty; expected JSON text")
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        if start < 0:
            raise
        decoder = json.JSONDecoder()
        report, _ = decoder.raw_decode(text[start:])
        return report


def _validate(report):
    """Fail loudly (before matplotlib runs) if Qwen used an unknown layout/chart type."""
    if not isinstance(report, dict):
        raise ValueError("Report JSON must be an object with a pages array")
    pages = report.get("pages")
    if not isinstance(pages, list) or not pages:
        raise ValueError("Report JSON must include a non-empty pages array")
    for page in pages:
        if not isinstance(page, dict):
            raise ValueError("Every page must be a JSON object")
        if page["layout"] not in LAYOUTS:
            raise ValueError(f"Unknown layout from model: {page['layout']}")
        for chart in ([page["chart"]] if "chart" in page else page.get("charts", [])):
            if not isinstance(chart, dict):
                raise ValueError("Every chart must be a JSON object")
            if chart["type"] not in RENDERERS:
                raise ValueError(f"Unknown chart type from model: {chart['type']}")
    return report


def _post_with_retries(url, payload, connect_timeout=CONNECT_TIMEOUT_SECONDS,
                       read_timeout=READ_TIMEOUT_SECONDS, http_retries=HTTP_RETRIES,
                       backoff_seconds=HTTP_BACKOFF_SECONDS):
    """Call vLLM with HTTP-level retries; separate from model JSON retries."""
    last_err = None
    for attempt in range(http_retries + 1):
        try:
            resp = requests.post(url, json=payload, headers=_auth_headers(), timeout=(connect_timeout, read_timeout))
            resp.raise_for_status()
            return resp
        except requests.RequestException as exc:
            last_err = exc
            if attempt < http_retries:
                time.sleep(backoff_seconds * (2 ** attempt))
                continue
    raise QwenNetworkError(f"QWEN_NETWORK_ERROR: vLLM HTTP call failed after {http_retries + 1} attempts: {last_err}") from last_err


def _chat_completion_content(base_url, payload, **http_options):
    resp = _post_with_retries(f"{base_url}/chat/completions", payload, **http_options)
    try:
        body = resp.json()
        return body["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise QwenNetworkError("QWEN_NETWORK_ERROR: vLLM response was not OpenAI-compatible JSON") from exc


def generate_report_json(raw_data_text, instruction, base_url=VLLM_BASE_URL,
                          model=MODEL_NAME, use_guided_json=True, retries=1,
                          connect_timeout=CONNECT_TIMEOUT_SECONDS,
                          read_timeout=READ_TIMEOUT_SECONDS,
                          http_retries=HTTP_RETRIES):
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Instruction: {instruction}\n\nData:\n{raw_data_text}"},
        ],
        "temperature": 0.2,
        "max_tokens": int(os.getenv("OPENAI_MAX_TOKENS", "4000") or "4000"),
    }
    if _should_use_guided_json(base_url, use_guided_json):
        # vLLM extension — forces syntactically valid JSON matching the schema
        payload["extra_body"] = {"guided_json": REPORT_JSON_SCHEMA}
    elif _env_flag("OPENAI_RESPONSE_FORMAT_JSON", True):
        # Hosted OpenAI-compatible APIs such as DeepSeek support JSON object mode.
        payload["response_format"] = {"type": "json_object"}

    last_err = None
    for attempt in range(retries + 1):
        content = _chat_completion_content(
            base_url,
            payload,
            connect_timeout=connect_timeout,
            read_timeout=read_timeout,
            http_retries=http_retries,
        )
        try:
            report = _extract_json(content)
            return _validate(report)
        except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
            last_err = e
            # tell the model exactly what broke and let it try again
            payload["messages"].append({"role": "assistant", "content": content})
            payload["messages"].append({
                "role": "user",
                "content": f"That failed validation: {e}. Return corrected JSON only.",
            })
    raise QwenJSONValidationError(f"QWEN_JSON_VALIDATION_ERROR: Qwen never returned valid report JSON after {retries + 1} attempts: {last_err}")
