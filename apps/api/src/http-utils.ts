import type { IncomingMessage, ServerResponse } from "node:http";

const maxBodyBytes = Number(process.env.CHERRYFLOW_MAX_BODY_MB ?? 8) * 1024 * 1024;

export function send(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

export async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBodyBytes) throw new Error(`Request body exceeds ${maxBodyBytes} bytes`);
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return (text ? JSON.parse(text) : {}) as T;
}

export function matchWorkflow(pathname: string, suffix = ""): RegExpMatchArray | null {
  return pathname.match(new RegExp(`^/api/workflows/([^/]+)${suffix}$`));
}
