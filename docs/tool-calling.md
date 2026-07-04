# Native tool-calling loop

CherryFlow includes a native OpenAI-compatible agent loop for models that return Chat Completions `tool_calls`.

The runtime follows this cycle:

```text
user prompt
  -> model selects one or more tools
  -> CherryFlow validates tool names and JSON arguments
  -> approval policy is checked
  -> registered tools execute
  -> tool results are appended to the conversation
  -> model continues until it returns a final answer
```

The loop is separate from the deterministic workflow DAG. A workflow can invoke it through the `agent.tool-loop` module, or a client can call the agent API directly.

## Model server requirements

The configured OpenAI-compatible server must support:

- `POST /v1/chat/completions`
- `tools`
- `tool_choice: "auto"`
- assistant messages containing `tool_calls`
- messages with `role: "tool"` and `tool_call_id`

For model servers that require a tool-call parser or chat template option, enable the parser appropriate for the deployed model.

## Configuration

```env
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_API_KEY=local
OPENAI_MODEL=qwen3.5-35b-a3b
CHERRYFLOW_AGENT_MAX_ITERATIONS=8
CHERRYFLOW_TOOL_OUTPUT_MAX_CHARS=24000
```

## Discover available tools

```bash
curl http://localhost:4000/api/agent/tools
```

Built-in read-only tools currently include:

- `system_current_time`
- `workflow_list`
- `workflow_get`

Tool names use only letters, numbers, underscores, and hyphens for broad OpenAI-compatible server support.

## Run Cherry directly

```bash
curl http://localhost:4000/api/agent/run \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "List the available workflows and explain which one creates reports",
    "allowedTools": ["workflow_list", "workflow_get"],
    "maxIterations": 6
  }'
```

The response contains the final answer, model name, number of model iterations, and a trace of every completed or failed tool call.

## Use inside a workflow graph

```json
{
  "id": "agent",
  "moduleType": "agent.tool-loop",
  "config": {
    "prompt": "Inspect the available workflow and summarize it",
    "allowedTools": ["workflow_list", "workflow_get"],
    "maxIterations": 6
  }
}
```

The module can also read the prompt from workflow input fields named `prompt` or `message`.

## Approval policy

Every tool declares a risk level:

- `read`
- `write`
- `admin`

Read tools run without approval. Write and admin tools are denied unless their exact names are included in `approvedTools` for that run. A denial is returned to the model as a failed tool result so the model can explain the required approval or choose a safer path.

```json
{
  "prompt": "Restart VM 100",
  "allowedTools": ["vm_restart"],
  "approvedTools": ["vm_restart"]
}
```

An allowed tool is not automatically approved. Keep `allowedTools` and `approvedTools` separate when adding infrastructure or business-operation tools.

## Safety limits

- Unknown and disallowed tool names are rejected.
- Arguments must decode to a JSON object.
- Tool output sent back to the model is size limited.
- The model iteration count is capped between 1 and 20.
- A protected tool cannot execute without explicit approval.
- Failed tool calls are recorded in the returned trace.
