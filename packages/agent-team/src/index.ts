export type CherryAgentLayer = "admin" | "delivery" | "marketing" | "sales" | "leadership";
export type CherryAgentId = `cherry-${CherryAgentLayer}`;
export type TaskRisk = "low" | "medium" | "high" | "critical";

export interface VisionAttachment {
  type: "image";
  mimeType: string;
  url?: string;
  path?: string;
  description?: string;
}

export interface AgentTask {
  id: string;
  objective: string;
  requiredCapabilities?: string[];
  risk?: TaskRisk;
  attachments?: VisionAttachment[];
  requiresAdminPreflight?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CherryAgentDefinition {
  id: CherryAgentId;
  name: string;
  layer: CherryAgentLayer;
  mission: string;
  capabilities: readonly string[];
  delegatesTo: readonly CherryAgentId[];
  requiresApprovalFor: readonly string[];
  maxSteps: number;
}

export const CHERRY_AGENT_TEAM: readonly CherryAgentDefinition[] = [
  {
    id: "cherry-admin",
    name: "Cherry Admin",
    layer: "admin",
    mission: "Provide the operational foundation: access, schedules, records, policy, audit, and tool governance.",
    capabilities: [
      "access-control",
      "scheduling",
      "records",
      "finance-ops",
      "audit",
      "tool-governance",
      "workspace-management",
    ],
    delegatesTo: ["cherry-delivery", "cherry-marketing", "cherry-sales", "cherry-leadership"],
    requiresApprovalFor: ["delete", "credential-change", "financial-commitment"],
    maxSteps: 6,
  },
  {
    id: "cherry-delivery",
    name: "Cherry Delivery",
    layer: "delivery",
    mission: "Execute and verify customer work, workflows, infrastructure operations, incidents, and final deliverables.",
    capabilities: [
      "workflow-execution",
      "customer-fulfillment",
      "incident-response",
      "quality-assurance",
      "file-processing",
      "vision-analysis",
      "infrastructure-ops",
    ],
    delegatesTo: ["cherry-admin", "cherry-leadership"],
    requiresApprovalFor: ["production-change", "destructive-operation", "external-delivery"],
    maxSteps: 12,
  },
  {
    id: "cherry-marketing",
    name: "Cherry Marketing",
    layer: "marketing",
    mission: "Create demand through research, positioning, campaigns, content, brand assets, and performance analysis.",
    capabilities: [
      "audience-research",
      "campaign-planning",
      "content-creation",
      "brand-management",
      "vision-analysis",
      "marketing-analytics",
    ],
    delegatesTo: ["cherry-delivery", "cherry-sales", "cherry-leadership"],
    requiresApprovalFor: ["publish-campaign", "brand-change", "ad-spend"],
    maxSteps: 10,
  },
  {
    id: "cherry-sales",
    name: "Cherry Sales",
    layer: "sales",
    mission: "Convert qualified demand into revenue through lead handling, CRM work, proposals, pricing, and follow-up.",
    capabilities: [
      "lead-qualification",
      "crm-management",
      "proposal-writing",
      "pricing",
      "follow-up",
      "pipeline-analysis",
    ],
    delegatesTo: ["cherry-admin", "cherry-delivery", "cherry-marketing", "cherry-leadership"],
    requiresApprovalFor: ["discount", "contract-commitment", "pricing-exception"],
    maxSteps: 10,
  },
  {
    id: "cherry-leadership",
    name: "Cherry Leadership",
    layer: "leadership",
    mission: "Set direction, prioritize work, approve high-risk actions, review KPIs, and delegate to the right operating agent.",
    capabilities: [
      "strategy",
      "prioritization",
      "approval",
      "kpi-review",
      "delegation",
      "risk-management",
      "budget-governance",
    ],
    delegatesTo: ["cherry-admin", "cherry-delivery", "cherry-marketing", "cherry-sales"],
    requiresApprovalFor: ["irreversible-decision"],
    maxSteps: 8,
  },
] as const;

const KEYWORDS: Record<CherryAgentLayer, readonly string[]> = {
  admin: [
    "admin",
    "permission",
    "access",
    "account",
    "schedule",
    "calendar",
    "record",
    "invoice",
    "audit",
    "policy",
    "credential",
  ],
  delivery: [
    "deliver",
    "execute",
    "deploy",
    "incident",
    "server",
    "infra",
    "workflow",
    "fix",
    "build",
    "test",
    "customer work",
    "production",
  ],
  marketing: [
    "marketing",
    "campaign",
    "content",
    "brand",
    "audience",
    "seo",
    "social",
    "advert",
    "creative",
    "market research",
  ],
  sales: [
    "sales",
    "lead",
    "crm",
    "proposal",
    "quotation",
    "quote",
    "customer follow-up",
    "pipeline",
    "deal",
    "contract",
    "pricing",
  ],
  leadership: [
    "strategy",
    "leadership",
    "approve",
    "approval",
    "priority",
    "budget",
    "kpi",
    "direction",
    "portfolio",
    "risk decision",
  ],
};

export interface AgentRouteDecision {
  agent: CherryAgentDefinition;
  score: number;
  reasons: string[];
}

export function getCherryAgent(
  id: CherryAgentId,
  team: readonly CherryAgentDefinition[] = CHERRY_AGENT_TEAM,
): CherryAgentDefinition {
  const agent = team.find((candidate) => candidate.id === id);
  if (!agent) throw new Error(`Unknown Cherry agent: ${id}`);
  return agent;
}

export function routeCherryTask(
  task: AgentTask,
  team: readonly CherryAgentDefinition[] = CHERRY_AGENT_TEAM,
): AgentRouteDecision {
  if (!task.objective.trim()) throw new Error("Task objective is required");

  const text = `${task.objective} ${(task.tags ?? []).join(" ")}`.toLowerCase();
  const requested = new Set((task.requiredCapabilities ?? []).map((value) => value.toLowerCase()));
  const risk = task.risk ?? "medium";

  const decisions = team.map((agent) => {
    let score = 0;
    const reasons: string[] = [];

    const capabilityMatches = agent.capabilities.filter((capability) => requested.has(capability.toLowerCase()));
    if (capabilityMatches.length > 0) {
      score += capabilityMatches.length * 12;
      reasons.push(`capabilities: ${capabilityMatches.join(", ")}`);
    }

    const keywordMatches = KEYWORDS[agent.layer].filter((keyword) => text.includes(keyword));
    if (keywordMatches.length > 0) {
      score += keywordMatches.length * 4;
      reasons.push(`keywords: ${keywordMatches.join(", ")}`);
    }

    if ((task.attachments?.length ?? 0) > 0 && agent.capabilities.includes("vision-analysis")) {
      score += 6;
      reasons.push("vision attachment");
    }

    if ((risk === "high" || risk === "critical") && agent.layer === "leadership") {
      score += risk === "critical" ? 24 : 14;
      reasons.push(`${risk}-risk governance`);
    }

    if (risk === "low" && agent.layer === "leadership" && keywordMatches.length === 0) score -= 5;
    if (agent.layer === "delivery" && score === 0) score += 1;

    return { agent, score, reasons };
  });

  decisions.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.agent.id.localeCompare(right.agent.id);
  });

  const selected = decisions[0];
  if (!selected) throw new Error("Cherry Agent Team is empty");
  return selected;
}

