import { resolve } from "node:path";
import { spawn } from "node:child_process";

const root = resolve(import.meta.dirname, "..");

// The browser job downloads `.next` as an Actions artifact and installs the
// workspace dependencies separately. Running `next start` uses those regular
// node_modules. The standalone directory contains pnpm symlinks whose targets
// are not guaranteed to survive artifact upload/download intact.
const server = spawn(process.execPath, [resolve(root, "node_modules/next/dist/bin/next"), "start"], {
  cwd: root,
  env: { ...process.env, NODE_ENV: "production" },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}

server.on("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
