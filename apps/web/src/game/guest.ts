// Guest mode: play without an account. Progress lives only in this browser's
// localStorage and never reaches the API, so nothing here can affect a real
// family's data or rewards. Rules mirror apps/api/src/game (the source of
// truth for signed-in play); keep the two in step when tuning numbers.

import { ApiError } from "../lib/api";
import type { AvatarConfig } from "./avatar";
import type { GameBackend } from "./gameApi";
import type { GameState, LevelInfo, MemoryResult, MemorySession, Quest, Resources, ZoneKey } from "./types";

const STORE_KEY = "fh.guest.v1";
export const GUEST_ID = "guest";

const ZERO: Resources = { xp: 0, coins: 0, crystals: 0, materials: 0 };
const CHEST: Resources = { xp: 5, coins: 10, crystals: 0, materials: 2 };
const ZONES: Record<ZoneKey, number> = { village: 1, academy: 1, forest: 3, home: 2 };
const MEMORY_LEVELS = [
  { level: 1, pairs: 6, cols: 4 },
  { level: 2, pairs: 8, cols: 4 },
  { level: 3, pairs: 10, cols: 5 },
];
const MIN_MS_PER_PAIR = 600;

type QuestDef = Omit<Quest, "status" | "params"> & { prerequisites: string[] };
const QUESTS: QuestDef[] = [
  {
    key: "story.welcome", kind: "story", npc: "guide", repeat: "once",
    objective: { type: "talk", npc: "guide" }, reward: { xp: 20, coins: 10, crystals: 0, materials: 0 },
    prerequisites: [], titleKey: "game.quest.welcome.title", descKey: "game.quest.welcome.desc",
  },
  {
    key: "story.academy", kind: "story", npc: "owl", repeat: "once",
    objective: { type: "minigame", game: "memory", minLevel: 1 }, reward: { xp: 50, coins: 10, crystals: 5, materials: 0 },
    prerequisites: ["story.welcome"], titleKey: "game.quest.academy.title", descKey: "game.quest.academy.desc",
  },
  {
    key: "daily.memory", kind: "daily", npc: "owl", repeat: "daily",
    objective: { type: "minigame", game: "memory", minLevel: 1 }, reward: { xp: 15, coins: 10, crystals: 2, materials: 0 },
    prerequisites: ["story.academy"], titleKey: "game.quest.dailyMemory.title", descKey: "game.quest.dailyMemory.desc",
  },
];

interface Store {
  v: 1;
  avatar: AvatarConfig;
  /** sourceKey -> grant; one entry per key makes claims idempotent. */
  ledger: Record<string, Resources>;
  /** "questKey|period" -> progress */
  quests: Record<string, { status: "active" | "rewarded" | "cancelled"; acceptedAt: number }>;
  wins: { level: number; finishedAt: number; score: number }[];
}

const DEFAULT_AVATAR: AvatarConfig = {
  v: 1, skin: "#eab68f", hair: "short", hairColor: "#6b3e1f", outfit: "#3b82f6", accessory: "cap",
};

function load(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      if (s?.v === 1) return s;
    }
  } catch {
    // storage blocked or corrupt: start fresh
  }
  return { v: 1, avatar: DEFAULT_AVATAR, ledger: {}, quests: {}, wins: [] };
}

function save(s: Store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    // private mode: progress lasts for this page only
  }
}

const fail = (code: string) => new ApiError(400, "error", code);

function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function levelForXp(xp: number, scale = 1): LevelInfo {
  const at = (l: number) => 50 * l * (l - 1) * scale;
  let level = 1;
  while (at(level + 1) <= xp) level++;
  return { level, xp, intoLevel: xp - at(level), span: at(level + 1) - at(level) };
}

function totals(s: Store): Resources {
  return Object.values(s.ledger).reduce<Resources>(
    (a, r) => ({ xp: a.xp + r.xp, coins: a.coins + r.coins, crystals: a.crystals + r.crystals, materials: a.materials + r.materials }),
    { ...ZERO },
  );
}

function grant(s: Store, sourceKey: string, reward: Resources): boolean {
  if (s.ledger[sourceKey]) return false;
  s.ledger[sourceKey] = reward;
  return true;
}

function period(def: QuestDef, today: string) {
  return def.repeat === "daily" ? today : "once";
}

function status(s: Store, def: QuestDef, today: string): Quest["status"] {
  const p = s.quests[`${def.key}|${period(def, today)}`];
  if (p?.status === "rewarded") return "rewarded";
  if (p?.status === "active") {
    const obj = def.objective;
    const met =
      obj.type === "talk" ||
      (obj.type === "minigame" && s.wins.some((w) => w.level >= obj.minLevel && w.finishedAt >= p.acceptedAt));
    return met ? "completed" : "active";
  }
  const done = (k: string) => s.quests[`${k}|once`]?.status === "rewarded";
  return def.prerequisites.every(done) ? "available" : "locked";
}

