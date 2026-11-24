/**
 * Pure progression rules for the adventure game. Kept free of Prisma so the
 * curve, unlocks, and family-local dates are unit-testable.
 */

export interface Resources {
  xp: number;
  coins: number;
  crystals: number;
  materials: number;
}

export const EMPTY_RESOURCES: Resources = { xp: 0, coins: 0, crystals: 0, materials: 0 };

export interface LevelInfo {
  level: number;
  xp: number;
  /** XP earned since the current level started. */
  intoLevel: number;
  /** XP span of the current level (distance to the next one). */
  span: number;
}

/** Total XP needed to reach `level` (level 1 = 0, 2 = 100, 3 = 300, 4 = 600 ...). */
export function xpForLevel(level: number, scale = 1): number {
  return 50 * level * (level - 1) * scale;
}

export function levelForXp(xp: number, scale = 1): LevelInfo {
  const safe = Math.max(0, Math.floor(xp));
  let level = 1;
  while (xpForLevel(level + 1, scale) <= safe) level++;
  const start = xpForLevel(level, scale);
  return { level, xp: safe, intoLevel: safe - start, span: xpForLevel(level + 1, scale) - start };
}

/** Family level grows on the combined XP of every member, on a 3x slower curve. */
export const FAMILY_LEVEL_SCALE = 3;

export type ZoneKey = "village" | "academy" | "forest" | "home";

/** Player level at which each zone opens. */
export const ZONE_UNLOCK_LEVEL: Record<ZoneKey, number> = {
  village: 1,
  academy: 1,
  forest: 3,
  home: 2,
};

export function unlockedZones(level: number): ZoneKey[] {
  return (Object.keys(ZONE_UNLOCK_LEVEL) as ZoneKey[]).filter((z) => ZONE_UNLOCK_LEVEL[z] <= level);
}

export function sumResources(rows: Partial<Resources>[]): Resources {
  return rows.reduce<Resources>(
    (acc, r) => ({
      xp: acc.xp + (r.xp ?? 0),
      coins: acc.coins + (r.coins ?? 0),
      crystals: acc.crystals + (r.crystals ?? 0),
      materials: acc.materials + (r.materials ?? 0),
    }),
    { ...EMPTY_RESOURCES },
  );
}

/** "YYYY-MM-DD" for `now` in the given IANA timezone. */
export function dateInTz(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** ISO weekday (Mon = 1 ... Sun = 7) of a "YYYY-MM-DD" date. */
export function isoWeekdayOf(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}
