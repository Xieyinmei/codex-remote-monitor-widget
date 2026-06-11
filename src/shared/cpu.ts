export interface CpuSample {
  idle: number;
  total: number;
}

export function parseProcStat(output: string): CpuSample {
  const line = output
    .split(/\r?\n/)
    .find((entry) => entry.startsWith("cpu "));
  if (!line) {
    throw new Error("Missing aggregate cpu line in /proc/stat output");
  }

  const values = line
    .trim()
    .split(/\s+/)
    .slice(1)
    .map((value) => Number(value));

  if (values.length < 4 || values.some((value) => Number.isNaN(value))) {
    throw new Error("Invalid /proc/stat cpu values");
  }

  const idle = values[3] + (values[4] ?? 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  return { idle, total };
}

export function calculateCpuPercent(previous: CpuSample, current: CpuSample): number {
  const idleDelta = current.idle - previous.idle;
  const totalDelta = current.total - previous.total;
  if (totalDelta <= 0) {
    return 0;
  }
  const usage = (1 - idleDelta / totalDelta) * 100;
  return clampPercent(usage);
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}
