// Response shapes of /api/game (apps/api/src/game). The server is
// authoritative for levels, quest status, and rewards; the client only renders.

import type { MemberRole } from "../lib/types";
import type { AvatarConfig } from "./avatar";

export interface Resources {
  xp: number;
  coins: number;
  crystals: number;
  materials: number;
}

export interface LevelInfo {
  level: number;
  xp: number;
  intoLevel: number;
  span: number;
}

export type ZoneKey = "village" | "academy" | "forest" | "home";
export type QuestNpc = "guide" | "owl" | "board";
export type QuestStatus = "locked" | "available" | "active" | "completed" | "rewarded";

export type QuestObjective =
  | { type: "talk"; npc: QuestNpc }
  | { type: "task"; taskId: string }
  | { type: "minigame"; game: "memory"; minLevel: number };

export interface Quest {
  key: string;
  kind: "story" | "daily" | "activity";
  npc: QuestNpc;
  repeat: "once" | "daily";
  titleKey: string;
  descKey: string;
  params: Record<string, string | number>;
  reward: Resources;
  objective: QuestObjective;
  status: QuestStatus;
}

export interface GameMember {
  memberId: string;
  name: string;
  role: MemberRole;
  color: string;
  avatar: AvatarConfig;
  level: number;
}

export interface MemoryLevelState {
  level: number;
  pairs: number;
  cols: number;
  unlocked: boolean;
  rewardedToday: boolean;
  best: number;
  reward: Resources;
}

export interface GameState {
  today: string;
  player: Omit<GameMember, "level"> & { resources: Resources; level: LevelInfo; zones: ZoneKey[] };
  family: { name: string; level: LevelInfo; members: GameMember[] };
  quests: Quest[];
  dailyChest: { claimed: boolean; reward: Resources };
  memory: { levels: MemoryLevelState[] };
}

export interface MemorySession {
  sessionId: string;
  level: number;
  pairs: number;
  cols: number;
  deck: number[];
}

export interface MemoryResult {
  won: boolean;
  moves: number;
  score: number;
  durationMs: number;
  reward: Resources | null;
  error: string | null;
}
