import type { CodexQuotaSnapshot, QuotaWindow } from "./types";

export interface RateLimitWindowPayload {
  usedPercent: number;
  windowDurationMins: number | null;
  resetsAt: number | null;
}

export interface RateLimitSnapshotPayload {
  limitId?: string | null;
  limitName?: string | null;
  primary?: RateLimitWindowPayload | null;
  secondary?: RateLimitWindowPayload | null;
  credits?: CodexQuotaSnapshot["credits"];
  individualLimit?: {
    limit: string;
    used: string;
    remainingPercent: number;
    resetsAt: number;
  } | null;
  planType?: string | null;
}

export interface RateLimitsResponsePayload {
  rateLimits?: RateLimitSnapshotPayload;
  rateLimitsByLimitId?: Record<string, RateLimitSnapshotPayload | undefined> | null;
}

export function normalizeCodexQuota(response: RateLimitsResponsePayload): CodexQuotaSnapshot | null {
  const snapshot = response.rateLimitsByLimitId?.codex ?? response.rateLimits;
  if (!snapshot) {
    return null;
  }

  return {
    shortWindow: normalizeWindow(snapshot.primary, "5小时"),
    longWindow: normalizeWindow(snapshot.secondary, "周限额"),
    credits: snapshot.credits ?? null,
    planType: snapshot.planType ?? null
  };
}

export function normalizeWindow(
  window: RateLimitWindowPayload | null | undefined,
  fallbackLabel: string
): QuotaWindow | null {
  if (!window) {
    return null;
  }
  const usedPercent = clamp(window.usedPercent);
  return {
    label: labelForDuration(window.windowDurationMins, fallbackLabel),
    usedPercent,
    remainingPercent: clamp(100 - usedPercent),
    resetsAt: window.resetsAt ?? null
  };
}

export function labelForDuration(minutes: number | null | undefined, fallback: string): string {
  if (!minutes) {
    return fallback;
  }
  if (minutes < 60) {
    return `${minutes}分钟`;
  }
  if (minutes < 60 * 24) {
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}小时`;
  }
  if (minutes % (60 * 24 * 7) === 0) {
    return "周限额";
  }
  const days = minutes / (60 * 24);
  return `${Number.isInteger(days) ? days : days.toFixed(1)}天`;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}
