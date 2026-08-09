# Workflow Template Library

CherryFlow includes 35 runnable workflow templates. Each template has a real Workflow Contract, executable graph, form inputs, output bindings, and metadata for the Template Gallery.

## Product surfaces

- `/templates` browses and filters all templates.
- `/run/{workflowId}` runs a template immediately.
- `/builder?workflow={workflowId}` uses the selected workflow as the contract for an AI-generated application.
- `GET /api/templates` returns safe public template metadata.
- `GET /api/workflows/{workflowId}` returns the workflow contract after authentication.

## Categories

| Category | Examples |
|---|---|
| Documents and reports | AI Report Generator, Meeting Minutes, Executive Brief, Proposal, SOP, Contract Review, Policy Gap |
| Sales and marketing | Lead Qualification, Proposal Email, Campaign Plan, Content Calendar, Product Description, Sales Call Follow-up |
| Human resources | Job Description, Resume Screening, Interview Guide, Onboarding, Performance Review |
| Customer service | Complaint Triage, Service Recovery, FAQ and Knowledge Article |
| IT and security | Incident Triage, RCA, Change Risk, Cyber Alert Summary, Vulnerability Remediation |
| Finance, data, and projects | Budget Variance, Procurement Comparison, Project Status, Risk Register, Data Quality Audit |
| Integrations and ChatOps | Telegram Bot, Discord Webhook, LINE Official Account, Multi-channel Dispatch |

## Reusable `ai.task` module

Most business templates use the reusable `ai.task` module:

```text
core.input → ai.task → core.output
```

The template config supplies:

- task name
- professional role
- task-specific instructions
- input labels
- optional source-file field

When `CHERRYFLOW_AI_PROVIDER=openai` and `OPENAI_BASE_URL` are configured, the module calls the Local Qwen/OpenAI-compatible endpoint and requests structured JSON with:

- `result`
- `summary`
- `checklist`
- `nextSteps`

If the model is disabled, unavailable, or returns invalid data, the module returns a deterministic, reviewable fallback instead of failing the whole workflow.

## Notification modules

ChatOps templates use these executable modules:

```text
notify.telegram
notify.discord
notify.line
notify.dispatch
```

Credentials remain in server environment variables. Dry Run is enabled by default and external delivery also requires `confirmSend=true`. See [`notification-connectors.md`](notification-connectors.md) for configuration and trust boundaries.

## Safety model

Templates produce drafts and decision support. They do not approve contracts, hire candidates, authorize changes, block systems, choose vendors, or make other consequential decisions. Human review remains required before external publication or operational action.

Notification templates are external side effects. Test with Dry Run, verify the destination, then explicitly confirm the send. Provider failures are recorded per channel; CherryFlow does not pretend a partial delivery was universal success, a charming habit best left to status meetings.

The reusable task prompt also instructs the model to:

- use only supplied facts
- identify missing information
- avoid invented names, numbers, laws, or commitments
- separate evidence from assumptions
- return a checklist for human review
