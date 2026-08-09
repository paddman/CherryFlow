import { randomUUID } from "node:crypto";
import type { ModuleContext, ModuleDefinition, WorkflowData } from "@cherryflow/workflow-engine";

export type NotificationProvider = "telegram" | "discord" | "line";
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type DeliveryStatus = "sent" | "dry-run" | "failed";

interface NotificationRequest {
  title: string;
  message: string;
  severity: string;
  silent: boolean;
  dryRun: boolean;
  confirmSend: boolean;
  telegramChatId?: string;
  lineTo?: string;
}

interface DeliveryResult {
  provider: NotificationProvider;
  status: DeliveryStatus;
  destination: string;
  chunks: number;
  detail: string;
}

export type NotificationOutput = WorkflowData & {
  result: string;
  summary: string;
  checklist: Array<Record<string, string>>;
  nextSteps: string;
  aiStatus: string;
};

const MAX_SOURCE_MESSAGE = 20_000;
const TELEGRAM_CHUNK = 4_096;
const DISCORD_CHUNK = 2_000;
const LINE_CHUNK = 5_000;
const MAX_TELEGRAM_CHUNKS = 10;
const MAX_DISCORD_CHUNKS = 10;
const MAX_LINE_CHUNKS = 5;

function dependency(dependencies: Record<string, WorkflowData>, nodeId: string): WorkflowData {
  const value = dependencies[nodeId];
  if (!value) throw new Error(`Missing dependency output: ${nodeId}`);
  return value;
}

function cleanText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function booleanValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on", "enabled", "ยืนยัน", "ใช่"].includes(value.trim().toLowerCase());
}

function envFlag(env: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
  const value = env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (["1", "true", "yes", "on", "enabled"].includes(value)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(value)) return false;
  return fallback;
}

function timeoutMs(env: NodeJS.ProcessEnv): number {
  const value = Number(env.CHERRYFLOW_NOTIFICATION_TIMEOUT_MS ?? 15_000);
  return Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 1_000), 120_000) : 15_000;
}

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function allowCustomEndpoints(env: NodeJS.ProcessEnv): boolean {
  return envFlag(env, "CHERRYFLOW_ALLOW_CUSTOM_CONNECTOR_ENDPOINTS", false);
}

