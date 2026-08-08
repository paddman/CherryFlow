import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootEnvPath = fileURLToPath(new URL("../../../.env", import.meta.url));
const nextBinPath = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));

if (existsSync(rootEnvPath)) process.loadEnvFile(rootEnvPath);

const child = spawn(process.execPath, [nextBinPath, ...process.argv.slice(2)], {
  env: process.env,
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error("Failed to start Next.js:", error);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
