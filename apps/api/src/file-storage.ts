import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { FileOutputValue, UploadedFileValue, WorkflowInputValues } from "@cherryflow/ui-schema";

interface StoredObject {
  body: Uint8Array;
  contentType: string;
  name: string;
}

let client: S3Client | undefined;
let bucketReady: Promise<void> | undefined;

function s3Endpoint(): string | undefined {
  return process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT;
}

function s3Bucket(): string {
  return process.env.S3_BUCKET || process.env.MINIO_BUCKET || "cherryflow";
}

export function fileStorageEnabled(): boolean {
  return Boolean(s3Endpoint() && (process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY) && (process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY));
}

function s3Client(): S3Client {
  if (!client) {
    const endpoint = s3Endpoint();
    if (!endpoint) throw new Error("S3 endpoint is not configured");
    client = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint,
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") !== "false",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_KEY ?? "",
      },
    });
  }
  return client;
}

async function ensureBucket(): Promise<void> {
  if (!fileStorageEnabled()) return;
  bucketReady ??= (async () => {
    const bucket = s3Bucket();
    try {
      await s3Client().send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await s3Client().send(new CreateBucketCommand({ Bucket: bucket }));
    }
  })();
  await bucketReady;
}

function keyFor(prefix: string, name: string): string {
  const safeName = name.replace(/[^a-zA-Z0-9ก-๙._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
  return `${prefix}/${crypto.randomUUID()}-${safeName}`.slice(0, 500);
}

export function encodeStoredFileName(name: string): string {
  return Buffer.from(name, "utf8").toString("base64url");
}

export function decodeStoredFileName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return undefined;
  }
}

export function parseDataUrl(dataUrl: string): { bytes: Buffer; contentType: string } {
  const match = dataUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/);
  if (!match) throw new Error("Unsupported file data URL");
  return {
    bytes: Buffer.from(match[2] ?? "", "base64"),
    contentType: match[1] || "application/octet-stream",
  };
}

export async function putFile(prefix: string, name: string, mimeType: string, bytes: Buffer | Uint8Array): Promise<{ objectKey: string; url: string }> {
  await ensureBucket();
  const objectKey = keyFor(prefix, name);
  await s3Client().send(new PutObjectCommand({
    Bucket: s3Bucket(),
    Key: objectKey,
    Body: bytes,
    ContentType: mimeType || "application/octet-stream",
    Metadata: { filename64: encodeStoredFileName(name) },
  }));
  return { objectKey, url: `/api/files/${encodeURIComponent(objectKey)}` };
}

export async function storeWorkflowInputs(workflowId: string, runId: string, inputs: WorkflowInputValues): Promise<WorkflowInputValues> {
  if (!fileStorageEnabled()) return inputs;
  const stored: WorkflowInputValues = { ...inputs };
  for (const [field, value] of Object.entries(inputs)) {
    if (!value || typeof value !== "object" || Array.isArray(value) || !("dataUrl" in value)) continue;
    const file = value as UploadedFileValue;
    if (!file.dataUrl) continue;
    const parsed = parseDataUrl(file.dataUrl);
    const saved = await putFile(`uploads/${workflowId}/${runId}`, file.name, file.type || parsed.contentType, parsed.bytes);
    stored[field] = {
      name: file.name,
      type: file.type || parsed.contentType,
      size: file.size,
      objectKey: saved.objectKey,
      url: saved.url,
    };
  }
  return stored;
}

export async function createFileOutput(name: string, mimeType: string, content: string | Buffer | Uint8Array): Promise<FileOutputValue> {
  const bytes = typeof content === "string" ? Buffer.from(content, "utf8") : Buffer.from(content);
  if (!fileStorageEnabled()) {
    return {
      name,
      mimeType,
      dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
    };
  }
  const saved = await putFile("outputs", name, mimeType, bytes);
  return { name, mimeType, objectKey: saved.objectKey, url: saved.url };
}

async function bodyToBytes(body: unknown): Promise<Uint8Array> {
  if (!body) return new Uint8Array();
  if (typeof (body as { transformToByteArray?: unknown }).transformToByteArray === "function") {
    return (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array | string>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function getStoredFile(objectKey: string): Promise<StoredObject | undefined> {
  if (!fileStorageEnabled()) return undefined;
  const result = await s3Client().send(new GetObjectCommand({ Bucket: s3Bucket(), Key: objectKey }));
  const body = await bodyToBytes(result.Body);
  return {
    body,
    contentType: result.ContentType || "application/octet-stream",
    name: decodeStoredFileName(result.Metadata?.filename64) || result.Metadata?.filename || objectKey.split("/").at(-1) || "download",
  };
}
