// "Continue playing" memory: which world this browser opened last. Per-viewer
// convenience only; the server stays the source of truth for progress.

const KEY = "fh.platform.recent";

export interface RecentPlay {
  worldId: string;
  at: number;
}

export function readRecent(): RecentPlay[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((r): r is RecentPlay => typeof r?.worldId === "string" && typeof r?.at === "number")
      : [];
  } catch {
    return [];
  }
}

export function markPlayed(worldId: string) {
  try {
    const next = [{ worldId, at: Date.now() }, ...readRecent().filter((r) => r.worldId !== worldId)].slice(0, 8);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage blocked: nothing to remember
  }
}
