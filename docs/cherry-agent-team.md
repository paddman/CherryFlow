# Cherry Agent Team

Cherry Agent Team turns the business ladder into an executable multi-agent operating model.

```text
                 Cherry Leadership
            strategy / KPI / approval
                         ↑
                   Cherry Sales
            leads / CRM / proposal / deal
                         ↑
                 Cherry Marketing
          research / campaign / content / brand
                         ↑
                  Cherry Delivery
       workflow / infrastructure / QA / fulfillment
                         ↑
                   Cherry Admin
       access / schedule / records / policy / audit
```

The ladder represents **operating support**, not a requirement that every task passes through every agent. Routine work is routed directly to the most suitable owner. Admin preflight and Leadership approval are added only when risk, access, production, finance, or governance requires them.

## Agents

| Agent | Daily responsibility | Typical tools | Approval boundary |
|---|---|---|---|
| `cherry-admin` | Permissions, schedules, records, audit, tool governance | Calendar, Gmail, files, identity, finance records | Deletion, credentials, financial commitment |
| `cherry-delivery` | Execute workflows, infrastructure work, incidents, QA, customer output | Shell sandbox, HTTP, workflow runner, vision, documents | Production change, destructive operation, external delivery |
| `cherry-marketing` | Audience research, content, campaigns, brand and analytics | Search, image/vision, CMS, campaign analytics | Campaign publish, brand change, ad spend |
| `cherry-sales` | Leads, CRM, proposals, pricing and follow-up | CRM, email, calendar, proposal generator | Discounts, pricing exceptions, contracts |
| `cherry-leadership` | Strategy, priorities, KPI review, budget and high-risk approval | Dashboards, reports, approval queue | Irreversible executive decisions |

## Runtime model

Each agent follows the same bounded loop:

```text
Observe task and available evidence
              ↓
Decide whether a tool is required
              ↓
Validate agent permission and approval token
              ↓
Execute one constrained tool call
              ↓
Inspect the real tool result
              ↓
Continue, delegate, request approval, or finish
```

Controls included in `@cherryflow/agent-team`:

- Maximum step count per agent.
- Agent-specific tool allowlists.
- High-risk and critical tool approval keys.
- Vision attachments in the task contract.
- Tool-result evidence before success can be claimed.
- Deterministic task routing and a reviewable team plan.
- Admin preflight for access, credentials, production, and high-risk work.
- Leadership approval after high-risk execution proposals.

## Example: route and plan a task

```ts
import { createCherryTeamPlan } from "@cherryflow/agent-team";

const plan = createCherryTeamPlan({
  id: "incident-001",
  objective: "Deploy and verify the production server incident fix",
  risk: "high",
  tags: ["production"],
});

console.log(plan.steps.map((step) => `${step.phase}: ${step.agent.id}`));
// preflight: cherry-admin
// execute: cherry-delivery
// approve: cherry-leadership
```

## Example: tool-call and vision loop

```ts
import {
  executeCherryAgentTask,
  getCherryAgent,
  type AgentModel,
  type AgentTool,
} from "@cherryflow/agent-team";

const model: AgentModel = {
  async complete(input) {
    // Adapt this boundary to Qwen/vLLM, SGLang, OpenAI-compatible APIs,
    // or the CherryFlow provider layer.
    return provider.complete(input);
  },
};

const tools: AgentTool[] = [
  {
    name: "inspect_image",
    description: "Inspect a supplied screenshot and return observations",
    allowedAgents: ["cherry-delivery", "cherry-marketing"],
    execute: async ({ path }) => visionService.inspect(String(path)),
  },
  {
    name: "restart_production",
    description: "Restart an approved production service",
    allowedAgents: ["cherry-delivery"],
    risk: "high",
    approvalKey: "change:INC-001",
    execute: async ({ service }) => operations.restart(String(service)),
  },
];

const result = await executeCherryAgentTask({
  agent: getCherryAgent("cherry-delivery"),
  task: {
    id: "INC-001",
    objective: "Analyze the screenshot and restore the failed service",
    risk: "high",
    attachments: [
      { type: "image", mimeType: "image/png", path: "incident.png" },
    ],
  },
  model,
  tools,
  approvals: ["change:INC-001"],
});
```

## Recommended production deployment

```text
Channels / API / Webhook / CherryFlow UI
                    ↓
             Task Intake Queue
                    ↓
       Cherry Team Router and Planner
                    ↓
 Admin ─ Delivery ─ Marketing ─ Sales
                    ↑
        Leadership Approval Queue
                    ↓
    Tool Gateway with RBAC and Audit
                    ↓
 Proxmox / vLLM / CRM / Email / Files / Web
```

Use a durable queue and database for production execution. Tool credentials should remain in the Tool Gateway or a secrets manager, never in prompts or model-visible task metadata.

## Operating metrics

Track outcomes per agent rather than only token usage:

- **Admin:** access lead time, audit completeness, failed policy checks.
- **Delivery:** completion time, retry rate, incident recovery time, QA pass rate.
- **Marketing:** qualified demand, campaign conversion, content reuse.
- **Sales:** lead response time, proposal-to-close rate, pipeline value.
- **Leadership:** approval latency, priority changes, KPI attainment, risk exceptions.
