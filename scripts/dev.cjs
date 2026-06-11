const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: isWindows,
    ...options
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });
  return child;
}

function waitFor(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(tick, 250);
      });
      req.setTimeout(1000, () => req.destroy());
    };
    tick();
  });
}

async function main() {
  const tsc = run("npx", ["tsc", "-p", "tsconfig.main.json", "--watch", "--preserveWatchOutput"]);
  const vite = run("npx", ["vite", "--host", "127.0.0.1"]);
  await waitFor("http://127.0.0.1:5173");
  const env = { ...process.env, VITE_DEV_SERVER_URL: "http://127.0.0.1:5173" };
  const electron = run("npx", ["electron", "."], { env });

  const shutdown = () => {
    electron.kill();
    vite.kill();
    tsc.kill();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  electron.on("exit", () => {
    shutdown();
    process.exit();
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