export type TeamPlanPhase = "preflight" | "execute" | "approve";

export interface TeamPlanStep {
  phase: TeamPlanPhase;
  agent: CherryAgentDefinition;
  instruction: string;
}

export interface CherryTeamPlan {
  taskId: string;
  primaryAgent: CherryAgentDefinition;
  route: AgentRouteDecision;
  steps: TeamPlanStep[];
}

export function createCherryTeamPlan(
  task: AgentTask,
  team: readonly CherryAgentDefinition[] = CHERRY_AGENT_TEAM,
): CherryTeamPlan {
  const route = routeCherryTask(task, team);
  const risk = task.risk ?? "medium";
  const steps: TeamPlanStep[] = [];
  const needsAdmin =
    task.requiresAdminPreflight === true ||
    risk === "high" ||
    risk === "critical" ||
    (task.tags ?? []).some((tag) => ["access", "credential", "production"].includes(tag.toLowerCase()));

  if (needsAdmin && route.agent.id !== "cherry-admin") {
    steps.push({
      phase: "preflight",
      agent: getCherryAgent("cherry-admin", team),
      instruction: "Validate access, tool policy, audit requirements, and rollback readiness before execution.",
    });
  }

  steps.push({
    phase: "execute",
    agent: route.agent,
    instruction: `Own the task outcome: ${task.objective}`,
  });

  const needsLeadershipApproval =
    (risk === "high" || risk === "critical") && route.agent.id !== "cherry-leadership";

  if (needsLeadershipApproval) {
    steps.push({
      phase: "approve",
      agent: getCherryAgent("cherry-leadership", team),
      instruction: "Review evidence, risk, business impact, and approve or reject the proposed action.",
    });
  }

  return { taskId: task.id, primaryAgent: route.agent, route, steps };
}

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentModelTurn {
  content?: string;
  toolCalls?: AgentToolCall[];
}

export interface AgentModel {
  complete(input: {
    agent: CherryAgentDefinition;
    messages: AgentMessage[];
    tools: AgentToolDescriptor[];
  }): Promise<AgentModelTurn>;
}

export interface AgentToolDescriptor {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface AgentTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  allowedAgents?: CherryAgentId[];
  risk?: TaskRisk;
  approvalKey?: string;
  validate?: (arguments_: Record<string, unknown>) => void;
  execute: (
    arguments_: Record<string, unknown>,
    context: { agent: CherryAgentDefinition; task: AgentTask; step: number },
  ) => Promise<unknown> | unknown;
}

