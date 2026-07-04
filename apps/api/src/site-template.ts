import type { UiComponent, WorkflowContract } from "@cherryflow/ui-schema";

export function createWebsiteComponents(workflow: WorkflowContract, title: string): UiComponent[] {
  return [
    {
      id: "navbar",
      type: "navbar",
      brand: title,
      tagline: "Powered by CherryFlow",
      items: [
        { label: "Features", target: "#features" },
        { label: "Start", target: "#form" },
        { label: "FAQ", target: "#faq" }
      ]
    },
    { id: "hero", type: "hero", badge: "AI WORKFLOW WEBSITE", title, description: workflow.description, align: "center" },
    {
      id: "stats",
      type: "stats",
      items: [
        { value: String(workflow.inputs.length), label: "Inputs", detail: "Generated fields" },
        { value: String(workflow.outputs.length), label: "Outputs", detail: "Rendered results" },
        { value: "1", label: "Published page", detail: "Ready to share" }
      ]
    },
    {
      id: "features",
      type: "feature-grid",
      title: "Workflow website",
      columns: 3,
      items: [
        { title: "Collect", description: "Use contract-based fields and file inputs." },
        { title: "Process", description: "Run the workflow graph and show progress." },
        { title: "Deliver", description: "Display text, tables, and downloadable files." }
      ]
    },
    {
      id: "steps",
      type: "steps",
      title: "How it works",
      items: [
        { title: "Enter data", description: "Complete the required fields." },
        { title: "Run", description: "CherryFlow executes each module." },
        { title: "Receive output", description: "View and download the results." }
      ]
    },
    { id: "form", type: "workflow-form", title: "Start", description: "Complete the form to run this workflow.", fields: workflow.inputs.map((input) => input.name), submitLabel: "Run workflow" },
    { id: "progress", type: "job-progress", title: "Status" },
    { id: "output", type: "workflow-output", title: "Results", bindings: workflow.outputs.map((output) => output.name), emptyText: "Results will appear here." },
    {
      id: "faq",
      type: "faq",
      title: "FAQ",
      items: [
        { question: "Can this page be changed?", answer: "Use another prompt, save a version, or restore an older version." },
        { question: "How is the page rendered?", answer: "CherryFlow renders validated UI components from the saved schema." }
      ]
    },
    { id: "cta", type: "cta", title: "Ready to begin?", body: "Use the form above to start the workflow.", buttonLabel: "Start" },
    { id: "footer", type: "footer", brand: title, description: "Generated with CherryFlow", copyright: "CherryFlow" }
  ];
}
