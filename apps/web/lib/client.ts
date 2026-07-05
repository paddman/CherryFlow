const configuredServiceUrl = process.env.NEXT_PUBLIC_CHERRYFLOW_API_URL?.replace(/\/$/, "");

export const serviceUrl =
  configuredServiceUrl ??
  (typeof window === "undefined" ? "http://localhost:4000" : window.location.origin);

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${serviceUrl}${path}`, { credentials: "include", ...init });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Request failed with HTTP ${response.status}`);
  return payload;
}
