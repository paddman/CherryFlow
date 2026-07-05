import { pbkdf2 as pbkdf2Callback, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readJson, send } from "./http-utils.js";
import {
  countAuthUsers,
  createAuthSession,
  createAuthUser,
  deleteAuthSession,
  getAuthSessionByTokenHash,
  getAuthUserById,
  getAuthUserByUsername,
  listAuthUsers,
} from "./store.js";
import type { AuthRole, AuthUser } from "./types.js";

const pbkdf2 = promisify(pbkdf2Callback);
const cookieName = "cf_session";
const sessionDays = Number(process.env.CHERRYFLOW_SESSION_DAYS ?? 7);
const roleRank: Record<AuthRole, number> = { viewer: 1, editor: 2, admin: 3 };

function isSecureCookie(): boolean {
  return (process.env.CHERRYFLOW_WEB_ORIGIN ?? "").startsWith("https://");
}

function sessionCookie(value: string, maxAgeSeconds: number): string {
  const secure = isSecureCookie() ? "; Secure" : "";
  return `${cookieName}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure}`;
}

function parseCookies(header: string | string[] | undefined): Record<string, string> {
  const cookieHeader = Array.isArray(header) ? header.join("; ") : header ?? "";
  return Object.fromEntries(cookieHeader.split(";").map((part) => {
    const [key, ...rest] = part.trim().split("=");
    return [key, decodeURIComponent(rest.join("="))];
  }).filter(([key]) => key));
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derived = await pbkdf2(password, salt, 210_000, 32, "sha256");
  return `pbkdf2$210000$${salt}$${derived.toString("base64url")}`;
}

async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [algorithm, iterationsText, salt, expectedText] = passwordHash.split("$");
  if (algorithm !== "pbkdf2" || !iterationsText || !salt || !expectedText) return false;
  const derived = await pbkdf2(password, salt, Number(iterationsText), 32, "sha256");
  const expected = Buffer.from(expectedText, "base64url");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

async function ensureBootstrapAdmin(): Promise<void> {
  if (await countAuthUsers() > 0) return;
  const username = process.env.CHERRYFLOW_ADMIN_USER;
  const password = process.env.CHERRYFLOW_ADMIN_PASSWORD;
  if (!username || !password) return;
  await createAuthUser({
    id: crypto.randomUUID(),
    username,
    passwordHash: await hashPassword(password),
    role: "admin",
    createdAt: new Date().toISOString(),
  });
}

function publicUser(user: AuthUser) {
  return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt };
}

function isAuthRole(value: unknown): value is AuthRole {
  return value === "admin" || value === "editor" || value === "viewer";
}

export async function currentUser(request: IncomingMessage): Promise<AuthUser | undefined> {
  await ensureBootstrapAdmin();
  const token = parseCookies(request.headers.cookie)[cookieName];
  if (!token) return undefined;
  const session = await getAuthSessionByTokenHash(hashToken(token));
  if (!session) return undefined;
  return getAuthUserById(session.userId);
}

function requiredRoleFor(pathname: string, method: string): AuthRole | undefined {
  if (pathname === "/api/modules" || pathname === "/api/workflows") return "viewer";
  if (pathname === "/api/models" || pathname === "/api/worker-pools") return method === "GET" ? "viewer" : "editor";
  if (pathname === "/api/models/sync") return "editor";
  if (/^\/api\/workflows\/[^/]+$/.test(pathname)) return "viewer";
  if (/^\/api\/workflows\/[^/]+\/graph$/.test(pathname)) return "viewer";
  if (/^\/api\/workflows\/[^/]+\/canvas$/.test(pathname) && method === "GET") return "viewer";
  if (pathname.startsWith("/api/workflows/")) return "editor";
  if (pathname.startsWith("/api/agent")) return "editor";
  return undefined;
}

export async function authorizeManagementRequest(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<boolean> {
  const requiredRole = requiredRoleFor(pathname, request.method ?? "GET");
  if (!requiredRole) return true;
  const user = await currentUser(request);
  if (!user) {
    send(response, 401, { error: "Authentication required" });
    return false;
  }
  if (roleRank[user.role] < roleRank[requiredRole]) {
    send(response, 403, { error: "Insufficient role", requiredRole, role: user.role });
    return false;
  }
  return true;
}

export async function handleAuthRoutes(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<boolean> {
  if (!pathname.startsWith("/api/auth")) return false;
  await ensureBootstrapAdmin();

  if (request.method === "GET" && pathname === "/api/auth/session") {
    const user = await currentUser(request);
    send(response, 200, { authenticated: Boolean(user), user: user ? publicUser(user) : null });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/login") {
    const body = await readJson<{ username?: string; password?: string }>(request);
    const user = body.username ? await getAuthUserByUsername(body.username) : undefined;
    if (!user || !body.password || !await verifyPassword(body.password, user.passwordHash)) {
      send(response, 401, { error: "Invalid username or password" });
      return true;
    }
    const token = randomBytes(32).toString("base64url");
    const now = Date.now();
    await createAuthSession({
      id: crypto.randomUUID(),
      userId: user.id,
      tokenHash: hashToken(token),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + sessionDays * 24 * 60 * 60 * 1000).toISOString(),
    });
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": sessionCookie(token, sessionDays * 24 * 60 * 60),
    });
    response.end(JSON.stringify({ authenticated: true, user: publicUser(user) }));
    return true;
  }

  if (pathname === "/api/auth/users") {
    const user = await currentUser(request);
    if (!user) {
      send(response, 401, { error: "Authentication required" });
      return true;
    }
    if (user.role !== "admin") {
      send(response, 403, { error: "Admin role required" });
      return true;
    }
    if (request.method === "GET") {
      send(response, 200, { users: (await listAuthUsers()).map(publicUser) });
      return true;
    }
    if (request.method === "POST") {
      const body = await readJson<{ username?: string; password?: string; role?: AuthRole }>(request);
      if (!body.username?.trim() || !body.password || !isAuthRole(body.role)) {
        send(response, 400, { error: "username, password, and role are required" });
        return true;
      }
      const created = await createAuthUser({
        id: crypto.randomUUID(),
        username: body.username.trim(),
        passwordHash: await hashPassword(body.password),
        role: body.role,
        createdAt: new Date().toISOString(),
      });
      send(response, 201, { user: publicUser(created) });
      return true;
    }
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    const token = parseCookies(request.headers.cookie)[cookieName];
    if (token) await deleteAuthSession(hashToken(token));
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": sessionCookie("", 0),
    });
    response.end(JSON.stringify({ authenticated: false }));
    return true;
  }

  send(response, 404, { error: "Not found" });
  return true;
}
