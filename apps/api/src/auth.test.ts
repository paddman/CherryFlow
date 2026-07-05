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

async function withAuthServer(testFn: (baseUrl: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "cherryflow-auth-"));
  process.env.CHERRYFLOW_DATA_FILE = join(directory, "store.json");
  process.env.CHERRYFLOW_STORE = "json";
  delete process.env.DATABASE_URL;
  process.env.CHERRYFLOW_ADMIN_USER = "admin";
  process.env.CHERRYFLOW_ADMIN_PASSWORD = "admin-password";
  process.env.CHERRYFLOW_WEB_ORIGIN = "http://localhost:3000";

  const [{ handleAuthRoutes, authorizeManagementRequest }, { send }] = await Promise.all([
    import("./auth.js"),
    import("./http-utils.js"),
  ]);

  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (await handleAuthRoutes(request, response, url.pathname)) return;
    if (!await authorizeManagementRequest(request, response, url.pathname)) return;
    if (url.pathname === "/api/modules") {
      send(response, 200, { modules: [{ type: "core.input" }] });
      return;
    }
    if (url.pathname === "/api/workflows/report-generator/canvas/validate" && request.method === "POST") {
      send(response, 200, { validation: { valid: true } });
      return;
    }
    send(response, 404, { error: "not found" });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  try {
    await testFn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("auth routes bootstrap an admin, create a session, and clear it on logout", async () => {
  await withAuthServer(async (baseUrl) => {
    const blocked = await fetch(`${baseUrl}/api/modules`);
    assert.equal(blocked.status, 401);

    const failedLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "wrong" }),
    });
    assert.equal(failedLogin.status, 401);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin-password" }),
    });
    assert.equal(login.status, 200);
    const cookie = setCookie(login);
    assert.match(cookie, /cf_session=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);

    const session = await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie } });
    const sessionPayload = await session.json() as { authenticated: boolean; user: { id: string; username: string; role: string; createdAt: string } | null };
    assert.equal(sessionPayload.authenticated, true);
    assert.equal(sessionPayload.user?.username, "admin");
    assert.equal(sessionPayload.user?.role, "admin");
    assert.equal(typeof sessionPayload.user?.id, "string");
    assert.equal(typeof sessionPayload.user?.createdAt, "string");

    const allowed = await fetch(`${baseUrl}/api/modules`, { headers: { cookie } });
    assert.equal(allowed.status, 200);

    const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST", headers: { cookie } });
    assert.equal(logout.status, 200);
    assert.match(setCookie(logout), /Max-Age=0/);

    const blockedAgain = await fetch(`${baseUrl}/api/modules`, { headers: { cookie } });
    assert.equal(blockedAgain.status, 401);
  });
});

test("RBAC lets admins manage users and prevents viewers from write actions", async () => {
  await withAuthServer(async (baseUrl) => {
    const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin-password" }),
    });
    const adminCookie = setCookie(adminLogin);

    const createViewer = await fetch(`${baseUrl}/api/auth/users`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ username: "viewer", password: "viewer-password", role: "viewer" }),
    });
    assert.equal(createViewer.status, 201);
    assert.equal((await createViewer.json() as { user: { role: string } }).user.role, "viewer");

    const users = await fetch(`${baseUrl}/api/auth/users`, { headers: { cookie: adminCookie } });
    assert.equal(users.status, 200);
    assert.deepEqual((await users.json() as { users: Array<{ username: string; role: string }> }).users.map((user) => [user.username, user.role]), [
      ["admin", "admin"],
      ["viewer", "viewer"],
    ]);

    const viewerLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "viewer", password: "viewer-password" }),
    });
    const viewerCookie = setCookie(viewerLogin);

    const read = await fetch(`${baseUrl}/api/modules`, { headers: { cookie: viewerCookie } });
    assert.equal(read.status, 200);

    const write = await fetch(`${baseUrl}/api/workflows/report-generator/canvas/validate`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: viewerCookie },
      body: JSON.stringify({ nodes: [], edges: [] }),
    });
    assert.equal(write.status, 403);

    const manageUsers = await fetch(`${baseUrl}/api/auth/users`, { headers: { cookie: viewerCookie } });
    assert.equal(manageUsers.status, 403);
  });
});
