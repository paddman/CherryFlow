export interface OpenClawRequest {
  agentId: string;
  prompt: string;
  context?: Record<string, unknown>;
  idempotencyKey: string;
}

export interface OpenClawRunResult {
  runId: string;
  status: "queued" | "running" | "completed" | "failed";
  output?: unknown;
  error?: string;
}

export class OpenClawClient {
  constructor(
    private readonly gatewayUrl: string,
    private readonly apiToken: string,
  ) {}

  async runAgent(request: OpenClawRequest): Promise<OpenClawRunResult> {
    const response = await fetch(`${this.gatewayUrl}/api/agents/run`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiToken}`,
        "content-type": "application/json",
        "idempotency-key": request.idempotencyKey,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`OpenClaw request failed with HTTP ${response.status}`);
    }

    return (await response.json()) as OpenClawRunResult;
  }
}