function validateBaseUrl(raw: string, officialHost: string, env: NodeJS.ProcessEnv, label: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} endpoint is not a valid URL`);
  }

  if (url.username || url.password) throw new Error(`${label} endpoint must not contain URL credentials`);
  if (url.hostname === officialHost) {
    if (url.protocol !== "https:") throw new Error(`${label} official endpoint must use HTTPS`);
    return url;
  }

  if (!allowCustomEndpoints(env)) {
    throw new Error(`${label} custom endpoint is blocked; set CHERRYFLOW_ALLOW_CUSTOM_CONNECTOR_ENDPOINTS=true only for a trusted proxy`);
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback(url.hostname))) {
    throw new Error(`${label} custom endpoint must use HTTPS or a loopback HTTP address`);
  }
  return url;
}

function validateDiscordWebhook(raw: string, env: NodeJS.ProcessEnv): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Discord webhook is not a valid URL");
  }

  const officialHost = url.hostname === "discord.com" || url.hostname.endsWith(".discord.com") || url.hostname === "discordapp.com";
  const officialPath = /^\/api(?:\/v\d+)?\/webhooks\/[^/]+\/[^/]+/.test(url.pathname);
  if (officialHost && officialPath && url.protocol === "https:") return url;

  if (!allowCustomEndpoints(env)) {
    throw new Error("Discord webhook must be an official HTTPS webhook URL unless trusted custom endpoints are explicitly enabled");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback(url.hostname))) {
    throw new Error("Discord custom webhook must use HTTPS or a loopback HTTP address");
  }
  return url;
}

function redact(message: string, secrets: Array<string | undefined>): string {
  let output = message;
  for (const secret of secrets) {
    if (secret) output = output.split(secret).join("[redacted]");
  }
  return output.replace(/https?:\/\/[^\s]+\/api\/webhooks\/[^\s]+/gi, "[redacted-discord-webhook]");
}

function maskDestination(value: string | undefined, label: string): string {
  const clean = value?.trim();
  if (!clean) return `${label} (not configured)`;
  if (clean.length <= 6) return `${label} ***`;
  return `${label} …${clean.slice(-4)}`;
}

function chunkText(text: string, limit: number, maxChunks: number, provider: string): string[] {
  if (!text.trim()) throw new Error("Notification message is required");
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (chunks.length >= maxChunks) {
      throw new Error(`${provider} message is too long; maximum is ${limit * maxChunks} characters per workflow run`);
    }
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }

    let splitAt = remaining.lastIndexOf("\n", limit);
    if (splitAt < Math.floor(limit * 0.55)) splitAt = remaining.lastIndexOf(" ", limit);
    if (splitAt < Math.floor(limit * 0.55)) splitAt = limit;
    if (/^[\uDC00-\uDFFF]$/.test(remaining.charAt(splitAt))) splitAt -= 1;
    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }
  return chunks;
}

function sourceData(context: ModuleContext): WorkflowData {
  const sourceNode = cleanText(context.config.sourceNode);
  if (sourceNode) return dependency(context.dependencies, sourceNode);
  return dependency(context.dependencies, cleanText(context.config.inputNode, "input"));
}

function notificationRequest(context: ModuleContext, env: NodeJS.ProcessEnv): NotificationRequest {
  const source = sourceData(context);
  const titleField = cleanText(context.config.titleField, "title");
  const messageField = cleanText(context.config.messageField, "message");
  const severityField = cleanText(context.config.severityField, "severity");
  const fallbackMessage = cleanText(source.summary) || cleanText(source.result);
  const title = cleanText(source[titleField], cleanText(context.config.defaultTitle, "CherryFlow Notification"));
  const message = cleanText(source[messageField], fallbackMessage).slice(0, MAX_SOURCE_MESSAGE);
  const severity = cleanText(source[severityField], cleanText(context.config.defaultSeverity, "info")).toUpperCase();
  const globalDryRun = envFlag(env, "CHERRYFLOW_NOTIFICATION_DRY_RUN", true);
  const inputDryRun = booleanValue(source.dryRun);

  return {
    title,
    message,
    severity,
    silent: booleanValue(source.silent),
    dryRun: globalDryRun || inputDryRun,
    confirmSend: booleanValue(source.confirmSend),
    ...(cleanText(source.telegramChatId || source.chatId) ? { telegramChatId: cleanText(source.telegramChatId || source.chatId) } : {}),
    ...(cleanText(source.lineTo || source.to) ? { lineTo: cleanText(source.lineTo || source.to) } : {}),
  };
}

function formattedMessage(request: NotificationRequest): string {
  return [`[${request.severity}]`, request.title, "", request.message].filter(Boolean).join("\n").trim();
}

async function requestJson(
  url: URL,
  init: RequestInit,
  env: NodeJS.ProcessEnv,
  secrets: Array<string | undefined>,
  fetcher: Fetcher,
): Promise<{ status: number; payload: unknown; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs(env));
  try {
    const response = await fetcher(url, { ...init, signal: controller.signal });
    const text = (await response.text()).slice(0, 8_000);
    let payload: unknown = undefined;
    if (text) {
      try { payload = JSON.parse(text) as unknown; } catch { payload = undefined; }
    }
    if (!response.ok) {
      const record = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
      const detail = cleanText(record.description ?? record.message ?? record.error, text.slice(0, 240));
      throw new Error(`Provider returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    return { status: response.status, payload, text };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification request failed";
    throw new Error(redact(message, secrets));
  } finally {
    clearTimeout(timer);
  }
}

async function sendTelegram(request: NotificationRequest, env: NodeJS.ProcessEnv, fetcher: Fetcher): Promise<DeliveryResult> {
  const chatId = request.telegramChatId ?? env.TELEGRAM_CHAT_ID?.trim();
  const destination = maskDestination(chatId, "Telegram chat");
  const chunks = chunkText(formattedMessage(request), TELEGRAM_CHUNK, MAX_TELEGRAM_CHUNKS, "Telegram");
  if (request.dryRun) return { provider: "telegram", status: "dry-run", destination, chunks: chunks.length, detail: "Validated without calling Telegram" };

  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");
  if (!chatId) throw new Error("Telegram chat ID is required through TELEGRAM_CHAT_ID or the workflow input");
  const base = validateBaseUrl(env.TELEGRAM_API_BASE_URL?.trim() || "https://api.telegram.org", "api.telegram.org", env, "Telegram");
  const endpoint = new URL(`${base.toString().replace(/\/$/, "")}/bot${token}/sendMessage`);
  const messageIds: string[] = [];

  for (const text of chunks) {
    const response = await requestJson(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_notification: request.silent,
        link_preview_options: { is_disabled: true },
      }),
    }, env, [token], fetcher);
    const record = response.payload && typeof response.payload === "object" && !Array.isArray(response.payload)
      ? response.payload as Record<string, unknown>
      : {};
    if (record.ok === false) throw new Error(redact(`Telegram rejected the message: ${cleanText(record.description, "unknown error")}`, [token]));
    const result = record.result && typeof record.result === "object" && !Array.isArray(record.result)
      ? record.result as Record<string, unknown>
      : {};
    if (result.message_id !== undefined) messageIds.push(String(result.message_id));
  }

  return {
    provider: "telegram",
    status: "sent",
    destination,
    chunks: chunks.length,
    detail: messageIds.length > 0 ? `message IDs ${messageIds.join(", ")}` : "Telegram accepted the message",
  };
}

