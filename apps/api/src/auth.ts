import { pbkdf2 as pbkdf2Callback, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readJson, send } from "./http-utils.js";
import {
  countAuthUsers,
  createAuthSession,
  createAuthUser,
  deleteAuthSession,
  getAuthUserByEmail,
  getAuthUserByGoogleSub,
  getAuthSessionByTokenHash,
  getAuthUserById,
  getAuthUserByUsername,
  listAuthUsers,
  upsertGoogleAuthUser,
} from "./store.js";
import type { AuthRole, AuthUser } from "./types.js";

const pbkdf2 = promisify(pbkdf2Callback);
const cookieName = "cf_session";
const oauthStateCookieName = "cf_google_oauth_state";
const oauthReturnCookieName = "cf_google_oauth_return";
const oauthStateMaxAgeSeconds = 10 * 60;
const sessionDays = Number(process.env.CHERRYFLOW_SESSION_DAYS ?? 7);
const roleRank: Record<AuthRole, number> = { viewer: 1, editor: 2, admin: 3 };

function isSecureCookie(): boolean {
  return (process.env.CHERRYFLOW_WEB_ORIGIN ?? "").startsWith("https://");
}

function cookie(name: string, value: string, maxAgeSeconds: number, httpOnly = true): string {
  const secure = isSecureCookie() ? "; Secure" : "";
  const httpOnlyFlag = httpOnly ? "; HttpOnly" : "";
  return `${name}=${encodeURIComponent(value)}${httpOnlyFlag}; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure}`;
}

function sessionCookie(value: string, maxAgeSeconds: number): string {
  return cookie(cookieName, value, maxAgeSeconds);
}

function clearCookie(name: string): string {
  return cookie(name, "", 0);
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

interface GoogleProfile {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  picture?: unknown;
}

function googleConfig() {
  const apiOrigin = process.env.CHERRYFLOW_API_ORIGIN ?? "http://localhost:4000";
  const webOrigin = process.env.CHERRYFLOW_WEB_ORIGIN ?? "http://localhost:3000";
  return {
    clientId: process.env.CHERRYFLOW_GOOGLE_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.CHERRYFLOW_GOOGLE_CLIENT_SECRET?.trim() ?? "",
    redirectUri: process.env.CHERRYFLOW_GOOGLE_REDIRECT_URI?.trim() || `${apiOrigin.replace(/\/$/, "")}/api/auth/google/callback`,
    webOrigin: webOrigin.replace(/\/$/, ""),
  };
}

export function googleAuthEnabled(): boolean {
  const config = googleConfig();
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/process-builder";
  return value;
}

function redirectToWeb(returnTo: string, error?: string): string {
  const config = googleConfig();
  const target = new URL(safeReturnTo(returnTo), `${config.webOrigin}/`);
  if (error) target.searchParams.set("authError", error);
  return target.toString();
}

function stateMatches(expected: string | undefined, actual: string | null): boolean {
  if (!expected || !actual) return false;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

async function issueSession(user: AuthUser): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await createAuthSession({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash: hashToken(token),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + sessionDays * 24 * 60 * 60 * 1000).toISOString(),
  });
  return token;
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
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    authProvider: user.authProvider ?? "local",
  };
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
  if (pathname === "/api/process-flows") return method === "GET" ? "viewer" : "editor";
  if (/^\/api\/process-flows\/[^/]+$/.test(pathname)) return method === "GET" ? "viewer" : "editor";
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

async function fetchGoogleProfile(code: string): Promise<GoogleProfile> {
  const config = googleConfig();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  const tokenPayload = await tokenResponse.json() as Record<string, unknown>;
  const accessToken = typeof tokenPayload.access_token === "string" ? tokenPayload.access_token : "";
  if (!tokenResponse.ok || !accessToken) throw new Error("Google token exchange failed");

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const profile = await profileResponse.json() as GoogleProfile;
  if (!profileResponse.ok || typeof profile.sub !== "string" || typeof profile.email !== "string" || profile.email_verified !== true) {
    throw new Error("Google account email is not verified");
  }
  return profile;
}

