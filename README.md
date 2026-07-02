# CherryFlow

CherryFlow is an AI-first workflow and app builder. Users compose reusable workflow modules, upload or enter data, run deterministic and agent-based steps, then publish a generated frontend for the workflow.

## Core direction

- Workflow engine for reusable modules
- AI Frontend Generator based on validated UI Schema
- OpenClaw integration as an optional agent runtime plugin
- Human approval, audit logs, versioning, and rollback
- TypeScript-first monorepo with Python services only where AI/ML tooling requires it

## Planned architecture

```text
Workflow Definition
        ↓
Input / Output Schema
        ↓
Deterministic Nodes + Agent Nodes
        ↓
Validated UI Schema
        ↓
CherryFlow Renderer
        ↓
Preview / Approve / Publish
```

Development starts in feature branches and is merged through pull requests.
