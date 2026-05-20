import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const commands = [
  {
    name: "api",
    command: process.execPath,
    args: [path.join(rootDir, "server", "app.js")],
  },
  {
    name: "client",
    command: process.execPath,
    args: [path.join(rootDir, "node_modules", "vite", "bin", "vite.js")],
  },
];

const children = [];
let shuttingDown = false;

function killChildren(signal = "SIGTERM") {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const job of commands) {
  const child = spawn(job.command, job.args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });

  children.push(child);

  child.on("exit", (code, signal) => {
    if (!shuttingDown && (code !== 0 || signal)) {
      console.error(`[${job.name}] exited unexpectedly.`);
      killChildren();
      process.exit(code ?? 1);
    }
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    killChildren(signal);
    process.exit(0);
  });
}