function stateOf(s: Store, name: string): GameState {
  const today = localDate();
  const resources = totals(s);
  const level = levelForXp(resources.xp);
  const maxWon = s.wins.reduce((a, w) => Math.max(a, w.level), 0);
  const me = { memberId: GUEST_ID, name, role: "child" as const, color: "#3b82f6", avatar: s.avatar };
  return {
    today,
    player: {
      ...me,
      resources,
      level,
      zones: (Object.keys(ZONES) as ZoneKey[]).filter((z) => ZONES[z] <= level.level),
    },
    family: { name, level: levelForXp(resources.xp, 3), members: [{ ...me, level: level.level }] },
    quests: QUESTS.map((def) => ({ ...def, params: {}, status: status(s, def, today) })),
    dailyChest: { claimed: !!s.ledger[`daily:${today}`], reward: CHEST },
    memory: {
      levels: MEMORY_LEVELS.map((l) => ({
        ...l,
        unlocked: l.level <= maxWon + 1,
        rewardedToday: !!s.ledger[`minigame:memory:${today}:L${l.level}`],
        best: s.wins.filter((w) => w.level === l.level).reduce((a, w) => Math.max(a, w.score), 0),
        reward: memoryReward(l.level),
      })),
    },
  };
}

function memoryReward(level: number): Resources {
  return { xp: 15 + 10 * level, coins: 5 * level, crystals: level, materials: 0 };
}

export function guestBackend(name: string): GameBackend {
  const sessions = new Map<string, { level: number; deck: number[]; startedAt: number }>();
  const withStore = <T>(fn: (s: Store) => T): Promise<T> => {
    try {
      const s = load();
      const out = fn(s);
      save(s);
      return Promise.resolve(out);
    } catch (e) {
      return Promise.reject(e);
    }
  };
  const findDef = (key: string) => {
    const def = QUESTS.find((q) => q.key === key);
    if (!def) throw fail("quest_not_found");
    return def;
  };

  return {
    key: ["game", "guest"],
    guest: true,
    state: () => withStore((s) => stateOf(s, name)),
    setAvatar: (avatar) => withStore((s) => (s.avatar = avatar)),
    accept: (key) =>
      withStore((s) => {
        const def = findDef(key);
        const st = status(s, def, localDate());
        if (st !== "available") throw fail(`quest_${st}`);
        s.quests[`${def.key}|${period(def, localDate())}`] = { status: "active", acceptedAt: Date.now() };
      }),
    cancel: (key) =>
      withStore((s) => {
        const def = findDef(key);
        const p = s.quests[`${def.key}|${period(def, localDate())}`];
        if (p?.status !== "active") throw fail("quest_not_active");
        p.status = "cancelled";
      }),
    claim: (key) =>
      withStore((s) => {
        const def = findDef(key);
        const today = localDate();
        const st = status(s, def, today);
        if (st === "rewarded") throw fail("already_claimed");
        if (st !== "completed") throw fail("quest_not_completed");
        const p = period(def, today);
        if (!grant(s, `quest:${def.key}:${p}`, def.reward)) throw fail("already_claimed");
        s.quests[`${def.key}|${p}`]!.status = "rewarded";
        return { reward: def.reward };
      }),
    claimChest: () =>
      withStore((s) => {
        if (!grant(s, `daily:${localDate()}`, CHEST)) throw fail("already_claimed");
        return { reward: CHEST };
      }),
    startMemory: (level) =>
      withStore((s): MemorySession => {
        const cfg = MEMORY_LEVELS.find((l) => l.level === level);
        if (!cfg) throw fail("invalid_level");
        if (level > 1 && !s.wins.some((w) => w.level >= level - 1)) throw fail("level_locked");
        const deck: number[] = [];
        for (let i = 0; i < cfg.pairs; i++) deck.push(i, i);
        for (let i = deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [deck[i], deck[j]] = [deck[j]!, deck[i]!];
        }
        const sessionId = `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        sessions.set(sessionId, { level, deck, startedAt: Date.now() });
        return { sessionId, level, pairs: cfg.pairs, cols: cfg.cols, deck };
      }),
    finishMemory: (sessionId, flips) =>
      withStore((s): MemoryResult => {
        const session = sessions.get(sessionId);
        if (!session) throw fail("session_finished");
        sessions.delete(sessionId);
        const cfg = MEMORY_LEVELS.find((l) => l.level === session.level)!;
        const durationMs = Date.now() - session.startedAt;
        const matched = new Set<number>();
        let moves = 0;
        for (let i = 0; i + 1 < flips.length; i += 2) {
          const a = flips[i]!;
          const b = flips[i + 1]!;
          moves++;
          if (a !== b && !matched.has(a) && !matched.has(b) && session.deck[a] === session.deck[b]) {
            matched.add(a);
            matched.add(b);
          }
        }
        const tooFast = durationMs < cfg.pairs * MIN_MS_PER_PAIR;
        const won = matched.size === session.deck.length && !tooFast;
        if (!won) return { won: false, moves, score: 0, durationMs, reward: null, error: tooFast ? "too_fast" : null };
        const extra = Math.max(0, moves - cfg.pairs);
        const score = Math.max(10 * cfg.pairs, 100 * cfg.pairs * cfg.level - extra * 15 - Math.round(durationMs / 1000) * 2);
        s.wins.push({ level: cfg.level, finishedAt: Date.now(), score });
        const reward = memoryReward(cfg.level);
        const fresh = grant(s, `minigame:memory:${localDate()}:L${cfg.level}`, reward);
        return { won: true, moves, score, durationMs, reward: fresh ? reward : null, error: null };
      }),
  };
}