export interface AgentLoopEvent {
  type: "start" | "model" | "tool-call" | "tool-result" | "complete" | "limit";
  agentId: CherryAgentId;
  step: number;
  detail?: Record<string, unknown>;
}

export interface ExecuteAgentTaskOptions {
  agent: CherryAgentDefinition;
  task: AgentTask;
  model: AgentModel;
  tools?: AgentTool[];
  approvals?: string[];
  maxSteps?: number;
  onEvent?: (event: AgentLoopEvent) => void | Promise<void>;
}

export interface AgentExecutionResult {
  agentId: CherryAgentId;
  taskId: string;
  output: string;
  steps: number;
  messages: AgentMessage[];
}

export class AgentLoopLimitError extends Error {
  constructor(public readonly maxSteps: number) {
    super(`Cherry agent reached the maximum of ${maxSteps} steps without a final response`);
    this.name = "AgentLoopLimitError";
  }
}

export function buildCherrySystemPrompt(agent: CherryAgentDefinition): string {
  return [
    `You are ${agent.name}, part of the Cherry Agent Team.`,
    `Mission: ${agent.mission}`,
    `Capabilities: ${agent.capabilities.join(", ")}.`,
    "Work in an observe -> decide -> tool -> verify loop.",
    "Use tools only when needed, inspect tool results, and stop when the requested outcome is complete.",
    "Never claim a tool action succeeded unless a successful tool result is present.",
    "Request approval for high-risk, destructive, financial, credential, production, or irreversible actions.",
    "Return a concise final result with evidence, remaining risk, and next operational action.",
  ].join("\n");
}

export async function executeCherryAgentTask(options: ExecuteAgentTaskOptions): Promise<AgentExecutionResult> {
  const tools = options.tools ?? [];
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
  const approvals = new Set(options.approvals ?? []);
  const maxSteps = options.maxSteps ?? options.agent.maxSteps;
  const messages: AgentMessage[] = [
    { role: "system", content: buildCherrySystemPrompt(options.agent) },
    {
      role: "user",
      content: JSON.stringify({
        task: options.task.objective,
        risk: options.task.risk ?? "medium",
        requiredCapabilities: options.task.requiredCapabilities ?? [],
        attachments: options.task.attachments ?? [],
        metadata: options.task.metadata ?? {},
      }),
    },
  ];

  const emit = async (event: AgentLoopEvent) => options.onEvent?.(event);
  await emit({ type: "start", agentId: options.agent.id, step: 0, detail: { taskId: options.task.id } });

  const descriptors = tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));

  for (let step = 1; step <= maxSteps; step += 1) {
    const turn = await options.model.complete({ agent: options.agent, messages: structuredClone(messages), tools: descriptors });
    await emit({
      type: "model",
      agentId: options.agent.id,
      step,
      detail: { toolCalls: turn.toolCalls?.map((call) => call.name) ?? [] },
    });

    if (turn.content) messages.push({ role: "assistant", content: turn.content });
    const calls = turn.toolCalls ?? [];

    if (calls.length === 0) {
      const output = turn.content?.trim();
      if (!output) throw new Error("Agent model returned neither content nor tool calls");
      await emit({ type: "complete", agentId: options.agent.id, step, detail: { output } });
      return { agentId: options.agent.id, taskId: options.task.id, output, steps: step, messages };
    }

    for (const call of calls) {
      const tool = toolMap.get(call.name);
      await emit({ type: "tool-call", agentId: options.agent.id, step, detail: { name: call.name, id: call.id } });

      let result: unknown;
      let ok = true;

      try {
        if (!tool) throw new Error(`Unknown tool: ${call.name}`);
        if (tool.allowedAgents && !tool.allowedAgents.includes(options.agent.id)) {
          throw new Error(`${options.agent.id} is not allowed to use ${tool.name}`);
        }

        const approvalKey = tool.approvalKey ?? `${options.agent.id}:${tool.name}`;
        if ((tool.risk === "high" || tool.risk === "critical") && !approvals.has(approvalKey)) {
          throw new Error(`Approval required: ${approvalKey}`);
        }

        tool.validate?.(call.arguments);
        result = await tool.execute(call.arguments, { agent: options.agent, task: options.task, step });
      } catch (error) {
        ok = false;
        result = { error: error instanceof Error ? error.message : "Tool execution failed" };
      }

      messages.push({
        role: "tool",
        name: call.name,
        toolCallId: call.id,
        content: JSON.stringify({ ok, result }),
      });

      await emit({ type: "tool-result", agentId: options.agent.id, step, detail: { name: call.name, ok } });
    }
  }

  await emit({ type: "limit", agentId: options.agent.id, step: maxSteps });
  throw new AgentLoopLimitError(maxSteps);
}
