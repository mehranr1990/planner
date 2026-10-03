import { describe, expect, it } from "vitest";
import { wouldCreateCycle } from "../dependencies";

const e = (blockingTaskId: string, blockedTaskId: string) => ({ blockingTaskId, blockedTaskId });

describe("wouldCreateCycle", () => {
  it("rejects self-dependency", () => {
    expect(wouldCreateCycle([], "a", "a")).toBe(true);
  });

  it("detects direct and transitive cycles", () => {
    expect(wouldCreateCycle([e("a", "b")], "b", "a")).toBe(true);
    expect(wouldCreateCycle([e("a", "b"), e("b", "c")], "c", "a")).toBe(true);
  });

  it("allows diamonds and unrelated edges", () => {
    const edges = [e("a", "b"), e("a", "c"), e("b", "d"), e("c", "d")];
    expect(wouldCreateCycle(edges, "a", "d")).toBe(false);
    expect(wouldCreateCycle(edges, "x", "a")).toBe(false);
  });
});
