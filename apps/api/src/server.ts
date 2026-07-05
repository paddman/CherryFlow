import { createServer } from "node:http";
import { authorizeManagementRequest, handleAuthRoutes } from "./auth.js";
import { applyCors } from "./cors.js";
import { fileStorageEnabled } from "./file-storage.js";
import { send } from "./http-utils.js";
import { handleModelRegistryRoutes } from "./model-registry.js";
import { redisQueueEnabled } from "./redis-queue.js";
import { handleAgentRoutes } from "./routes-agent.js";
import { handleBuilderRoutes } from "./routes-builder.js";
import { handlePublishRoutes } from "./routes-publish.js";
import { handleRuntimeRoutes } from "./routes-runtime.js";
import { startRunWorker } from "./run-service.js";

const port = Number(process.env.CHERRYFLOW_API_PORT ?? 4000);
const host = process.env.CHERRYFLOW_API_HOST ?? "127.0.0.1";

createServer(async (request, response) => {
  if (applyCors(request, response)) return;

  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  try {
    if (request.method === "GET" && url.pathname === "/health") {
      send(response, 200, {
        status: "ok",
        service: "cherryflow-api",
        aiProvider: process.env.CHERRYFLOW_AI_PROVIDER ?? "local",
        store: (process.env.CHERRYFLOW_STORE ?? (process.env.DATABASE_URL ? "postgres" : "json")),
        runner: redisQueueEnabled() ? "redis" : "in_process",
        fileStorage: fileStorageEnabled() ? "s3" : "inline",
      });
      return;
    }
    if (await handleAuthRoutes(request, response, url.pathname)) return;
    if (!await authorizeManagementRequest(request, response, url.pathname)) return;
    if (await handleModelRegistryRoutes(request, response, url.pathname)) return;
    if (await handleAgentRoutes(request, response, url.pathname)) return;
    if (await handleBuilderRoutes(request, response, url.pathname)) return;
    if (await handlePublishRoutes(request, response, url.pathname)) return;
    if (await handleRuntimeRoutes(request, response, url.pathname)) return;
    send(response, 404, { error: "Not found" });
  } catch (error) {
    send(response, 500, { error: error instanceof Error ? error.message : "Unexpected error" });
  }
}).listen(port, host, () => startRunWorker());
