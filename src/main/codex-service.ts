import { EventEmitter } from "node:events";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import type { CodexQuotaSnapshot } from "../shared/types";
import { normalizeCodexQuota, type RateLimitsResponsePayload } from "../shared/quota";

interface JsonRpcResponse {
  id?: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
  method?: string;
  params?: unknown;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class CodexService extends EventEmitter {
  private process: ChildProcessWithoutNullStreams | null = null;
  private initialized: Promise<void> | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private lastSnapshot: CodexQuotaSnapshot | null = null;
  private lastError: string | null = null;

  async readQuota(): Promise<CodexQuotaSnapshot | null> {
    await this.ensureStarted();
    const response = (await this.request("account/rateLimits/read")) as RateLimitsResponsePayload;
    this.lastSnapshot = normalizeCodexQuota(response);
    this.lastError = null;
    return this.lastSnapshot;
  }

  getCachedQuota(): CodexQuotaSnapshot | null {
    return this.lastSnapshot;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  dispose(): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Codex app-server stopped"));
    }
    this.pending.clear();
    this.process?.kill();
    this.process = null;
    this.initialized = null;
  }

  private async ensureStarted(): Promise<void> {
    if (this.initialized) {
      return this.initialized;
    }

    this.initialized = new Promise((resolve, reject) => {
      const command = findCodexCommand();
      this.process = spawn(command, ["app-server"], {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true
      });

      const stderrLines: string[] = [];
      const rl = readline.createInterface({ input: this.process.stdout });
      rl.on("line", (line) => this.handleLine(line));
      this.process.stderr.on("data", (chunk: Buffer) => {
        stderrLines.push(chunk.toString("utf8").trim());
      });
      this.process.on("error", (error) => {
        this.lastError = error.message;
        this.initialized = null;
        reject(error);
      });
      this.process.on("exit", (code) => {
        const message = `Codex app-server exited${code === null ? "" : ` with code ${code}`}`;
        this.lastError = stderrLines.at(-1) || message;
        this.process = null;
        this.initialized = null;
        for (const pending of this.pending.values()) {
          clearTimeout(pending.timer);
          pending.reject(new Error(this.lastError));
        }
        this.pending.clear();
      });

      this.request("initialize", {
        clientInfo: {
          name: "desktop_monitor_widget",
          title: "Desktop Monitor Widget",
          version: "0.1.0"
        },
        capabilities: {
          experimentalApi: true
        }
      })
        .then(() => {
          this.notify("initialized", {});
          resolve();
        })
        .catch((error) => {
          this.lastError = error.message;
          this.initialized = null;
          reject(error);
        });
    });

    return this.initialized;
  }

  private request(method: string, params?: unknown, timeoutMs = 10000): Promise<unknown> {
    if (!this.process) {
      return Promise.reject(new Error("Codex app-server is not running"));
    }
    const id = this.nextId++;
    const payload = params === undefined ? { method, id, params: undefined } : { method, id, params };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.process?.stdin.write(`${JSON.stringify(payload)}\n`);
    });
  }

  private notify(method: string, params: unknown): void {
    this.process?.stdin.write(`${JSON.stringify({ method, params })}\n`);
  }

  private handleLine(line: string): void {
    let message: JsonRpcResponse;
    try {
      message = JSON.parse(line) as JsonRpcResponse;
    } catch (error) {
      return;
    }

    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
        return;
      }
      pending.resolve(message.result);
      return;
    }

    if (message.method === "account/rateLimits/updated") {
      const params = message.params as { rateLimits?: RateLimitsResponsePayload["rateLimits"] };
      if (params.rateLimits) {
        this.lastSnapshot = normalizeCodexQuota({ rateLimits: params.rateLimits });
        this.emit("quota-updated", this.lastSnapshot);
      }
    }
  }
}

function findCodexCommand(): string {
  if (process.env.CODEX_BIN && fs.existsSync(process.env.CODEX_BIN)) {
    return process.env.CODEX_BIN;
  }

  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const binDir = path.join(localAppData, "OpenAI", "Codex", "bin");
    try {
      const candidates = fs
        .readdirSync(binDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(binDir, entry.name, "codex.exe"))
        .filter((candidate) => fs.existsSync(candidate))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
      if (candidates[0]) {
        return candidates[0];
      }
    } catch (error) {
      // Fall through to PATH lookup.
    }
  }

  return process.platform === "win32" ? "codex.exe" : "codex";
}