async function sendDiscord(request: NotificationRequest, env: NodeJS.ProcessEnv, fetcher: Fetcher): Promise<DeliveryResult> {
  const webhook = env.DISCORD_WEBHOOK_URL?.trim();
  const destination = webhook ? "Discord webhook (configured)" : "Discord webhook (not configured)";
  const chunks = chunkText(formattedMessage(request), DISCORD_CHUNK, MAX_DISCORD_CHUNKS, "Discord");
  if (request.dryRun) return { provider: "discord", status: "dry-run", destination, chunks: chunks.length, detail: "Validated without calling Discord" };
  if (!webhook) throw new Error("DISCORD_WEBHOOK_URL is required");

  const endpoint = validateDiscordWebhook(webhook, env);
  endpoint.searchParams.set("wait", "true");
  const messageIds: string[] = [];
  for (const content of chunks) {
    const response = await requestJson(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content,
        ...(env.DISCORD_USERNAME?.trim() ? { username: env.DISCORD_USERNAME.trim() } : {}),
        allowed_mentions: { parse: [] },
      }),
    }, env, [webhook], fetcher);
    const record = response.payload && typeof response.payload === "object" && !Array.isArray(response.payload)
      ? response.payload as Record<string, unknown>
      : {};
    if (record.id !== undefined) messageIds.push(String(record.id));
  }

  return {
    provider: "discord",
    status: "sent",
    destination,
    chunks: chunks.length,
    detail: messageIds.length > 0 ? `message IDs ${messageIds.join(", ")}` : "Discord accepted the message",
  };
}

async function sendLine(request: NotificationRequest, env: NodeJS.ProcessEnv, fetcher: Fetcher): Promise<DeliveryResult> {
  const to = request.lineTo ?? env.LINE_TO?.trim();
  const destination = maskDestination(to, "LINE target");
  const chunks = chunkText(formattedMessage(request), LINE_CHUNK, MAX_LINE_CHUNKS, "LINE");
  if (request.dryRun) return { provider: "line", status: "dry-run", destination, chunks: chunks.length, detail: "Validated without calling LINE" };

  const token = env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is required");
  if (!to) throw new Error("LINE target is required through LINE_TO or the workflow input");
  const base = validateBaseUrl(env.LINE_API_BASE_URL?.trim() || "https://api.line.me", "api.line.me", env, "LINE");
  const endpoint = new URL(`${base.toString().replace(/\/$/, "")}/v2/bot/message/push`);
  const messages = chunks.map((text) => ({ type: "text", text }));

  await requestJson(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-line-retry-key": randomUUID(),
    },
    body: JSON.stringify({ to, messages }),
  }, env, [token], fetcher);

  return { provider: "line", status: "sent", destination, chunks: chunks.length, detail: "LINE Messaging API accepted the push request" };
}

async function deliver(provider: NotificationProvider, request: NotificationRequest, env: NodeJS.ProcessEnv, fetcher: Fetcher): Promise<DeliveryResult> {
  if (!request.dryRun && !request.confirmSend) {
    throw new Error("Set confirmSend=true before performing an external notification action");
  }
  if (provider === "telegram") return sendTelegram(request, env, fetcher);
  if (provider === "discord") return sendDiscord(request, env, fetcher);
  return sendLine(request, env, fetcher);
}

function output(results: DeliveryResult[], request: NotificationRequest): NotificationOutput {
  const successful = results.filter((item) => item.status !== "failed");
  const failed = results.filter((item) => item.status === "failed");
  const mode = request.dryRun ? "DRY RUN" : failed.length > 0 ? "PARTIAL" : "SENT";
  const table = [
    "| Channel | Status | Destination | Chunks | Detail |",
    "|---|---|---|---:|---|",
    ...results.map((item) => `| ${item.provider} | ${item.status} | ${item.destination} | ${item.chunks} | ${item.detail.replace(/\|/g, "\\|")} |`),
  ].join("\n");
  return {
    result: `# Notification ${mode}\n\n${table}`,
    summary: `${successful.length} channel(s) completed; ${failed.length} channel(s) failed${request.dryRun ? " in dry-run mode" : ""}.`,
    checklist: results.map((item, index) => ({
      ลำดับ: String(index + 1),
      ช่องทาง: item.provider,
      สถานะ: item.status,
      ปลายทาง: item.destination,
      รายละเอียด: item.detail,
    })),
    nextSteps: request.dryRun
      ? "- ตรวจปลายทางและข้อความ\n- ตั้ง CHERRYFLOW_NOTIFICATION_DRY_RUN=false\n- เปิด confirmSend ก่อนส่งจริง"
      : failed.length > 0
        ? "- ตรวจ Credential และปลายทางของช่องทางที่ล้มเหลว\n- ตรวจ Provider logs ก่อนส่งซ้ำ เพื่อหลีกเลี่ยงข้อความซ้ำ"
        : "- ตรวจสอบว่าผู้รับได้รับข้อความ\n- เก็บ Run ID และสถานะไว้เป็นหลักฐาน",
    aiStatus: `notification-${mode.toLowerCase().replace(" ", "-")}`,
  };
}

