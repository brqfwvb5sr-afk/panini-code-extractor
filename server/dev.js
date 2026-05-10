import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const viteBin = join(rootDir, "node_modules", "vite", "bin", "vite.js");
const children = [];

function cleanEnvironment(extra = {}) {
  const env = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (key.toLowerCase() !== "path") {
      env[key] = value;
    }
  }

  env.Path = process.env.Path || process.env.PATH || "";

  return { ...env, ...extra };
}

function start(name, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: cleanEnvironment(env),
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] beendet mit Code ${code}`);
    }
  });

  children.push(child);
}

function stopAll() {
  for (const child of children) {
    child.kill();
  }
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopAll();
  process.exit(0);
});

start("sync", process.execPath, ["server/index.js"], { PORT: "4174" });
start("vite", process.execPath, [viteBin, "--host", "0.0.0.0", "--port", "5173"]);
