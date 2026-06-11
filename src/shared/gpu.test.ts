import { describe, expect, it } from "vitest";
import { parseNvidiaSmi } from "./gpu";

describe("nvidia-smi parser", () => {
  it("parses multiple GPU rows", () => {
    expect(parseNvidiaSmi("88, 12000, 24576, 71\n5, 300, 24576, 42")).toEqual([
      {
        index: 0,
        utilizationPercent: 88,
        memoryUsedMb: 12000,
        memoryTotalMb: 24576,
        temperatureC: 71
      },
      {
        index: 1,
        utilizationPercent: 5,
        memoryUsedMb: 300,
        memoryTotalMb: 24576,
        temperatureC: 42
      }
    ]);
  });

  it("returns an empty list for no GPU output", () => {
    expect(parseNvidiaSmi("")).toEqual([]);
  });
});
