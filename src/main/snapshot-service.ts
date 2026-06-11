import type { BrowserWindow } from "electron";
import type { WidgetSnapshot } from "../shared/types";
import { CodexService } from "./codex-service";
import { RemoteMetricsService } from "./remote-metrics-service";
import { SettingsService } from "./settings-service";

export class SnapshotService {
  private snapshot: WidgetSnapshot = {
    codex: null,
    remote: null,
    updatedAt: Date.now(),
    errors: []
  };
  private timer: NodeJS.Timeout | null = null;
  private refreshing = false;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly remoteMetricsService: RemoteMetricsService,
    private readonly codexService: CodexService
  ) {
    this.codexService.on("quota-updated", () => {
      this.snapshot = {
        ...this.snapshot,
        codex: this.codexService.getCachedQuota(),
        updatedAt: Date.now()
      };
      this.broadcast();
    });
  }

  getSnapshot(): WidgetSnapshot {
    return this.snapshot;
  }

  async refresh(): Promise<WidgetSnapshot> {
    if (this.refreshing) {
      return this.snapshot;
    }
    this.refreshing = true;
    const errors: string[] = [];

    try {
      const settings = await this.settingsService.read(true);
      const [codexResult, remote] = await Promise.allSettled([
        this.codexService.readQuota(),
        this.remoteMetricsService.collect(settings)
      ]);

      const codex =
        codexResult.status === "fulfilled" ? codexResult.value : this.codexService.getCachedQuota();
      if (codexResult.status === "rejected") {
        errors.push(`Codex: ${codexResult.reason instanceof Error ? codexResult.reason.message : codexResult.reason}`);
      }

      const remoteSnapshot = remote.status === "fulfilled" ? remote.value : this.snapshot.remote;
      if (remote.status === "rejected") {
        errors.push(`Remote: ${remote.reason instanceof Error ? remote.reason.message : remote.reason}`);
      } else if (!remote.value.connected && remote.value.message) {
        errors.push(`Remote: ${remote.value.message}`);
      }

      this.snapshot = {
        codex,
        remote: remoteSnapshot,
        updatedAt: Date.now(),
        errors
      };
      this.broadcast();
      return this.snapshot;
    } finally {
      this.refreshing = false;
    }
  }

  async start(): Promise<void> {
    await this.refresh();
    await this.restartTimer();
  }

  async restartTimer(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }
    const settings = await this.settingsService.read(false);
    this.timer = setInterval(() => {
      void this.refresh();
    }, settings.refreshIntervalSec * 1000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setWindow(window: BrowserWindow): void {
    window.webContents.on("did-finish-load", () => {
      window.webContents.send("snapshot:updated", this.snapshot);
    });
  }

  private broadcast(): void {
    for (const window of this.windows()) {
      window.webContents.send("snapshot:updated", this.snapshot);
    }
  }

  private windows(): BrowserWindow[] {
    const electron = require("electron") as typeof import("electron");
    return electron.BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed());
  }
}
