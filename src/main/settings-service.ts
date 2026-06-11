import { app, safeStorage } from "electron";
import path from "node:path";
import { promises as fs } from "node:fs";
import type { Settings } from "../shared/types";

const DEFAULT_SETTINGS: Settings = {
  remoteHost: "10.250.240.38",
  remotePort: 22,
  username: "",
  refreshIntervalSec: 5,
  windowBounds: {
    width: 430,
    height: 310
  }
};

type StoredSettings = Partial<Omit<Settings, "password">>;

export class SettingsService {
  private filePath: string | null = null;

  async read(includePassword = false): Promise<Settings> {
    const stored = await this.readStored();
    const settings: Settings = { ...DEFAULT_SETTINGS, ...stored };
    if (includePassword && settings.encryptedPassword) {
      settings.password = this.decrypt(settings.encryptedPassword);
    }
    return settings;
  }

  async save(input: Settings): Promise<Settings> {
    const current = await this.readStored();
    const encryptedPassword =
      typeof input.password === "string" && input.password.length > 0
        ? this.encrypt(input.password)
        : input.encryptedPassword ?? current.encryptedPassword;

    const stored: StoredSettings = {
      ...current,
      remoteHost: input.remoteHost.trim(),
      remotePort: normalizePort(input.remotePort),
      username: input.username.trim(),
      refreshIntervalSec: normalizeRefresh(input.refreshIntervalSec),
      encryptedPassword,
      hostFingerprint: input.hostFingerprint ?? current.hostFingerprint,
      windowBounds: input.windowBounds ?? current.windowBounds ?? DEFAULT_SETTINGS.windowBounds
    };

    await fs.mkdir(path.dirname(this.getFilePath()), { recursive: true });
    await fs.writeFile(this.getFilePath(), JSON.stringify(stored, null, 2), "utf8");
    return this.read(false);
  }

  async saveWindowBounds(bounds: Settings["windowBounds"]): Promise<void> {
    const settings = await this.readStored();
    await fs.mkdir(path.dirname(this.getFilePath()), { recursive: true });
    await fs.writeFile(
      this.getFilePath(),
      JSON.stringify({ ...settings, windowBounds: bounds }, null, 2),
      "utf8"
    );
  }

  async saveHostFingerprint(fingerprint: string): Promise<void> {
    const settings = await this.readStored();
    await fs.mkdir(path.dirname(this.getFilePath()), { recursive: true });
    await fs.writeFile(
      this.getFilePath(),
      JSON.stringify({ ...settings, hostFingerprint: fingerprint }, null, 2),
      "utf8"
    );
  }

  private async readStored(): Promise<StoredSettings> {
    try {
      const raw = await fs.readFile(this.getFilePath(), "utf8");
      return JSON.parse(raw) as StoredSettings;
    } catch (error) {
      return {};
    }
  }

  private getFilePath(): string {
    if (!this.filePath) {
      this.filePath = path.join(app.getPath("userData"), "settings.json");
    }
    return this.filePath;
  }

  private encrypt(password: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      return Buffer.from(password, "utf8").toString("base64");
    }
    return safeStorage.encryptString(password).toString("base64");
  }

  private decrypt(encryptedPassword: string): string {
    const buffer = Buffer.from(encryptedPassword, "base64");
    if (!safeStorage.isEncryptionAvailable()) {
      return buffer.toString("utf8");
    }
    return safeStorage.decryptString(buffer);
  }
}

function normalizePort(port: number): number {
  const value = Number(port);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    return DEFAULT_SETTINGS.remotePort;
  }
  return value;
}

function normalizeRefresh(seconds: number): number {
  const value = Number(seconds);
  if (!Number.isFinite(value)) {
    return DEFAULT_SETTINGS.refreshIntervalSec;
  }
  return Math.max(1, Math.min(60, Math.round(value)));
}