async function findOrCreateGoogleUser(profile: GoogleProfile): Promise<AuthUser> {
  const googleSub = String(profile.sub);
  const email = String(profile.email).trim().toLowerCase();
  const displayName = typeof profile.name === "string" && profile.name.trim() ? profile.name.trim() : email;
  const current = await getAuthUserByGoogleSub(googleSub);
  if (current) {
    const refreshed: AuthUser = { ...current, email, displayName, googleSub, authProvider: "google" };
    if (typeof profile.picture === "string" && profile.picture) refreshed.avatarUrl = profile.picture;
    return upsertGoogleAuthUser(refreshed);
  }

  const emailUser = await getAuthUserByEmail(email);
  if (emailUser && emailUser.authProvider !== "google") {
    throw new Error("An account with this email already exists. Use the existing username and password first.");
  }

  const configuredRole = process.env.CHERRYFLOW_GOOGLE_DEFAULT_ROLE;
  const role: AuthRole = isAuthRole(configuredRole) ? configuredRole : "editor";
  const user: AuthUser = {
    id: crypto.randomUUID(),
    username: emailUser?.username ?? email,
    passwordHash: "",
    role: emailUser?.role ?? role,
    createdAt: emailUser?.createdAt ?? new Date().toISOString(),
    email,
    displayName,
    googleSub,
    authProvider: "google",
  };
  if (typeof profile.picture === "string" && profile.picture) user.avatarUrl = profile.picture;
  return upsertGoogleAuthUser(user);
}

async function handleGoogleStart(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  if (request.method !== "GET") return false;
  if (!googleAuthEnabled()) {
    send(response, 503, { error: "Google OAuth is not configured", required: ["CHERRYFLOW_GOOGLE_CLIENT_ID", "CHERRYFLOW_GOOGLE_CLIENT_SECRET"] });
    return true;
  }
  const config = googleConfig();
  const url = new URL(request.url ?? "/api/auth/google/start", "http://localhost");
  const state = randomBytes(24).toString("base64url");
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce: randomBytes(24).toString("base64url"),
    access_type: "online",
    prompt: "select_account",
  }).toString();
  response.writeHead(302, {
    location: authUrl.toString(),
    "set-cookie": [
      cookie(oauthStateCookieName, state, oauthStateMaxAgeSeconds),
      cookie(oauthReturnCookieName, safeReturnTo(url.searchParams.get("returnTo")), oauthStateMaxAgeSeconds),
    ],
  });
  response.end();
  return true;
}

async function handleGoogleCallback(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  if (request.method !== "GET") return false;
  const config = googleConfig();
  const url = new URL(request.url ?? "/api/auth/google/callback", "http://localhost");
  const cookies = parseCookies(request.headers.cookie);
  const returnTo = safeReturnTo(cookies[oauthReturnCookieName]);
  const cleanupCookies = [clearCookie(oauthStateCookieName), clearCookie(oauthReturnCookieName)];
  const fail = (message: string) => {
    response.writeHead(302, { location: redirectToWeb(returnTo, message), "set-cookie": cleanupCookies });
    response.end();
  };

  if (url.searchParams.get("error")) {
    fail("Google sign-in was cancelled");
    return true;
  }
  if (!stateMatches(cookies[oauthStateCookieName], url.searchParams.get("state"))) {
    fail("Google sign-in state is invalid or expired");
    return true;
  }
  const code = url.searchParams.get("code");
  if (!code || !googleAuthEnabled()) {
    fail("Google OAuth is not configured");
    return true;
  }

  try {
    const user = await findOrCreateGoogleUser(await fetchGoogleProfile(code));
    const token = await issueSession(user);
    response.writeHead(302, {
      location: redirectToWeb(returnTo),
      "set-cookie": [sessionCookie(token, sessionDays * 24 * 60 * 60), ...cleanupCookies],
    });
    response.end();
  } catch (error) {
    console.error("Google OAuth callback failed:", error instanceof Error ? error.message : error);
    fail("Google login failed. Please try again.");
  }
  return true;
}

export async function handleAuthRoutes(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<boolean> {
  if (!pathname.startsWith("/api/auth")) return false;
  await ensureBootstrapAdmin();

  if (pathname === "/api/auth/google/start") return handleGoogleStart(request, response);
  if (pathname === "/api/auth/google/callback") return handleGoogleCallback(request, response);

  if (request.method === "GET" && pathname === "/api/auth/session") {
    const user = await currentUser(request);
    send(response, 200, { authenticated: Boolean(user), user: user ? publicUser(user) : null, googleEnabled: googleAuthEnabled() });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/auth/login") {
    const body = await readJson<{ username?: string; password?: string }>(request);
    const user = body.username ? await getAuthUserByUsername(body.username) : undefined;
    if (!user || !body.password || !await verifyPassword(body.password, user.passwordHash)) {
      send(response, 401, { error: "Invalid username or password" });
      return true;
    }
    const token = await issueSession(user);
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": sessionCookie(token, sessionDays * 24 * 60 * 60),
    });
    response.end(JSON.stringify({ authenticated: true, user: publicUser(user), googleEnabled: googleAuthEnabled() }));
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
