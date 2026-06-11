import { Cpu, Gauge, MonitorCog, RefreshCw, Settings, X, Zap } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { QuotaWindow, Settings as WidgetSettings, WidgetSnapshot } from "../shared/types";

const emptySnapshot: WidgetSnapshot = {
  codex: null,
  remote: null,
  updatedAt: Date.now(),
  errors: []
};

export function App() {
  const [snapshot, setSnapshot] = useState<WidgetSnapshot>(emptySnapshot);
  const [settings, setSettings] = useState<WidgetSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [password, setPassword] = useState("");
  const [isRefreshing, setRefreshing] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("");

  useEffect(() => {
    void window.monitorWidget.readSnapshot().then(setSnapshot);
    void window.monitorWidget.readSettings().then((value) => {
      setSettings(value);
      setShowSettings(!value.username);
    });
    const unsubscribeSnapshot = window.monitorWidget.onSnapshotUpdated(setSnapshot);
    const unsubscribeSettings = window.monitorWidget.onOpenSettings(() => setShowSettings(true));
    return () => {
      unsubscribeSnapshot();
      unsubscribeSettings();
    };
  }, []);

  const remote = snapshot.remote;
  const hasGpu = Boolean(remote?.gpus.length);

  async function refresh() {
    setRefreshing(true);
    try {
      setSnapshot(await window.monitorWidget.refreshSnapshot());
    } finally {
      setRefreshing(false);
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!settings) {
      return;
    }
    const saved = await window.monitorWidget.saveSettings({ ...settings, password });
    setPassword("");
    setSettings(saved);
    setShowSettings(false);
    setConnectionMessage("设置已保存");
    void refresh();
  }

  async function testConnection() {
    if (!settings) {
      return;
    }
    setConnectionMessage("正在测试连接...");
    const result = await window.monitorWidget.testConnection({ ...settings, password });
    setConnectionMessage(result.ok ? `连接成功：${result.message}` : `连接失败：${result.message}`);
  }

  return (
    <main className="shell">
      <section className="widget">
        <header className="titlebar">
          <div className="brand">
            <span className="brand-mark">
              <MonitorCog size={17} />
            </span>
            <span>Codex</span>
          </div>
          <span className="updated">{formatTime(snapshot.updatedAt)}</span>
          <div className="actions">
            <button title="刷新" className="icon-button" onClick={refresh} disabled={isRefreshing}>
              <RefreshCw size={15} className={isRefreshing ? "spin" : ""} />
            </button>
            <button title="设置" className="icon-button" onClick={() => setShowSettings(true)}>
              <Settings size={15} />
            </button>
          </div>
        </header>

        <div className="content">
          <QuotaRow title={snapshot.codex?.shortWindow?.label ?? "5小时"} window={snapshot.codex?.shortWindow} />
          <QuotaRow title={snapshot.codex?.longWindow?.label ?? "周限额"} window={snapshot.codex?.longWindow} />

          <div className="divider" />

          <MetricRow
            icon={<Cpu size={16} />}
            title="CPU"
            value={remote?.cpuPercent == null ? "N/A" : `${remote.cpuPercent.toFixed(1)}%`}
            subtitle={remote?.connected ? remote.host : "未连接"}
            percent={remote?.cpuPercent ?? 0}
            tone={remote?.connected ? "green" : "gray"}
          />
          <MetricRow
            icon={<Zap size={16} />}
            title="GPU"
            value={hasGpu ? `${remote!.gpus[0].utilizationPercent ?? 0}%` : "N/A"}
            subtitle={gpuSubtitle(remote)}
            percent={hasGpu ? remote!.gpus[0].utilizationPercent ?? 0 : 0}
            tone={hasGpu ? "blue" : "gray"}
          />
        </div>

        {snapshot.errors.length > 0 && <div className="status-line">{snapshot.errors[0]}</div>}
      </section>

      {showSettings && settings && (
        <section className="settings-panel">
          <form onSubmit={saveSettings}>
            <header>
              <strong>设置</strong>
              <button title="关闭设置" type="button" className="icon-button" onClick={() => setShowSettings(false)}>
                <X size={15} />
              </button>
            </header>
            <label>
              <span>远程主机</span>
              <input
                value={settings.remoteHost}
                onChange={(event) => setSettings({ ...settings, remoteHost: event.target.value })}
                placeholder="10.250.240.38"
              />
            </label>
            <label>
              <span>端口</span>
              <input
                type="number"
                min={1}
                max={65535}
                value={settings.remotePort}
                onChange={(event) => setSettings({ ...settings, remotePort: Number(event.target.value) })}
              />
            </label>
            <label>
              <span>用户名</span>
              <input
                value={settings.username}
                onChange={(event) => setSettings({ ...settings, username: event.target.value })}
              />
            </label>
            <label>
              <span>密码</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={settings.encryptedPassword ? "留空则沿用已保存密码" : ""}
              />
            </label>
            <label>
              <span>刷新间隔</span>
              <input
                type="number"
                min={1}
                max={60}
                value={settings.refreshIntervalSec}
                onChange={(event) =>
                  setSettings({ ...settings, refreshIntervalSec: Number(event.target.value) })
                }
              />
            </label>
            <footer>
              <button type="button" className="secondary" onClick={testConnection}>
                测试连接
              </button>
              <button type="submit" className="primary">
                保存
              </button>
            </footer>
            {connectionMessage && <p className="connection-message">{connectionMessage}</p>}
          </form>
        </section>
      )}
    </main>
  );
}

function QuotaRow({ title, window }: { title: string; window: QuotaWindow | null | undefined }) {
  const percent = window?.remainingPercent ?? 0;
  return (
    <MetricRow
      icon={<Gauge size={16} />}
      title={title}
      value={window ? `剩余 ${percent}%` : "未连接"}
      subtitle={window?.resetsAt ? formatReset(window.resetsAt) : "等待 Codex 数据"}
      percent={percent}
      tone="green"
      reverse
    />
  );
}

function MetricRow({
  icon,
  title,
  value,
  subtitle,
  percent,
  tone,
  reverse = false
}: {
  icon: JSX.Element;
  title: string;
  value: string;
  subtitle: string;
  percent: number;
  tone: "green" | "blue" | "gray";
  reverse?: boolean;
}) {
  const dots = useMemo(() => {
    const filled = Math.round(Math.max(0, Math.min(100, percent)) / 20);
    return Array.from({ length: 5 }, (_, index) => index < filled);
  }, [percent]);

  return (
    <div className="metric-row">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <div className="metric-main">
        <div className="metric-top">
          <span className="metric-title">{title}</span>
          <span className="metric-value">{value}</span>
        </div>
        <div className="metric-bottom">
          <div className={`dots ${tone}`}>
            {dots.map((filled, index) => (
              <span key={index} className={filled ? "filled" : ""} />
            ))}
          </div>
          <span>{reverse ? subtitle : subtitle}</span>
        </div>
      </div>
    </div>
  );
}

function gpuSubtitle(remote: WidgetSnapshot["remote"]): string {
  if (!remote?.connected) {
    return "等待远程状态";
  }
  const gpu = remote.gpus[0];
  if (!gpu) {
    return "未检测到 NVIDIA GPU";
  }
  const memory =
    gpu.memoryUsedMb == null || gpu.memoryTotalMb == null ? "显存 N/A" : `${gpu.memoryUsedMb}/${gpu.memoryTotalMb} MB`;
  const temp = gpu.temperatureC == null ? "温度 N/A" : `${gpu.temperatureC}°C`;
  return `${memory} · ${temp}`;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(timestamp);
}

function formatReset(timestamp: number): string {
  const millis = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(millis);
}
