import { describe, expect, it } from "vitest";
import { calculateCpuPercent, parseProcStat } from "./cpu";

describe("cpu parser", () => {
  it("parses aggregate proc stat values", () => {
    expect(parseProcStat("cpu  10 20 30 40 5 0 0 0 0 0\ncpu0 1 2 3 4")).toEqual({
      idle: 45,
      total: 105
    });
  });

  it("calculates CPU utilization from two samples", () => {
    const first = parseProcStat("cpu  100 0 100 800 0 0 0 0 0 0");
    const second = parseProcStat("cpu  150 0 150 900 0 0 0 0 0 0");
    expect(calculateCpuPercent(first, second)).toBe(50);
  });
});
