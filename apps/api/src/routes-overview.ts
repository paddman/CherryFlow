import type { IncomingMessage, ServerResponse } from "node:http";
import { send } from "./http-utils.js";
import { getOperationalOverview } from "./overview.js";

export async function handleOverviewRoutes(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (request.method !== "GET" || pathname !== "/api/overview") return false;
  send(response, 200, await getOperationalOverview());
  return true;
}
