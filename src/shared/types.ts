export interface Settings {
  remoteHost: string;
  remotePort: number;
  username: string;
  encryptedPassword?: string;
  password?: string;
  hostFingerprint?: string;
  refreshIntervalSec: number;
  windowBounds?: {
    x?: number;
    y?: number;
    width: number;
    height: number;
  };
}

export interface QuotaWindow {
  label: string;
  remainingPercent: number;
  usedPercent: number;
  resetsAt: number | null;
}

export interface CodexQuotaSnapshot {
  shortWindow: QuotaWindow | null;
  longWindow: QuotaWindow | null;
  credits?: {
    hasCredits: boolean;
    unlimited: boolean;
    balance: string | null;
  } | null;
  planType?: string | null;
}

export interface GpuMetric {
  index: number;
  utilizationPercent: number | null;
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  temperatureC: number | null;
}

export interface RemoteMetricsSnapshot {
  host: string;
  cpuPercent: number | null;
  gpus: GpuMetric[];
  connected: boolean;
  latencyMs: number | null;
  updatedAt: number | null;
  message?: string;
}

export interface WidgetSnapshot {
  codex: CodexQuotaSnapshot | null;
  remote: RemoteMetricsSnapshot | null;
  updatedAt: number;
  errors: string[];
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  hostFingerprint?: string;
}

export interface RendererApi {
  readSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<Settings>;
  testConnection: (settings: Settings) => Promise<ConnectionTestResult>;
  readSnapshot: () => Promise<WidgetSnapshot>;
  refreshSnapshot: () => Promise<WidgetSnapshot>;
  openSettings: () => Promise<void>;
  onSnapshotUpdated: (callback: (snapshot: WidgetSnapshot) => void) => () => void;
  onOpenSettings: (callback: () => void) => () => void;
}