export async function runNotification(
  provider: NotificationProvider,
  context: ModuleContext,
  env: NodeJS.ProcessEnv = process.env,
  fetcher: Fetcher = fetch,
): Promise<NotificationOutput> {
  const request = notificationRequest(context, env);
  const result = await deliver(provider, request, env, fetcher);
  return output([result], request);
}

function dispatchProviders(context: ModuleContext): NotificationProvider[] {
  const source = sourceData(context);
  const configured = Array.isArray(context.config.channels)
    ? context.config.channels.filter((item): item is string => typeof item === "string")
    : cleanText(context.config.channels).split(",").map((item) => item.trim()).filter(Boolean);
  const selected = new Set<NotificationProvider>();
  for (const item of configured) {
    if (item === "telegram" || item === "discord" || item === "line") selected.add(item);
  }
  if (booleanValue(source.sendTelegram)) selected.add("telegram");
  if (booleanValue(source.sendDiscord)) selected.add("discord");
  if (booleanValue(source.sendLine)) selected.add("line");
  return [...selected];
}

export async function runNotificationDispatch(
  context: ModuleContext,
  env: NodeJS.ProcessEnv = process.env,
  fetcher: Fetcher = fetch,
): Promise<NotificationOutput> {
  const request = notificationRequest(context, env);
  const providers = dispatchProviders(context);
  if (providers.length === 0) throw new Error("Select at least one notification channel");
  if (!request.dryRun && !request.confirmSend) throw new Error("Set confirmSend=true before performing external notification actions");

  const results: DeliveryResult[] = [];
  for (const provider of providers) {
    try {
      results.push(await deliver(provider, request, env, fetcher));
    } catch (error) {
      results.push({
        provider,
        status: "failed",
        destination: provider === "telegram"
          ? maskDestination(request.telegramChatId ?? env.TELEGRAM_CHAT_ID, "Telegram chat")
          : provider === "line"
            ? maskDestination(request.lineTo ?? env.LINE_TO, "LINE target")
            : env.DISCORD_WEBHOOK_URL ? "Discord webhook (configured)" : "Discord webhook (not configured)",
        chunks: 0,
        detail: redact(error instanceof Error ? error.message : "Delivery failed", [env.TELEGRAM_BOT_TOKEN, env.DISCORD_WEBHOOK_URL, env.LINE_CHANNEL_ACCESS_TOKEN]),
      });
    }
  }

  if (results.every((item) => item.status === "failed")) {
    throw new Error(`All notification channels failed: ${results.map((item) => `${item.provider}: ${item.detail}`).join("; ")}`);
  }
  return output(results, request);
}

export function createTelegramNotificationModuleDefinition(): ModuleDefinition {
  return {
    type: "notify.telegram",
    label: "Telegram Notification",
    description: "Send a plain-text message through Telegram Bot API with server-side credentials, dry-run, confirmation, timeout, and safe chunking.",
    run: (context) => runNotification("telegram", context),
  };
}

export function createDiscordNotificationModuleDefinition(): ModuleDefinition {
  return {
    type: "notify.discord",
    label: "Discord Webhook Notification",
    description: "Send a plain-text Discord incoming-webhook message with mentions disabled, server-side webhook storage, dry-run, and confirmation.",
    run: (context) => runNotification("discord", context),
  };
}

export function createLineNotificationModuleDefinition(): ModuleDefinition {
  return {
    type: "notify.line",
    label: "LINE Messaging API Push",
    description: "Push plain-text messages through a LINE Messaging API channel using server-side access tokens and explicit destination/confirmation controls.",
    run: (context) => runNotification("line", context),
  };
}

export function createNotificationDispatchModuleDefinition(): ModuleDefinition {
  return {
    type: "notify.dispatch",
    label: "Multi-channel Notification",
    description: "Dispatch one message to selected Telegram, Discord, and LINE channels and report per-channel delivery state.",
    run: runNotificationDispatch,
  };
}
