# CherryFlow architecture

## Design principle

AI proposes. CherryFlow validates and executes.

The model never writes or executes arbitrary browser JavaScript. It returns a constrained UI Schema whose components come from an allowlist. The renderer uses normal React components and treats all generated text as data.

## Runtime

```text
Builder UI
  ├─ generate/refine prompt
  ├─ render live preview
  ├─ save version
  └─ publish slug
          ↓
CherryFlow API
  ├─ workflow registry
  ├─ AI planner adapters
  ├─ schema normalize/validate
  ├─ version and publish store
  └─ workflow run state machine
          ↓
JSON persistence (MVP)
```

## AI provider boundary

- `local`: deterministic planner for zero-configuration operation.
- `openai`: server-side Chat Completions call with JSON output instructions.
- `openclaw`: server-side HTTP bridge adapter. The bridge is expected to translate requests to the OpenClaw Gateway and return the final structured output.

Provider failures fall back to the local planner. Invalid model output is rejected and replaced with a validated local schema.

## Publish model

Publishing creates an immutable version and maps a sanitized slug to that version. Rollback creates a new draft version copied from an older version; it does not mutate history.

## Workflow run model

A form submission creates a run in `queued` state. The API transitions it to `running`, executes the registered workflow handler, then persists `completed` outputs or a `failed` error. The browser polls the run endpoint.

## MVP storage

The default store is a single JSON file so a new checkout works immediately. The interfaces are intentionally separated so PostgreSQL, Redis/BullMQ, and MinIO adapters can replace it without changing the UI contract.

## Security controls included

- Component allowlist through discriminated TypeScript unions
- Input/output binding validation
- Duplicate component ID detection
- Theme color validation
- Prompt and title length limits
- Request body size limit
- Server-side provider secrets
- No `dangerouslySetInnerHTML`
- File size limit in the browser and API
- Published slug sanitization

## Production hardening still required

- Authentication, workspaces, RBAC, and tenant isolation
- CSRF protection and restrictive CORS
- Durable distributed queue
- Object storage and malware scanning
- Rate limits and quotas
- Audit export and retention policy
- Encrypted secret manager
- OpenClaw sandbox policy and tool allowlists
