import { describe, expect, it } from "vitest";
import { needsRebalance, rankBetween, reseedRun } from "../ranking";

describe("rankBetween", () => {
  it("places a lone row at 0", () => {
    expect(rankBetween(null, null)).toBe(0);
  });

  it("steps before the first row when dropped at the top", () => {
    expect(rankBetween(null, 100)).toBe(100 - 1024);
  });

  it("steps after the last row when dropped at the bottom", () => {
    expect(rankBetween(100, null)).toBe(100 + 1024);
  });

  it("takes the midpoint between two rows", () => {
    expect(rankBetween(100, 200)).toBe(150);
  });

  it("keeps halving cleanly across repeated inserts into the same gap", () => {
    let before = 100;
    const after = 200;
    for (let i = 0; i < 10; i++) {
      const mid = rankBetween(before, after);
      expect(mid).toBeGreaterThan(before);
      expect(mid).toBeLessThan(after);
      before = mid;
    }
  });
});

describe("needsRebalance", () => {
  it("is false at an open end", () => {
    expect(needsRebalance(null, 100)).toBe(false);
    expect(needsRebalance(100, null)).toBe(false);
    expect(needsRebalance(null, null)).toBe(false);
  });

  it("is true when both sides are equal (the degenerate all-default-0 case)", () => {
    expect(needsRebalance(0, 0)).toBe(true);
  });

  it("is true once the gap is squeezed below the tolerance", () => {
    expect(needsRebalance(100, 100 + 1e-9)).toBe(true);
  });

  it("is false for a normal, roomy gap", () => {
    expect(needsRebalance(100, 200)).toBe(false);
  });
});

describe("reseedRun", () => {
  it("spaces a run of siblings evenly, starting above the given floor", () => {
    expect(reseedRun(3, 100)).toEqual([100 + 1024, 100 + 2048, 100 + 3072]);
  });

  it("defaults the floor to 0", () => {
    expect(reseedRun(2)).toEqual([1024, 2048]);
  });
});
