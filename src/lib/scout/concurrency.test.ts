import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapWithConcurrency } from "./concurrency";

describe("mapWithConcurrency", () => {
  it("preserves input order regardless of completion order", async () => {
    const delays = [30, 5, 20, 1, 15];
    const result = await mapWithConcurrency(delays, 3, async (ms, index) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return index;
    });
    assert.deepEqual(result, [0, 1, 2, 3, 4]);
  });

  it("never runs more than the given concurrency at once", async () => {
    let active = 0;
    let maxActive = 0;
    await mapWithConcurrency(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    });
    assert.ok(maxActive <= 3, `expected max concurrency <= 3, saw ${maxActive}`);
  });

  it("handles an empty input without hanging", async () => {
    const result = await mapWithConcurrency([], 4, async () => 1);
    assert.deepEqual(result, []);
  });
});
