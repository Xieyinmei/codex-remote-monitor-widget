import { describe, expect, it } from "vitest";
import { normalizeCodexQuota } from "./quota";

describe("quota normalization", () => {
  it("prefers the codex limit bucket", () => {
    const quota = normalizeCodexQuota({
      rateLimits: {
        primary: { usedPercent: 90, windowDurationMins: 60, resetsAt: 1 },
        secondary: null
      },
      rateLimitsByLimitId: {
        codex: {
          primary: { usedPercent: 37, windowDurationMins: 300, resetsAt: 1000 },
          secondary: { usedPercent: 26, windowDurationMins: 10080, resetsAt: 2000 },
          credits: { hasCredits: true, unlimited: false, balance: "10" },
          planType: "pro"
        }
      }
    });

    expect(quota?.shortWindow?.label).toBe("5小时");
    expect(quota?.shortWindow?.remainingPercent).toBe(63);
    expect(quota?.longWindow?.label).toBe("周限额");
    expect(quota?.longWindow?.remainingPercent).toBe(74);
    expect(quota?.credits?.balance).toBe("10");
  });
});
