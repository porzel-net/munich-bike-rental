import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const standalonePublic = resolve(root, ".next/standalone/public");
const standaloneStatic = resolve(root, ".next/standalone/.next/static");

mkdirSync(standalonePublic, { recursive: true });
mkdirSync(standaloneStatic, { recursive: true });
cpSync(resolve(root, "public"), standalonePublic, { recursive: true });
cpSync(resolve(root, ".next/static"), standaloneStatic, { recursive: true });

const server = spawn(process.execPath, [resolve(root, ".next/standalone/server.js")], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}

server.on("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
