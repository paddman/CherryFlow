# OpenClaw Integration

CherryFlow and OpenClaw solve different parts of the automation stack:

- **CherryFlow** owns workflow definitions, graph validation, run state, retries, schedules, approvals, files, versions, and audit history.
- **OpenClaw** owns agent execution, tool use, messaging channels, sessions, memory, and host or device interaction.

The integration is deliberately based on an explicit HTTP contract. CherryFlow does not depend on private OpenClaw Gateway frame formats.

## Architecture

```text
LINE / Web / API / Schedule
            |
            v
      CherryFlow workflow
            |
            v
     agent.openclaw node
            |
            v
   OpenClaw bridge HTTP API
            |
            v
 Agent session + approved tools
```

## Required OpenClaw bridge endpoints

```http
POST /api/agents/run
GET /api/agents/runs/:runId
```

The current CherryFlow adapter creates an agent run and polls the run endpoint until it reaches `completed` or `failed`.

### Create an agent run

```json
{
  "agentId": "linux-doctor",
  "prompt": "Inspect server-01 and explain the high load average.",
  "context": {
    "workflowInputs": {
      "host": "server-01"
    },
    "dependencies": {
      "collect": {
        "cpuPercent": 92
      }
    },
    "cherryFlow": {
      "moduleType": "agent.openclaw",
      "riskLevel": "read",
      "requiresApproval": false
    }
  },
  "idempotencyKey": "workflow-run-123-node-diagnose"
}
```

CherryFlow sends the API token through the `x-openclaw-token` header.

### Agent run response

```json
{
  "runId": "agent-run-456",
  "status": "queued"
}
```

The run status must be one of:

```text
queued | running | completed | failed
```

A completed run may return any JSON value in `output`. Object outputs are merged into the CherryFlow node output. Scalar or array outputs are returned under `output`. CherryFlow always adds `agentRunId` and `status` to the final node output.

## Environment variables

```env
CHERRYFLOW_AI_PROVIDER=openclaw
OPENCLAW_BRIDGE_URL=http://localhost:18790
OPENCLAW_API_TOKEN=change-me
OPENCLAW_AGENT_ID=cherryflow-agent
```

`OPENCLAW_API_TOKEN` is mandatory when an `agent.openclaw` workflow node executes.

## Workflow node configuration

```json
{
  "id": "diagnose",
  "moduleType": "agent.openclaw",
  "config": {
    "agentId": "linux-doctor",
    "prompt": "Inspect the supplied host and return a structured diagnosis.",
    "riskLevel": "read",
    "requiresApproval": false,
    "timeoutMs": 60000,
    "pollIntervalMs": 800
  }
}
```

Supported configuration fields:

| Field | Required | Description |
|---|---:|---|
| `prompt` | Yes | Instruction sent to the OpenClaw agent |
| `agentId` | No | Agent identifier; defaults to `OPENCLAW_AGENT_ID` |
| `riskLevel` | No | Metadata such as `read`, `write`, or `dangerous` |
| `requiresApproval` | No | Requires an explicit approval reference before execution |
| `approvalId` | Conditional | Required when `requiresApproval` is `true`; may also come from workflow inputs |
| `idempotencyKey` | No | Stable request key; may also come from workflow inputs |
| `timeoutMs` | No | Polling timeout from 1 second to 10 minutes |
| `pollIntervalMs` | No | Polling interval from 100 ms to 10 seconds |
| `context` | No | Additional JSON context; system workflow context cannot be overridden |

## Approval behavior

CherryFlow performs a fail-closed precondition check for protected agent nodes:

```json
{
  "moduleType": "agent.openclaw",
  "config": {
    "prompt": "Restart the unhealthy model container.",
    "riskLevel": "write",
    "requiresApproval": true
  }
}
```

This node fails before contacting OpenClaw unless an `approvalId` is present in either node configuration or workflow inputs.

The current check proves that an approval reference was supplied. A production approval service must additionally verify that the approval exists, is unexpired, belongs to the same tenant and workflow run, and covers the requested action.

## Recommended production correlation fields

Use stable identifiers so logs can be traced across both systems:

```json
{
  "idempotencyKey": "workflow-run-123-node-diagnose-attempt-1",
  "context": {
    "traceId": "trace-001",
    "workflowRunId": "workflow-run-123",
    "nodeRunId": "node-run-789",
    "tenantId": "company-a",
    "requestedBy": {
      "channel": "line",
      "userId": "U123"
    }
  }
}
```

## Recommended first workflow

```text
Grafana webhook
  -> collect metrics
  -> agent.openclaw diagnosis (read-only)
  -> human approval
  -> agent.openclaw remediation (write)
  -> health verification
  -> LINE notification
```

Keep diagnosis and remediation as separate agent nodes. The diagnosis node should use read-only tools. The remediation node should require approval and a narrower tool allowlist.

## Current limitations

- Completion uses polling rather than callbacks or events.
- Approval references are checked for presence but not yet verified against a durable approval service.
- The MVP workflow runtime does not yet expose a native workflow run ID inside every module context.
- Retry, resume, cancellation, PostgreSQL persistence, and distributed workers remain production-core roadmap work.
