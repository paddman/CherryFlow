export interface AgentRequest {
  agentId: string;
  prompt: string;
  context?: Record<string, unknown>;
  idempotencyKey: string;
}

export interface AgentRunResult {
  runId: string;
  status: "queued" | "running" | "completed" | "failed";
  output?: unknown;
  error?: string;
}

export interface BridgeClientOptions {
  bridgeUrl: string;
  token: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export class OpenClawBridgeClient {
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;

  constructor(private readonly options: BridgeClientOptions) {
    this.pollIntervalMs = options.pollIntervalMs ?? 800;
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  async runAgent(request: AgentRequest): Promise<AgentRunResult> {
    const created = await this.request<AgentRunResult>("/api/agents/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": request.idempotencyKey,
      },
      body: JSON.stringify(request),
    });

    if (created.status === "completed" || created.status === "failed") return created;

    const startedAt = Date.now();
    while (Date.now() - startedAt < this.timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
      const current = await this.request<AgentRunResult>(`/api/agents/runs/${encodeURIComponent(created.runId)}`);
      if (current.status === "completed" || current.status === "failed") return current;
    }

    throw new Error(`OpenClaw bridge timed out after ${this.timeoutMs}ms`);
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set("x-openclaw-token", this.options.token);
    const response = await fetch(`${this.options.bridgeUrl.replace(/\/$/, "")}${path}`, { ...init, headers });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenClaw bridge failed with HTTP ${response.status}: ${detail.slice(0, 300)}`);
    }
    return (await response.json()) as T;
  }
}
