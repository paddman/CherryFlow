import assert from "node:assert/strict";
import test from "node:test";
import type { WorkflowContract } from "@cherryflow/ui-schema";
import { normalizeSchema } from "./normalize-schema.js";

const workflow: WorkflowContract = {
  id: "report-generator",
  name: "AI Report Generator",
  description: "Upload a source file and generate a structured report package.",
  inputs: [{ name: "projectName", label: "Project", type: "text" }],
  outputs: [{ name: "summary", label: "Summary", type: "markdown" }],
};

test("recovers components when the model returns page as a bare array", () => {
  const raw = {
    meta: { name: "AI Report Generator" },
    page: [
      { id: "hero", type: "hero", title: "Welcome" },
      { id: "form", type: "workflow-form", fields: ["projectName"], submitLabel: "Go" },
      { id: "output", type: "workflow-output", bindings: ["summary"] },
    ],
  };
  const schema = normalizeSchema(raw, workflow, "prompt");
  assert.ok(schema.page.components.some((component) => component.type === "hero" && component.title === "Welcome"));
});

test("unwraps components nested in a props object", () => {
  const raw = {
    meta: { name: "AI Report Generator" },
    page: {
      components: [
        { id: "hero", component: "hero", props: { title: "Wrapped hero" } },
        { id: "form", type: "workflow-form", fields: ["projectName"], submitLabel: "Go" },
        { id: "output", type: "workflow-output", bindings: ["summary"] },
      ],
    },
  };
  const schema = normalizeSchema(raw, workflow, "prompt");
  const hero = schema.page.components.find((component) => component.type === "hero");
  assert.equal(hero && "title" in hero ? hero.title : undefined, "Wrapped hero");
});

test("aliases common theme key variants onto the canonical theme fields", () => {
  const raw = {
    meta: { name: "AI Report Generator" },
    theme: { primary: "#003366", background: "#f8f9fa", text: "#2b2d42" },
    page: {
      components: [
        { id: "form", type: "workflow-form", fields: ["projectName"], submitLabel: "Go" },
        { id: "output", type: "workflow-output", bindings: ["summary"] },
      ],
    },
  };
  const schema = normalizeSchema(raw, workflow, "prompt");
  assert.equal(schema.theme.primaryColor, "#003366");
  assert.equal(schema.theme.backgroundColor, "#f8f9fa");
  assert.equal(schema.theme.textColor, "#2b2d42");
});

test("still throws (so the caller can fall back) when the model returns an invalid theme color", () => {
  const raw = {
    meta: { name: "AI Report Generator" },
    theme: { primaryColor: "not-a-hex-color" },
    page: { components: [{ id: "form", type: "workflow-form", fields: ["projectName"], submitLabel: "Go" }, { id: "output", type: "workflow-output", bindings: ["summary"] }] },
  };
  assert.throws(() => normalizeSchema(raw, workflow, "prompt"));
});
