import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from "electron";
import path from "node:path";
import type { Settings } from "../shared/types";
import { CodexService } from "./codex-service";
import { RemoteMetricsService } from "./remote-metrics-service";
import { SettingsService } from "./settings-service";
import { SnapshotService } from "./snapshot-service";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const settingsService = new SettingsService();
const remoteMetricsService = new RemoteMetricsService();
const codexService = new CodexService();
const snapshotService = new SnapshotService(settingsService, remoteMetricsService, codexService);

async function createWindow(): Promise<void> {
  const settings = await settingsService.read(false);
  const bounds = settings.windowBounds ?? { width: 430, height: 310 };

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 380,
    minHeight: 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setAlwaysOnTop(true, "floating");
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on("move", () => saveWindowBoundsSoon());
  mainWindow.on("resize", () => saveWindowBoundsSoon());

  snapshotService.setWindow(mainWindow);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

function createTray(): void {
  const image = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGElEQVR42mP8z8Dwn4ECwESJ5lEDRgYABcMCBPlm3VwAAAAASUVORK5CYII="
  );
  tray = new Tray(image);
  tray.setToolTip("Codex Monitor Widget");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "显示/隐藏",
        click: () => toggleWindow()
      },
      {
        label: "刷新",
        click: () => void snapshotService.refresh()
      },
      {
        label: "设置",
        click: () => openSettings()
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
  tray.on("click", () => toggleWindow());
}

function toggleWindow(): void {
  if (!mainWindow) {
    return;
  }
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function openSettings(): void {
  if (!mainWindow) {
    return;
  }
  mainWindow.show();
  mainWindow.webContents.send("settings:open");
}

let saveBoundsTimer: NodeJS.Timeout | null = null;
function saveWindowBoundsSoon(): void {
  if (!mainWindow) {
    return;
  }
  if (saveBoundsTimer) {
    clearTimeout(saveBoundsTimer);
  }
  saveBoundsTimer = setTimeout(() => {
    if (!mainWindow) {
      return;
    }
    void settingsService.saveWindowBounds(mainWindow.getBounds());
  }, 300);
}

function registerIpc(): void {
  ipcMain.handle("settings:read", async () => settingsService.read(false));
  ipcMain.handle("settings:open", async () => openSettings());
  ipcMain.handle("settings:save", async (_event, settings: Settings) => {
    const saved = await settingsService.save(settings);
    await snapshotService.restartTimer();
    void snapshotService.refresh();
    return saved;
  });
  ipcMain.handle("connection:test", async (_event, settings: Settings) => {
    const current = await settingsService.read(true);
    const result = await remoteMetricsService.testConnection({ ...current, ...settings });
    if (result.ok && result.hostFingerprint) {
      await settingsService.saveHostFingerprint(result.hostFingerprint);
    }
    return result;
  });
  ipcMain.handle("snapshot:read", async () => snapshotService.getSnapshot());
  ipcMain.handle("snapshot:refresh", async () => snapshotService.refresh());
}

app.whenReady().then(async () => {
  registerIpc();
  await createWindow();
  createTray();
  void snapshotService.start();
});

app.on("before-quit", () => {
  isQuitting = true;
  snapshotService.stop();
  codexService.dispose();
});

app.on("window-all-closed", () => {
  // The app intentionally lives in the tray until the user chooses Exit.
});
