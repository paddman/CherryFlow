"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { requestJson, serviceUrl } from "../lib/client";

type AuthUser = {
  id: string;
  username: string;
  role: "admin" | "editor" | "viewer";
  createdAt: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  authProvider?: "local" | "google";
};
type SessionPayload = { authenticated: boolean; user: AuthUser | null; googleEnabled?: boolean };

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [username, setUsername] = useState("cherryflow-admin");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get("authError");
    if (authError) setError(authError);
    requestJson<SessionPayload>("/api/auth/session")
      .then(setSession)
      .catch(() => setSession({ authenticated: false, user: null, googleEnabled: false }));
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setSession(await requestJson<SessionPayload>("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      }));
      setPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await requestJson("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setSession({ authenticated: false, user: null, googleEnabled: session?.googleEnabled ?? false });
  }

  function loginWithGoogle() {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`${serviceUrl}/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`);
  }

  if (!session) return <main className="authShell"><section className="authCard"><p>กำลังตรวจ session...</p></section></main>;
  if (!session.authenticated) {
    return (
      <main className="authShell">
        <form className="authCard" onSubmit={login}>
          <span className="brandMark">C</span>
          <p className="sectionLabel">CHERRYFLOW RBAC</p>
          <h1>เข้าสู่ระบบจัดการ</h1>
          <p className="panelLead">Homepage และ published apps ยัง public; Builder, Canvas และ management API ต้องมี session role.</p>
          <label className="controlLabel" htmlFor="auth-username">Username</label>
          <input id="auth-username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          <label className="controlLabel" htmlFor="auth-password">Password</label>
          <input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          <button className="primaryButton wide" disabled={busy || !username || !password}>{busy ? "กำลังเข้าสู่ระบบ..." : "Login"}</button>
          {session.googleEnabled && (
            <>
              <div className="authDivider"><span>หรือ</span></div>
              <button className="googleButton" type="button" onClick={loginWithGoogle} disabled={busy}>
                <span className="googleIcon" aria-hidden="true">G</span>
                Continue with Google
              </button>
              <small className="authHint">Google account จะถูกสร้างเป็นผู้ใช้ CherryFlow อัตโนมัติ และเริ่มต้นด้วย role editor</small>
            </>
          )}
          {error && <p className="panelMessage error">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <>
      <div className="sessionBar">
        {session.user?.avatarUrl && <img src={session.user.avatarUrl} alt="" />}
        <span>{session.user?.displayName ?? session.user?.email ?? session.user?.username} · {session.user?.role}</span>
        <button type="button" onClick={logout}>Logout</button>
      </div>
      {children}
    </>
  );
}
