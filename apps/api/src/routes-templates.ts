import type { IncomingMessage, ServerResponse } from "node:http";
import { send } from "./http-utils.js";
import { listWorkflowTemplates } from "./workflows.js";

export async function handleTemplateRoutes(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<boolean> {
  if (request.method === "GET" && pathname === "/api/templates") {
    const templates = listWorkflowTemplates();
    send(response, 200, {
      templates,
      total: templates.length,
      featured: templates.filter((template) => template.featured).length,
      categories: [...new Set(templates.map((template) => template.category))].sort(),
    });
    return true;
  }
  return false;
}
