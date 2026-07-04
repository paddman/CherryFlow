import { createServer } from "node:http";
import { applyCors } from "./cors.js";
import { send } from "./http-utils.js";
import { handleAgentRoutes } from "./routes-agent.js";
import { handleBuilderRoutes } from "./routes-builder.js";
import { handlePublishRoutes } from "./routes-publish.js";
import { handleRuntimeRoutes } from "./routes-runtime.js";
import { getStoreHealth } from "./store.js";

const port = Number(process.env.CHERRYFLOW_API_PORT ?? 4000);

createServer(async (request, response) => {
  if (applyCors(request, response)) return;

  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  try {
    if (request.method === "GET" && url.pathname === "/health") {
      const storage = await getStoreHealth();
      const healthy = storage.status === "ok";
      send(response, healthy ? 200 : 503, {
        status: healthy ? "ok" : "degraded",
        service: "cherryflow-api",
        aiProvider: process.env.CHERRYFLOW_AI_PROVIDER ?? "local",
        storage,
      });
      return;
    }
    if (await handleAgentRoutes(request, response, url.pathname)) return;
    if (await handleBuilderRoutes(request, response, url.pathname)) return;
    if (await handlePublishRoutes(request, response, url.pathname)) return;
    if (await handleRuntimeRoutes(request, response, url.pathname)) return;
    send(response, 404, { error: "Not found" });
  } catch (error) {
    send(response, 500, { error: error instanceof Error ? error.message : "Unexpected error" });
  }
}).listen(port);
