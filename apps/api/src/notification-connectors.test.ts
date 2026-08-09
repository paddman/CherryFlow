import assert from "node:assert/strict";
import test from "node:test";
import type { ModuleContext } from "@cherryflow/workflow-engine";
import { runNotification, runNotificationDispatch } from "./notification-connectors.js";

function context(inputs: Record<string, unknown>, config: Record<string, unknown> = {}): ModuleContext {
  return {
    workflowInputs: {},
    config: { inputNode: "input", ...config },
    dependencies: { input: inputs },
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("Telegram dry run validates without credentials or network access", async () => {
  let calls = 0;
  const output = await runNotification(
    "telegram",
    context({ title: "Incident", message: "Service recovered", telegramChatId: "-1001234567890", dryRun: true }),
    { CHERRYFLOW_NOTIFICATION_DRY_RUN: "true" },
    async () => { calls += 1; throw new Error("network must not be called"); },
  );

  assert.equal(calls, 0);
  assert.match(output.result, /dry-run/);
  assert.match(output.result, /…7890/);
  assert.equal(output.aiStatus, "notification-dry-run");
});

test("Telegram sends through Bot API and never exposes the bot token", async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const token = "123456:super-secret-token";
  const output = await runNotification(
    "telegram",
    context({ title: "Alert", message: "CPU usage is high", telegramChatId: "-10099887766", confirmSend: true }),
    {
      CHERRYFLOW_NOTIFICATION_DRY_RUN: "false",
      TELEGRAM_BOT_TOKEN: token,
    },
    async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse({ ok: true, result: { message_id: 42 } });
    },
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0]?.url ?? "", /api\.telegram\.org\/bot123456:super-secret-token\/sendMessage/);
  const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
  assert.equal(body.chat_id, "-10099887766");
  assert.match(String(body.text), /CPU usage is high/);
  assert.equal(body.disable_notification, false);
  assert.doesNotMatch(JSON.stringify(output), /super-secret-token/);
  assert.equal(output.aiStatus, "notification-sent");
});

test("Discord sends an incoming webhook with mentions disabled", async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const webhook = "https://discord.com/api/webhooks/123456/very-secret-webhook-token";
  const output = await runNotification(
    "discord",
    context({ title: "Deploy", message: "@everyone deployment completed", confirmSend: true }),
    {
      CHERRYFLOW_NOTIFICATION_DRY_RUN: "false",
      DISCORD_WEBHOOK_URL: webhook,
      DISCORD_USERNAME: "CherryFlow Ops",
    },
    async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse({ id: "999" });
    },
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0]?.url ?? "", /wait=true/);
  const body = JSON.parse(String(calls[0]?.init?.body)) as {
    content: string;
    username: string;
    allowed_mentions: { parse: string[] };
  };
  assert.match(body.content, /@everyone/);
  assert.equal(body.username, "CherryFlow Ops");
  assert.deepEqual(body.allowed_mentions, { parse: [] });
  assert.doesNotMatch(JSON.stringify(output), /very-secret-webhook-token/);
});

test("LINE uses Messaging API push with a server-side bearer token and retry key", async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const token = "line-secret-channel-token";
  const output = await runNotification(
    "line",
    context({ title: "งานอนุมัติ", message: "มีเอกสารรอตรวจ", lineTo: "U1234567890abcdef", confirmSend: true }),
    {
      CHERRYFLOW_NOTIFICATION_DRY_RUN: "false",
      LINE_CHANNEL_ACCESS_TOKEN: token,
    },
    async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse({});
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://api.line.me/v2/bot/message/push");
  const headers = new Headers(calls[0]?.init?.headers);
  assert.equal(headers.get("authorization"), `Bearer ${token}`);
  assert.ok(headers.get("x-line-retry-key"));
  const body = JSON.parse(String(calls[0]?.init?.body)) as { to: string; messages: Array<{ type: string; text: string }> };
  assert.equal(body.to, "U1234567890abcdef");
  assert.equal(body.messages[0]?.type, "text");
  assert.match(body.messages[0]?.text ?? "", /มีเอกสารรอตรวจ/);
  assert.doesNotMatch(JSON.stringify(output), /line-secret-channel-token/);
});

test("real external delivery requires explicit confirmation", async () => {
  await assert.rejects(
    runNotification(
      "discord",
      context({ title: "Test", message: "Do not send yet" }),
      {
        CHERRYFLOW_NOTIFICATION_DRY_RUN: "false",
        DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token",
      },
      async () => jsonResponse({ id: "1" }),
    ),
    /confirmSend=true/,
  );
});

test("multi-channel dispatch reports partial delivery without leaking credentials", async () => {
  const token = "telegram-dispatch-secret";
  const output = await runNotificationDispatch(
    context({
      title: "Daily summary",
      message: "3 workflows completed",
      telegramChatId: "-10055554444",
      sendTelegram: true,
      sendDiscord: true,
      confirmSend: true,
    }),
    {
      CHERRYFLOW_NOTIFICATION_DRY_RUN: "false",
      TELEGRAM_BOT_TOKEN: token,
    },
    async (input) => {
      if (String(input).includes("telegram")) return jsonResponse({ ok: true, result: { message_id: 7 } });
      throw new Error("unexpected endpoint");
    },
  );

  assert.equal(output.aiStatus, "notification-partial");
  assert.match(output.result, /telegram \| sent/);
  assert.match(output.result, /discord \| failed/);
  assert.doesNotMatch(JSON.stringify(output), /telegram-dispatch-secret/);
});

test("custom connector endpoints are blocked unless explicitly enabled", async () => {
  await assert.rejects(
    runNotification(
      "telegram",
      context({ title: "Test", message: "Blocked", telegramChatId: "1", confirmSend: true }),
      {
        CHERRYFLOW_NOTIFICATION_DRY_RUN: "false",
        TELEGRAM_BOT_TOKEN: "token",
        TELEGRAM_API_BASE_URL: "https://example.com/telegram",
      },
      async () => jsonResponse({ ok: true }),
    ),
    /custom endpoint is blocked/,
  );
});
