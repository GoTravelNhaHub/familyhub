// Learning Academy achievements (authoritative). Granted as `achievement:<key>`
// rows in game_ledger, so each unlock pays out at most once. The web guest
// engine mirrors these rules from @family-hub/core (the API cannot import that
// TS-only package at runtime); achievements.test.ts keeps the two in step.

export interface AchievementReward {
  xp: number;
  coins: number;
  crystals: number;
  materials: number;
}

/** One finished, accepted memory win. `day` is the family-local date (YYYY-MM-DD). */
export interface MemoryWinRecord {
  level: number;
  pairs: number;
  moves: number;
  durationMs: number;
  day: string;
}

export interface AchievementDefinition {
  key: string;
  reward: AchievementReward;
  unlocked: (wins: MemoryWinRecord[]) => boolean;
}

const r = (xp: number, coins = 0, crystals = 0): AchievementReward => ({ xp, coins, crystals, materials: 0 });

/** Seconds per pair that counts as "quick". */
export const QUICK_MS_PER_PAIR = 4000;

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { key: "academy.first_crystal", reward: r(10, 5), unlocked: (w) => w.length > 0 },
  { key: "academy.scholar", reward: r(20, 0, 1), unlocked: (w) => w.some((x) => x.level >= 2) },
  { key: "academy.master", reward: r(40, 0, 3), unlocked: (w) => w.some((x) => x.level >= 3) },
  { key: "academy.flawless", reward: r(25, 0, 2), unlocked: (w) => w.some((x) => x.moves === x.pairs) },
  { key: "academy.quick", reward: r(15, 10), unlocked: (w) => w.some((x) => x.durationMs <= x.pairs * QUICK_MS_PER_PAIR) },
  { key: "academy.dedicated", reward: r(30, 15), unlocked: (w) => new Set(w.map((x) => x.day)).size >= 3 },
];

export function achievementSourceKey(key: string): string {
  return `achievement:${key}`;
}

/** Achievements the wins qualify for that are not in `alreadyGranted` (keys). */
export function newlyUnlocked(wins: MemoryWinRecord[], alreadyGranted: Iterable<string>): AchievementDefinition[] {
  const have = new Set(alreadyGranted);
  return ACHIEVEMENTS.filter((a) => !have.has(a.key) && a.unlocked(wins));
}
