import type { WorkflowOutput } from "@cherryflow/ui-schema";
import type { WorkflowDefinition } from "./types.js";
import { customerServiceTemplateSpecs } from "./workflow-template-specs/customer-service.js";
import { documentsTemplateSpecs } from "./workflow-template-specs/documents.js";
import { financeDataProjectTemplateSpecs } from "./workflow-template-specs/finance-data-project.js";
import { hrTemplateSpecs } from "./workflow-template-specs/hr.js";
import { itSecurityTemplateSpecs } from "./workflow-template-specs/it-security.js";
import { salesMarketingTemplateSpecs } from "./workflow-template-specs/sales-marketing.js";
import type { TaskTemplateSpec } from "./workflow-template-specs/shared.js";

const standardOutputs: WorkflowOutput[] = [
  { name: "result", label: "ผลงานฉบับเต็ม", type: "markdown" },
  { name: "summary", label: "สรุปสำหรับผู้บริหาร", type: "markdown" },
  { name: "checklist", label: "รายการตรวจทาน", type: "table" },
  { name: "nextSteps", label: "ขั้นตอนถัดไป", type: "markdown" },
  { name: "aiStatus", label: "สถานะการประมวลผล", type: "text" },
];

function makeTaskDefinition(spec: TaskTemplateSpec): WorkflowDefinition {
  const inputLabels = Object.fromEntries(spec.inputs.map((input) => [input.name, input.label]));
  return {
    contract: {
      id: spec.id,
      name: spec.name,
      description: spec.description,
      inputs: spec.inputs,
      outputs: standardOutputs,
    },
    graph: {
      version: "1.0",
      nodes: [
        { id: "input", moduleType: "core.input" },
        {
          id: "task",
          moduleType: "ai.task",
          config: {
            inputNode: "input",
            taskName: spec.name,
            role: spec.role,
            instructions: spec.instructions,
            inputLabels,
            ...(spec.fileField ? { fileField: spec.fileField } : {}),
          },
        },
        { id: "output", moduleType: "core.output", config: { sourceNode: "task" } },
      ],
      edges: [
        { from: "input", to: "task" },
        { from: "task", to: "output" },
      ],
      outputNodeId: "output",
    },
    template: {
      category: spec.category,
      icon: spec.icon,
      tags: spec.tags,
      featured: spec.featured,
      estimatedMinutes: spec.estimatedMinutes,
      requiresFile: spec.requiresFile,
      starterPrompt: spec.starterPrompt,
    },
  };
}

const specs: TaskTemplateSpec[] = [
  ...documentsTemplateSpecs,
  ...salesMarketingTemplateSpecs,
  ...hrTemplateSpecs,
  ...customerServiceTemplateSpecs,
  ...itSecurityTemplateSpecs,
  ...financeDataProjectTemplateSpecs,
];

export const taskWorkflowDefinitions: WorkflowDefinition[] = specs.map(makeTaskDefinition);
