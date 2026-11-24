import { api } from "../lib/api";
import type { AvatarConfig } from "./avatar";
import type { GameState, MemoryResult, MemorySession, Resources } from "./types";

export const gameKeys = {
  state: (memberId: string) => ["game", "state", memberId] as const,
};

export const gameApi = {
  state: (memberId: string) => api.get<GameState>("/game/state", { memberId }),
  setAvatar: (memberId: string, avatar: AvatarConfig) => api.put<{ avatar: AvatarConfig }>("/game/avatar", { memberId, avatar }),
  accept: (memberId: string, key: string) => api.post(`/game/quests/${encodeURIComponent(key)}/accept`, { memberId }),
  cancel: (memberId: string, key: string) => api.post(`/game/quests/${encodeURIComponent(key)}/cancel`, { memberId }),
  claim: (memberId: string, key: string) =>
    api.post<{ reward: Resources }>(`/game/quests/${encodeURIComponent(key)}/claim`, { memberId }),
  claimChest: (memberId: string) => api.post<{ reward: Resources }>("/game/daily-chest/claim", { memberId }),
  startMemory: (memberId: string, level: number) =>
    api.post<MemorySession>("/game/minigames/memory/start", { memberId, level }),
  finishMemory: (memberId: string, sessionId: string, flips: number[]) =>
    api.post<MemoryResult>(`/game/minigames/memory/${sessionId}/finish`, { memberId, flips }),
  /** The existing Tasks workflow; the game never writes completions any other way. */
  completeTask: (memberId: string, taskId: string, completedOn: string) =>
    api.post("/task-completions", { taskId, memberId, completedOn }),
};

/**
 * What the game UI needs from a data source. Signed-in players use the API
 * (authoritative, persisted); guests use a local engine (see guest.ts).
 */
export interface GameBackend {
  key: readonly unknown[];
  guest: boolean;
  state: () => Promise<GameState>;
  setAvatar: (avatar: AvatarConfig) => Promise<unknown>;
  accept: (key: string) => Promise<unknown>;
  cancel: (key: string) => Promise<unknown>;
  claim: (key: string) => Promise<{ reward: Resources }>;
  claimChest: () => Promise<{ reward: Resources }>;
  startMemory: (level: number) => Promise<MemorySession>;
  finishMemory: (sessionId: string, flips: number[]) => Promise<MemoryResult>;
  completeTask?: (taskId: string, completedOn: string) => Promise<unknown>;
}

export function serverBackend(memberId: string): GameBackend {
  return {
    key: gameKeys.state(memberId),
    guest: false,
    state: () => gameApi.state(memberId),
    setAvatar: (a) => gameApi.setAvatar(memberId, a),
    accept: (k) => gameApi.accept(memberId, k),
    cancel: (k) => gameApi.cancel(memberId, k),
    claim: (k) => gameApi.claim(memberId, k),
    claimChest: () => gameApi.claimChest(memberId),
    startMemory: (l) => gameApi.startMemory(memberId, l),
    finishMemory: (s, f) => gameApi.finishMemory(memberId, s, f),
    completeTask: (taskId, on) => gameApi.completeTask(memberId, taskId, on),
  };
}
