import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, achievementSourceKey, newlyUnlocked, type MemoryWinRecord } from "./achievements";

const win = (o: Partial<MemoryWinRecord> = {}): MemoryWinRecord => ({
  level: 1, pairs: 6, moves: 10, durationMs: 60_000, day: "2026-11-24", ...o,
});
const keys = (w: MemoryWinRecord[], have: string[] = []) => newlyUnlocked(w, have).map((a) => a.key);

describe("academy achievements", () => {
  it("unlocks nothing without wins", () => {
    expect(keys([])).toEqual([]);
  });

  it("unlocks the first crystal on any win and level badges by highest level", () => {
    expect(keys([win()])).toEqual(["academy.first_crystal"]);
    expect(keys([win({ level: 3, pairs: 10, moves: 20 })])).toEqual(["academy.first_crystal", "academy.scholar", "academy.master"]);
  });

  it("rewards a flawless board (moves equal pairs) and a quick board", () => {
    expect(keys([win({ moves: 6 })])).toContain("academy.flawless");
    expect(keys([win({ durationMs: 6 * 4000 })])).toContain("academy.quick");
    expect(keys([win({ durationMs: 6 * 4000 + 1 })])).not.toContain("academy.quick");
  });

  it("needs wins on three different days for dedication", () => {
    const same = [win(), win(), win()];
    expect(keys(same)).not.toContain("academy.dedicated");
    const spread = [win({ day: "2026-11-22" }), win({ day: "2026-11-23" }), win()];
    expect(keys(spread)).toContain("academy.dedicated");
  });

  it("never re-grants an achievement already recorded", () => {
    expect(keys([win({ moves: 6 })], ["academy.first_crystal", "academy.flawless"])).toEqual([]);
  });

  it("has unique keys, ledger-safe source keys, and positive rewards", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.key)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(achievementSourceKey(a.key)).toBe(`achievement:${a.key}`);
      expect(a.reward.xp).toBeGreaterThan(0);
    }
  });
});
