import { describe, expect, it } from "vitest";
import * as shared from "@family-hub/core";
import { ACHIEVEMENTS, newlyUnlocked, type MemoryWinRecord } from "./achievements";

const fixtures: MemoryWinRecord[][] = [
  [],
  [{ level: 1, pairs: 6, moves: 6, durationMs: 20_000, day: "2026-11-22" }],
  [
    { level: 2, pairs: 8, moves: 14, durationMs: 90_000, day: "2026-11-22" },
    { level: 3, pairs: 10, moves: 18, durationMs: 120_000, day: "2026-11-23" },
    { level: 1, pairs: 6, moves: 9, durationMs: 50_000, day: "2026-11-24" },
  ],
];

describe("achievements parity with the guest engine (@family-hub/core)", () => {
  it("defines the same keys and rewards", () => {
    const strip = (list: { key: string; reward: unknown }[]) => list.map(({ key, reward }) => ({ key, reward }));
    expect(strip(ACHIEVEMENTS)).toEqual(strip(shared.ACHIEVEMENTS));
  });

  it("unlocks the same achievements for the same wins", () => {
    for (const wins of fixtures) {
      expect(newlyUnlocked(wins, []).map((a) => a.key)).toEqual(shared.newlyUnlocked(wins, []).map((a) => a.key));
    }
  });
});
