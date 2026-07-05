import type { IncomingMessage, ServerResponse } from "node:http";

const allowedOrigin = process.env.CHERRYFLOW_WEB_ORIGIN ?? "http://localhost:3000";

export function applyCors(request: IncomingMessage, response: ServerResponse): boolean {
  response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return true;
  }

  return false;
}
