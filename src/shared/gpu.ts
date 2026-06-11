import type { GpuMetric } from "./types";

export function parseNvidiaSmi(output: string): GpuMetric[] {
  const rows = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return rows.map((row, index) => {
    const [utilization, memoryUsed, memoryTotal, temperature] = row
      .split(",")
      .map((cell) => cell.trim());

    return {
      index,
      utilizationPercent: parseNullableNumber(utilization),
      memoryUsedMb: parseNullableNumber(memoryUsed),
      memoryTotalMb: parseNullableNumber(memoryTotal),
      temperatureC: parseNullableNumber(temperature)
    };
  });
}

function parseNullableNumber(value: string | undefined): number | null {
  if (!value || /^n\/a$/i.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
