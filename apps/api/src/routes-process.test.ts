import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import test from "node:test";

function setCookie(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  return headers.getSetCookie?.()[0] ?? response.headers.get("set-cookie") ?? "";
}

test("process flows are persisted per authenticated user", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cherryflow-process-flows-"));
  process.env.CHERRYFLOW_DATA_FILE = join(directory, "store.json");
  process.env.CHERRYFLOW_STORE = "json";
  delete process.env.DATABASE_URL;
  process.env.CHERRYFLOW_ADMIN_USER = "admin";
  process.env.CHERRYFLOW_ADMIN_PASSWORD = "admin-password";
  process.env.CHERRYFLOW_WEB_ORIGIN = "http://localhost:3000";
  delete process.env.CHERRYFLOW_GOOGLE_CLIENT_ID;
  delete process.env.CHERRYFLOW_GOOGLE_CLIENT_SECRET;

  const [{ handleAuthRoutes, authorizeManagementRequest }, { handleProcessFlowRoutes }, { send }] = await Promise.all([
    import("./auth.js"),
    import("./routes-process.js"),
    import("./http-utils.js"),
  ]);

  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (await handleAuthRoutes(request, response, url.pathname)) return;
    if (!await authorizeManagementRequest(request, response, url.pathname)) return;
    if (await handleProcessFlowRoutes(request, response, url.pathname)) return;
    send(response, 404, { error: "not found" });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin-password" }),
    });
    const adminCookie = setCookie(adminLogin);

    const created = await fetch(`${baseUrl}/api/process-flows`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ title: "My approval flow", payload: { version: 2, nodes: [], edges: [] } }),
    });
    assert.equal(created.status, 201);
    const createdPayload = await created.json() as { flow: { id: string; title: string } };
    assert.equal(createdPayload.flow.title, "My approval flow");

    const listed = await fetch(`${baseUrl}/api/process-flows`, { headers: { cookie: adminCookie } });
    assert.equal(listed.status, 200);
    const listPayload = await listed.json() as { userId: string; flows: Array<{ id: string }> };
    assert.equal(typeof listPayload.userId, "string");
    assert.deepEqual(listPayload.flows.map((flow) => flow.id), [createdPayload.flow.id]);

    const createViewer = await fetch(`${baseUrl}/api/auth/users`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ username: "viewer", password: "viewer-password", role: "viewer" }),
    });
    assert.equal(createViewer.status, 201);
    const viewerLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "viewer", password: "viewer-password" }),
    });
    const viewerCookie = setCookie(viewerLogin);

    const viewerList = await fetch(`${baseUrl}/api/process-flows`, { headers: { cookie: viewerCookie } });
    assert.equal(viewerList.status, 200);
    assert.deepEqual((await viewerList.json() as { flows: unknown[] }).flows, []);

    const hidden = await fetch(`${baseUrl}/api/process-flows/${encodeURIComponent(createdPayload.flow.id)}`, { headers: { cookie: viewerCookie } });
    assert.equal(hidden.status, 404);

    const viewerWrite = await fetch(`${baseUrl}/api/process-flows`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: viewerCookie },
      body: JSON.stringify({ title: "Nope", payload: {} }),
    });
    assert.equal(viewerWrite.status, 403);

    const deleted = await fetch(`${baseUrl}/api/process-flows/${encodeURIComponent(createdPayload.flow.id)}`, {
      method: "DELETE",
      headers: { cookie: adminCookie },
    });
    assert.equal(deleted.status, 200);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
