# OpenClawXCherry Runtime Integration

OpenClawXCherry is the agent execution runtime created for CherryFlow. It is not treated as a separate general-purpose product integration.

- **CherryFlow** is the product and control plane. It owns workflow definitions, graph validation, run state, retries, schedules, approvals, files, versions, tenants, and audit history.
- **OpenClawXCherry** is the execution plane. It owns agent execution, tools, messaging channels, sessions, memory, local models, and host or device interaction.

The runtime boundary uses an explicit HTTP contract so CherryFlow does not depend on private Gateway frame formats.

The existing compatibility names remain:

- Workflow module type: `agent.openclaw`
- Provider value: `openclaw`
- Environment variables: `OPENCLAW_*`

These names are retained to avoid unnecessary breaking changes. The deployed component is OpenClawXCherry.

## Architecture

```text
LINE / Web / API / Schedule
            |
            v
       CherryFlow product
 workflow · state · approval · audit
            |
            v
      agent.openclaw node
            |
            v
 OpenClawXCherry Runtime API
            |
            v
 agent session · approved tools · local models
```

## Runtime endpoints

```http
POST /api/agents/run
GET /api/agents/runs/:runId
GET /api/agents/health
```

The CherryFlow adapter creates an agent run and polls the runtime until it reaches `completed` or `failed`.

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

CherryFlow sends the shared runtime token through the `x-openclaw-token` header.

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
OPENCLAW_BRIDGE_URL=http://openclawxcherry:18789
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
| `prompt` | Yes | Instruction sent to the OpenClawXCherry runtime agent |
| `agentId` | No | Runtime agent identifier; defaults to `OPENCLAW_AGENT_ID` |
| `riskLevel` | No | Metadata such as `read`, `write`, or `dangerous` |
| `requiresApproval` | No | Requires an explicit approval reference before execution |
| `approvalId` | Conditional | Required when `requiresApproval` is `true`; may also come from workflow inputs |
| `idempotencyKey` | No | Stable request key; may also come from workflow inputs |
| `timeoutMs` | No | Polling timeout from 1 second to 10 minutes |
| `pollIntervalMs` | No | Polling interval from 100 ms to 10 seconds |
| `context` | No | Additional JSON context; system workflow context cannot be overridden |

## Approval behavior

CherryFlow performs a fail-closed precondition check for protected runtime nodes:

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

This node fails before contacting OpenClawXCherry unless an `approvalId` is present in either node configuration or workflow inputs.

The current check proves that an approval reference was supplied. A production approval service must additionally verify that the approval exists, is unexpired, belongs to the same tenant and workflow run, and covers the requested action.

## Production correlation fields

Use stable identifiers so one operation can be traced from CherryFlow into its runtime:

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
  -> CherryFlow collects metrics
  -> OpenClawXCherry diagnosis agent (read-only)
  -> CherryFlow human approval
  -> OpenClawXCherry remediation agent (restricted write tools)
  -> CherryFlow verifies service health
  -> OpenClawXCherry sends LINE notification
  -> CherryFlow records and closes the incident
```

Keep diagnosis and remediation as separate runtime agents. The diagnosis agent should use read-only tools. The remediation agent should require approval and a narrower tool allowlist.

## Current limitations

- Completion uses polling rather than callbacks or events.
- Approval references are checked for presence but not yet verified against a durable approval service.
- The MVP workflow runtime does not yet expose a native workflow run ID inside every module context.
- Retry, resume, cancellation, PostgreSQL persistence, and distributed workers remain production-core roadmap work.
