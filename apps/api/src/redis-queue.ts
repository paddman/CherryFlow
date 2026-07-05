import { createClient, type RedisClientType } from "redis";

const queueName = process.env.REDIS_QUEUE_NAME || "cherryflow:runs";
let clientPromise: Promise<RedisClientType> | undefined;
let workerStarted = false;

function redisUrl(): string {
  return process.env.REDIS_URL || "redis://127.0.0.1:6379";
}

export function redisQueueEnabled(): boolean {
  return (process.env.CHERRYFLOW_RUNNER ?? "").toLowerCase() === "redis" || Boolean(process.env.REDIS_URL);
}

async function redisClient(): Promise<RedisClientType> {
  clientPromise ??= (async () => {
    const client = createClient({ url: redisUrl() });
    client.on("error", (error) => console.error("[redis]", error));
    await client.connect();
    return client as RedisClientType;
  })();
  return clientPromise;
}

export async function enqueueRun(runId: string): Promise<void> {
  const client = await redisClient();
  await client.sendCommand(["LPUSH", queueName, runId]);
}

export function startRunWorker(processRun: (runId: string) => Promise<void>): void {
  if (!redisQueueEnabled() || workerStarted) return;
  workerStarted = true;
  void (async () => {
    const client = createClient({ url: redisUrl() });
    client.on("error", (error) => console.error("[redis-worker]", error));
    await client.connect();
    console.info(`[redis-worker] listening on ${queueName}`);
    while (true) {
      try {
        const result = await client.sendCommand(["BRPOP", queueName, "5"]) as [string, string] | null;
        const runId = result?.[1];
        if (!runId) continue;
        await processRun(runId);
      } catch (error) {
        console.error("[redis-worker] failed to process run", error);
      }
    }
  })().catch((error) => {
    workerStarted = false;
    console.error("[redis-worker] stopped", error);
  });
}
