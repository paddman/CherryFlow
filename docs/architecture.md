# CherryFlow architecture

## Responsibility split

CherryFlow owns workflow definitions, input/output contracts, execution state, permissions, audit logs, UI Schema validation, app publishing, and rollback.

OpenClaw is an optional agent runtime. It can plan and call tools, but it must not own CherryFlow job state or publish arbitrary generated JavaScript directly.

```text
CherryFlow Web
    ↓
CherryFlow API ───── PostgreSQL
    ↓                    ↓
Workflow Worker ───── Redis Queue
    │
    ├── Deterministic modules
    ├── Direct LLM module
    └── OpenClaw Agent plugin
                 ↓
          OpenClaw Gateway
```

## AI frontend generation

1. Read the workflow input/output contract.
2. Send the user prompt and contract to the AI planner.
3. Produce UI Schema, not executable application code.
4. Validate component types and every input/output binding.
5. Render with CherryFlow-approved React components.
6. Preview, approve, version, and publish.

## Security boundaries

- No arbitrary JavaScript in the initial UI generator.
- OpenClaw credentials stay server-side.
- Agent tools use an allowlist per workspace.
- Sensitive actions require human approval.
- Every prompt, tool call, workflow run, and publish action is auditable.
- Agent execution should use isolated containers or sandboxes.

## Initial API surface

```text
GET  /health
GET  /api/workflows/:workflowId
POST /api/workflows/:workflowId/ui/generate
POST /api/workflows/:workflowId/ui/refine
POST /api/workflows/:workflowId/ui/validate
POST /api/workflows/:workflowId/ui/publish
POST /api/workflows/:workflowId/runs
GET  /api/runs/:runId
```
