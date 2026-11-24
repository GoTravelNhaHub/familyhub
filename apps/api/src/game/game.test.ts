import { describe, expect, it } from "vitest";
import { dateInTz, isoWeekdayOf, levelForXp, sumResources, unlockedZones, xpForLevel } from "./progression";
import { questSourceKey, questStatus, STATIC_QUESTS, taskQuest, themeForTask } from "./quests";
import { dealDeck, memoryScore, MEMORY_LEVELS, replayFlips } from "./memory";
import { avatarSchema, defaultAvatar, readAvatar } from "./avatar";

describe("progression", () => {
  it("uses a triangular XP curve", () => {
    expect([1, 2, 3, 4].map((l) => xpForLevel(l))).toEqual([0, 100, 300, 600]);
    expect(levelForXp(0)).toEqual({ level: 1, xp: 0, intoLevel: 0, span: 100 });
    expect(levelForXp(99).level).toBe(1);
    expect(levelForXp(100)).toEqual({ level: 2, xp: 100, intoLevel: 0, span: 200 });
    expect(levelForXp(350)).toMatchObject({ level: 3, intoLevel: 50, span: 300 });
    expect(levelForXp(300, 3).level).toBe(2);
  });

  it("unlocks zones by level", () => {
    expect(unlockedZones(1)).toEqual(["village", "academy"]);
    expect(unlockedZones(3)).toContain("forest");
  });

  it("sums resources and handles family timezones", () => {
    expect(sumResources([{ xp: 5, coins: 1 }, { xp: 2, crystals: 3 }])).toEqual({
      xp: 7, coins: 1, crystals: 3, materials: 0,
    });
    const instant = new Date("2026-11-23T20:00:00Z");
    expect(dateInTz(instant, "UTC")).toBe("2026-11-23");
    expect(dateInTz(instant, "Asia/Ho_Chi_Minh")).toBe("2026-11-24");
    expect(dateInTz(instant, "Not/AZone")).toBe("2026-11-23");
    expect(isoWeekdayOf("2026-11-23")).toBe(1);
    expect(isoWeekdayOf("2026-11-29")).toBe(7);
  });
});

describe("quests", () => {
  const welcome = STATIC_QUESTS.find((q) => q.key === "story.welcome")!;
  const academy = STATIC_QUESTS.find((q) => q.key === "story.academy")!;
  const daily = STATIC_QUESTS.find((q) => q.key === "daily.memory")!;

  it("walks the lifecycle available -> active -> completed -> rewarded", () => {
    const none = new Set<string>();
    expect(questStatus({ def: welcome, progress: undefined, conditionMet: false, rewardedOnce: none })).toBe("available");
    expect(questStatus({ def: welcome, progress: { status: "active" }, conditionMet: false, rewardedOnce: none })).toBe("active");
    expect(questStatus({ def: welcome, progress: { status: "active" }, conditionMet: true, rewardedOnce: none })).toBe("completed");
    expect(questStatus({ def: welcome, progress: { status: "rewarded" }, conditionMet: true, rewardedOnce: none })).toBe("rewarded");
    expect(questStatus({ def: welcome, progress: { status: "cancelled" }, conditionMet: true, rewardedOnce: none })).toBe("available");
  });

  it("locks quests until prerequisites are rewarded", () => {
    expect(questStatus({ def: academy, progress: undefined, conditionMet: false, rewardedOnce: new Set() })).toBe("locked");
    expect(
      questStatus({ def: academy, progress: undefined, conditionMet: false, rewardedOnce: new Set(["story.welcome"]) }),
    ).toBe("available");
  });

  it("keys ledger grants per period so rewards cannot repeat", () => {
    expect(questSourceKey(welcome, "2026-11-23")).toBe("quest:story.welcome:once");
    expect(questSourceKey(daily, "2026-11-23")).toBe("quest:daily.memory:2026-11-23");
    expect(questSourceKey(daily, "2026-11-24")).not.toBe(questSourceKey(daily, "2026-11-23"));
  });

  it("turns tasks into themed quests scaled by stars", () => {
    expect(themeForTask({ title: "Read for 20 minutes", icon: "✅" })).toBe("library");
    expect(themeForTask({ title: "Something", icon: "🪥" })).toBe("spring");
    expect(themeForTask({ title: "Dọn phòng", icon: "✅" })).toBe("builder");
    expect(themeForTask({ title: "Practice piano", icon: "✅" })).toBe("helper");
    const q = taskQuest({ id: "t1", title: "Read for 20 minutes", icon: "📚", stars: 2 });
    expect(q).toMatchObject({
      key: "task.t1",
      repeat: "daily",
      objective: { type: "task", taskId: "t1" },
      reward: { xp: 20, coins: 10, crystals: 4, materials: 2 },
      titleKey: "game.theme.library.title",
    });
  });
});

describe("memory crystal challenge", () => {
  it("deals every symbol exactly twice", () => {
    const deck = dealDeck(6);
    expect(deck).toHaveLength(12);
    for (let i = 0; i < 6; i++) expect(deck.filter((x) => x === i)).toHaveLength(2);
  });

  it("accepts only flip sequences that clear the board", () => {
    const deck = [0, 1, 0, 1];
    expect(replayFlips(deck, [0, 2, 1, 3])).toEqual({ won: true, moves: 2 });
    expect(replayFlips(deck, [0, 1, 0, 2, 1, 3])).toEqual({ won: true, moves: 3 });
    expect(replayFlips(deck, [0, 2])).toEqual({ won: false, moves: 1 });
    expect(replayFlips(deck, [0, 0, 1, 3]).error).toBe("invalid_flip");
    expect(replayFlips(deck, [0, 2, 0, 2, 1, 3]).error).toBe("invalid_flip");
    expect(replayFlips(deck, [0, 9]).error).toBe("invalid_flip");
    expect(replayFlips(deck, [0]).error).toBe("odd_flips");
  });

  it("scores fewer moves and faster times higher, with a floor", () => {
    const l1 = MEMORY_LEVELS[0]!;
    expect(memoryScore(l1, 6, 10_000)).toBeGreaterThan(memoryScore(l1, 12, 10_000));
    expect(memoryScore(l1, 6, 10_000)).toBeGreaterThan(memoryScore(l1, 6, 60_000));
    expect(memoryScore(l1, 500, 3_600_000)).toBe(60);
  });
});

describe("avatar", () => {
  it("validates and falls back to a deterministic default", () => {
    const d = defaultAvatar("member-1", "child");
    expect(avatarSchema.safeParse(d).success).toBe(true);
    expect(defaultAvatar("member-1", "child")).toEqual(d);
    expect(readAvatar({ v: 1, skin: "red" }, "member-1", "child")).toEqual(d);
    expect(defaultAvatar("member-1", "parent").accessory).toBe("glasses");
  });
});
