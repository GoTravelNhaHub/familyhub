import type { Resources } from "./progression";

/**
 * Data-driven quest definitions. Static quests live here; activity quests are
 * derived on the fly from the family's existing tasks (no duplicated rows), so
 * the Tasks page stays the single source of truth for real-world activities.
 *
 * Lifecycle: available -> active (accepted) -> completed (condition met,
 * computed) -> rewarded (claimed once, enforced by game_ledger uniqueness).
 * Daily quests are keyed by the family-local date, so yesterday's rows simply
 * expire.
 */

export type QuestKind = "story" | "daily" | "activity";
export type QuestRepeat = "once" | "daily";
export type QuestNpc = "guide" | "owl" | "board";
export type QuestStatus = "locked" | "available" | "active" | "completed" | "rewarded";

export type QuestObjective =
  | { type: "talk"; npc: QuestNpc }
  | { type: "task"; taskId: string }
  | { type: "minigame"; game: "memory"; minLevel: number };

export interface QuestDef {
  key: string;
  kind: QuestKind;
  npc: QuestNpc;
  repeat: QuestRepeat;
  objective: QuestObjective;
  reward: Resources;
  prerequisites: string[];
  /** i18n keys (packages/core/src/i18n) plus interpolation params. */
  titleKey: string;
  descKey: string;
  params?: Record<string, string | number>;
}

export const STATIC_QUESTS: QuestDef[] = [
  {
    key: "story.welcome",
    kind: "story",
    npc: "guide",
    repeat: "once",
    objective: { type: "talk", npc: "guide" },
    reward: { xp: 20, coins: 10, crystals: 0, materials: 0 },
    prerequisites: [],
    titleKey: "game.quest.welcome.title",
    descKey: "game.quest.welcome.desc",
  },
  {
    key: "story.academy",
    kind: "story",
    npc: "owl",
    repeat: "once",
    objective: { type: "minigame", game: "memory", minLevel: 1 },
    reward: { xp: 50, coins: 10, crystals: 5, materials: 0 },
    prerequisites: ["story.welcome"],
    titleKey: "game.quest.academy.title",
    descKey: "game.quest.academy.desc",
  },
  {
    key: "daily.memory",
    kind: "daily",
    npc: "owl",
    repeat: "daily",
    objective: { type: "minigame", game: "memory", minLevel: 1 },
    reward: { xp: 15, coins: 10, crystals: 2, materials: 0 },
    prerequisites: ["story.academy"],
    titleKey: "game.quest.dailyMemory.title",
    descKey: "game.quest.dailyMemory.desc",
  },
];

export type QuestTheme = "library" | "spring" | "builder" | "garden" | "animals" | "expedition" | "helper";

const THEME_RULES: { theme: QuestTheme; icons: string[]; words: RegExp }[] = [
  { theme: "library", icons: ["📚"], words: /read|book|homework|study|học|đọc|读|书|作业/i },
  { theme: "spring", icons: ["🪥", "🚿"], words: /brush|teeth|shower|bath|wash|đánh răng|tắm|刷牙|洗/i },
  { theme: "builder", icons: ["🧹", "🛏️", "🧦"], words: /clean|tidy|bed|room|laundry|dish|dọn|giường|打扫|整理|床/i },
  { theme: "garden", icons: ["🍎", "🥦"], words: /eat|fruit|veg|garden|plant|ăn|rau|吃|菜|水果/i },
  { theme: "animals", icons: ["🐶"], words: /dog|cat|pet|feed|chó|mèo|狗|猫|喂/i },
  { theme: "expedition", icons: ["🎒", "🚶"], words: /bag|walk|school|cặp|đi bộ|书包|散步/i },
];

export function themeForTask(task: { title: string; icon: string }): QuestTheme {
  for (const rule of THEME_RULES) {
    if (rule.icons.includes(task.icon) || rule.words.test(task.title)) return rule.theme;
  }
  return "helper";
}

/** Narrative quest for one real-world task. Rewards scale with the task's stars. */
export function taskQuest(task: { id: string; title: string; icon: string; stars: number }): QuestDef {
  const theme = themeForTask(task);
  const s = Math.max(1, Math.min(task.stars, 10));
  return {
    key: `task.${task.id}`,
    kind: "activity",
    npc: "board",
    repeat: "daily",
    objective: { type: "task", taskId: task.id },
    reward: {
      xp: 10 * s,
      coins: 5 * s,
      crystals: theme === "library" ? 2 * s : 0,
      materials: theme === "builder" ? 2 * s : s,
    },
    prerequisites: [],
    titleKey: `game.theme.${theme}.title`,
    descKey: `game.theme.${theme}.desc`,
    params: { task: task.title, icon: task.icon },
  };
}

export function periodKeyFor(def: QuestDef, today: string): string {
  return def.repeat === "daily" ? today : "once";
}

/** Idempotency key for the reward ledger. */
export function questSourceKey(def: QuestDef, today: string): string {
  return `quest:${def.key}:${periodKeyFor(def, today)}`;
}

export function questStatus(args: {
  def: QuestDef;
  progress: { status: "active" | "rewarded" | "cancelled" } | undefined;
  conditionMet: boolean;
  rewardedOnce: Set<string>;
}): QuestStatus {
  const { def, progress, conditionMet, rewardedOnce } = args;
  if (progress?.status === "rewarded") return "rewarded";
  if (progress?.status === "active") return conditionMet ? "completed" : "active";
  if (!def.prerequisites.every((p) => rewardedOnce.has(p))) return "locked";
  return "available";
}
