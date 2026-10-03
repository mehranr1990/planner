import { describe, expect, it } from "vitest";
import { AVATAR_TONES, avatarTone, initialsOf, splitPeople } from "../people";

describe("initialsOf", () => {
  it("takes first and last word initials", () => {
    expect(initialsOf("Mina Rahimi")).toBe("MR");
    expect(initialsOf("ada lovelace byron")).toBe("AB");
    expect(initialsOf("Cher")).toBe("C");
  });

  it("works for Persian and other scripts", () => {
    expect(initialsOf("مینا رحیمی")).toBe("مر");
    expect(initialsOf("  علی  ")).toBe("ع");
  });

  it("can be limited to one letter for tiny faces", () => {
    expect(initialsOf("Mina Rahimi", 1)).toBe("M");
    expect(initialsOf("مینا رحیمی", 1)).toBe("م");
  });

  it("keeps astral code points intact and never returns empty", () => {
    expect(initialsOf("😀 Smile")).toBe("😀S");
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
  });
});

describe("avatarTone", () => {
  it("is stable per id and always a known pastel tone", () => {
    expect(avatarTone("user_123")).toBe(avatarTone("user_123"));
    for (const id of ["a", "b", "cmupgcw72000ivwvs0vv5t0r3", ""]) expect(AVATAR_TONES).toContain(avatarTone(id));
  });

  it("spreads ids across tones", () => {
    const tones = new Set(Array.from({ length: 50 }, (_, i) => avatarTone(`user-${i}`)));
    expect(tones.size).toBeGreaterThanOrEqual(4);
  });
});

describe("splitPeople", () => {
  const five = ["a", "b", "c", "d", "e"];

  it("shows everyone when within the limit", () => {
    expect(splitPeople(five, 5)).toEqual({ visible: five, overflow: 0 });
  });

  it("collapses the rest into +N", () => {
    expect(splitPeople(five, 3)).toEqual({ visible: ["a", "b", "c"], overflow: 2 });
  });

  it("shows the face instead of a '+1' chip", () => {
    expect(splitPeople(["a", "b", "c", "d"], 3)).toEqual({ visible: ["a", "b", "c", "d"], overflow: 0 });
  });

  it("counts people beyond the loaded preview", () => {
    // 5 loaded of 23 members, room for 4 faces.
    expect(splitPeople(five, 4, 23)).toEqual({ visible: ["a", "b", "c", "d"], overflow: 19 });
    // Preview exactly at the limit but more exist: can't show an unloaded face, so +N.
    expect(splitPeople(["a", "b", "c"], 3, 4)).toEqual({ visible: ["a", "b", "c"], overflow: 1 });
  });

  it("handles empty and degenerate limits", () => {
    expect(splitPeople([], 3)).toEqual({ visible: [], overflow: 0 });
    expect(splitPeople(five, 0)).toEqual({ visible: ["a"], overflow: 4 });
  });
});
