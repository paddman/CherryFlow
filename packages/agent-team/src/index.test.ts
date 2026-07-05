import assert from "node:assert/strict";
import test from "node:test";

import {
  createCherryTeamPlan,
  executeCherryAgentTask,
  getCherryAgent,
  routeCherryTask,
  type AgentModel,
  type AgentTool,
} from "./index.js";

test("routes infrastructure execution to Cherry Delivery", () => {
  const route = routeCherryTask({
    id: "task-1",
    objective: "Deploy the workflow and fix the production server incident",
    risk: "medium",
  });

  assert.equal(route.agent.id, "cherry-delivery");
  assert.ok(route.score > 0);
});

test("routes CRM proposals to Cherry Sales", () => {
  const route = routeCherryTask({
    id: "task-2",
    objective: "Qualify this lead in CRM, prepare a proposal, and schedule customer follow-up",
    risk: "low",
  });

  assert.equal(route.agent.id, "cherry-sales");
});

test("routes high-risk strategic approvals to Cherry Leadership", () => {
  const route = routeCherryTask({
    id: "task-3",
    objective: "Approve the annual budget strategy and KPI direction",
    risk: "high",
  });

  assert.equal(route.agent.id, "cherry-leadership");
});

test("creates admin preflight and leadership approval around high-risk delivery", () => {
  const plan = createCherryTeamPlan({
    id: "task-4",
    objective: "Deploy and verify the production server incident fix",
    risk: "high",
    tags: ["production"],
  });

  assert.equal(plan.primaryAgent.id, "cherry-delivery");
  assert.deepEqual(
    plan.steps.map((step) => [step.phase, step.agent.id]),
    [
      ["preflight", "cherry-admin"],
      ["execute", "cherry-delivery"],
      ["approve", "cherry-leadership"],
    ],
  );
});

test("runs model -> vision tool -> model completion loop", async () => {
  let modelCalls = 0;
  let toolCalls = 0;

  const model: AgentModel = {
    async complete({ messages }) {
      modelCalls += 1;
      if (!messages.some((message) => message.role === "tool")) {
        return {
          toolCalls: [
            {
              id: "vision-1",
              name: "inspect_image",
              arguments: { path: "ladder.png" },
            },
          ],
        };
      }
      return { content: "The image describes a five-layer business agent team." };
    },
  };

  const tools: AgentTool[] = [
    {
      name: "inspect_image",
      description: "Inspect an image and return observed labels",
      allowedAgents: ["cherry-delivery", "cherry-marketing"],
      execute(arguments_) {
        toolCalls += 1;
        assert.equal(arguments_.path, "ladder.png");
        return { labels: ["ADMIN", "DELIVERY", "MARKETING", "SALES", "LEADERSHIP"] };
      },
    },
  ];

  const result = await executeCherryAgentTask({
    agent: getCherryAgent("cherry-delivery"),
    task: {
      id: "task-5",
      objective: "Read the attached organization image",
      attachments: [{ type: "image", mimeType: "image/png", path: "ladder.png" }],
    },
    model,
    tools,
  });

  assert.equal(result.steps, 2);
  assert.equal(modelCalls, 2);
  assert.equal(toolCalls, 1);
  assert.match(result.output, /five-layer/i);
});

test("returns approval failure to the model instead of executing a high-risk tool", async () => {
  let executed = false;

  const model: AgentModel = {
    async complete({ messages }) {
      const toolMessage = messages.find((message) => message.role === "tool");
      if (!toolMessage) {
        return {
          toolCalls: [{ id: "prod-1", name: "restart_production", arguments: {} }],
        };
      }
      assert.match(toolMessage.content, /Approval required/);
      return { content: "Production restart was not executed because approval is missing." };
    },
  };

  const result = await executeCherryAgentTask({
    agent: getCherryAgent("cherry-delivery"),
    task: { id: "task-6", objective: "Restart production", risk: "high" },
    model,
    tools: [
      {
        name: "restart_production",
        description: "Restart production services",
        risk: "high",
        execute() {
          executed = true;
          return { restarted: true };
        },
      },
    ],
  });

  assert.equal(executed, false);
  assert.match(result.output, /not executed/i);
});
