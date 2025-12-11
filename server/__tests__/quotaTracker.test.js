import { describe, it, expect, beforeEach } from "vitest";
const quotaTracker = require("../utils/quotaTracker");

describe("quotaTracker", () => {
  beforeEach(() => {
    quotaTracker._forceRotateForTesting();
  });

  it("should initialize with zero calls", () => {
    const status = quotaTracker.getStatus();
    expect(status.callCount).toBe(0);
    expect(status.availableQuota).toBe(20);
    expect(status.percentUsed).toBe(0);
  });

  it("should record calls and decrement available quota", () => {
    quotaTracker.recordCall();
    quotaTracker.recordCall();
    quotaTracker.recordCall();

    const status = quotaTracker.getStatus();
    expect(status.callCount).toBe(3);
    expect(status.availableQuota).toBe(17);
    expect(Math.round(status.percentUsed)).toBe(15);
  });

  it("should rotate window when expired", () => {
    // Record 5 calls
    for (let i = 0; i < 5; i++) {
      quotaTracker.recordCall();
    }
    expect(quotaTracker.getStatus().callCount).toBe(5);

    // Force rotation
    quotaTracker._forceRotateForTesting();

    // Should reset to 0
    const status = quotaTracker.getStatus();
    expect(status.callCount).toBe(0);
    expect(status.availableQuota).toBe(20);
  });
});
