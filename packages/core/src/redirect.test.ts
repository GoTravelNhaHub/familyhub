import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("keeps in-app paths", () => {
    expect(safeNextPath("/play")).toBe("/play");
    expect(safeNextPath("/family?tab=1")).toBe("/family?tab=1");
  });

  it("falls back for missing, external, or scheme targets", () => {
    for (const bad of [null, "", "play", "//evil.test", "/\\evil.test", "https://evil.test", "javascript:alert(1)", "/<script>"]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });
});
