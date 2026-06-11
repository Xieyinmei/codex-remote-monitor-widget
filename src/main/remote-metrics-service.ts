import { Client } from "ssh2";
import type { ConnectionTestResult, RemoteMetricsSnapshot, Settings } from "../shared/types";
import { calculateCpuPercent, parseProcStat } from "../shared/cpu";
import { parseNvidiaSmi } from "../shared/gpu";

const CPU_COMMAND = "cat /proc/stat; sleep 0.25; cat /proc/stat";
const GPU_COMMAND =
  "command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits || true";

export class RemoteMetricsService {
  async testConnection(settings: Settings): Promise<ConnectionTestResult> {
    try {
      const result = await this.withClient(settings, async (client, fingerprint) => {
        const output = await exec(client, "uname -s && hostname");
        return {
          ok: true,
          message: output.trim() || "连接成功",
          hostFingerprint: fingerprint
        };
      });
      return result;
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async collect(settings: Settings): Promise<RemoteMetricsSnapshot> {
    const startedAt = Date.now();
    try {
      return await this.withClient(settings, async (client, fingerprint) => {
        const [cpuOutput, gpuOutput] = await Promise.all([
          exec(client, CPU_COMMAND),
          exec(client, GPU_COMMAND)
        ]);
        const [first, second] = splitProcStatSamples(cpuOutput);
        const cpuPercent = calculateCpuPercent(parseProcStat(first), parseProcStat(second));
        const gpus = parseNvidiaSmi(gpuOutput);

        return {
          host: settings.remoteHost,
          cpuPercent,
          gpus,
          connected: true,
          latencyMs: Date.now() - startedAt,
          updatedAt: Date.now(),
          message: fingerprint ? `Host ${fingerprint}` : undefined
        };
      });
    } catch (error) {
      return {
        host: settings.remoteHost,
        cpuPercent: null,
        gpus: [],
        connected: false,
        latencyMs: null,
        updatedAt: Date.now(),
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private withClient<T>(
    settings: Settings,
    callback: (client: Client, fingerprint?: string) => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      validateSettings(settings);

      const client = new Client();
      let observedFingerprint: string | undefined;
      let settled = false;
      const timeout = setTimeout(() => {
        client.end();
        reject(new Error("SSH connection timed out"));
      }, 12000);

      client
        .on("ready", async () => {
          try {
            const result = await callback(client, observedFingerprint);
            settled = true;
            clearTimeout(timeout);
            client.end();
            resolve(result);
          } catch (error) {
            settled = true;
            clearTimeout(timeout);
            client.end();
            reject(error);
          }
        })
        .on("error", (error) => {
          if (!settled) {
            clearTimeout(timeout);
            reject(error);
          }
        })
        .connect({
          host: settings.remoteHost,
          port: settings.remotePort,
          username: settings.username,
          password: settings.password,
          readyTimeout: 10000,
          hostHash: "sha256",
          hostVerifier: (hashedKey: string) => {
            observedFingerprint = hashedKey;
            if (!settings.hostFingerprint) {
              return true;
            }
            return settings.hostFingerprint === hashedKey;
          }
        });
    });
  }
}

function validateSettings(settings: Settings): void {
  if (!settings.remoteHost.trim()) {
    throw new Error("请先填写远程主机 IP/Host");
  }
  if (!settings.username.trim()) {
    throw new Error("请先填写 SSH 用户名");
  }
  if (!settings.password) {
    throw new Error("请先填写 SSH 密码");
  }
}

function exec(client: Client, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    client.exec(command, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }
      let stdout = "";
      let stderr = "";
      stream
        .on("close", (code: number) => {
          if (code && stderr.trim()) {
            reject(new Error(stderr.trim()));
            return;
          }
          resolve(stdout);
        })
        .on("data", (data: Buffer) => {
          stdout += data.toString("utf8");
        })
        .stderr.on("data", (data: Buffer) => {
          stderr += data.toString("utf8");
        });
    });
  });
}

function splitProcStatSamples(output: string): [string, string] {
  const matches = output.match(/^cpu\s+.*$/gm);
  if (!matches || matches.length < 2) {
    throw new Error("远程设备没有返回有效的 /proc/stat CPU 数据");
  }
  return [matches[0], matches[matches.length - 1]];
}
