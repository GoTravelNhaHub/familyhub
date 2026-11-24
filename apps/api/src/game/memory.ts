import { randomInt } from "crypto";
import type { Resources } from "./progression";

/**
 * Memory Crystal Challenge. The server deals the deck and replays the client's
 * flip sequence, so a "win" is only accepted if the flips actually clear the
 * board. Rewards are capped at one per level per family-local day.
 */

export interface MemoryLevel {
  level: number;
  pairs: number;
  cols: number;
}

export const MEMORY_LEVELS: MemoryLevel[] = [
  { level: 1, pairs: 6, cols: 4 },
  { level: 2, pairs: 8, cols: 4 },
  { level: 3, pairs: 10, cols: 5 },
];

/** Fastest plausible human time per pair; faster submissions are rejected. */
export const MIN_MS_PER_PAIR = 600;

export function memoryLevel(level: number): MemoryLevel | undefined {
  return MEMORY_LEVELS.find((l) => l.level === level);
}

export function dealDeck(pairs: number, rand: (n: number) => number = randomInt): number[] {
  const deck: number[] = [];
  for (let i = 0; i < pairs; i++) deck.push(i, i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

export interface ReplayResult {
  won: boolean;
  moves: number;
  error?: string;
}

/** `flips` is the ordered list of card indexes the player turned, two per move. */
export function replayFlips(deck: number[], flips: number[]): ReplayResult {
  if (flips.length % 2 !== 0) return { won: false, moves: 0, error: "odd_flips" };
  const matched = new Set<number>();
  let moves = 0;
  for (let i = 0; i < flips.length; i += 2) {
    const a = flips[i]!;
    const b = flips[i + 1]!;
    const valid = (x: number) => Number.isInteger(x) && x >= 0 && x < deck.length && !matched.has(x);
    if (a === b || !valid(a) || !valid(b)) return { won: false, moves, error: "invalid_flip" };
    moves++;
    if (deck[a] === deck[b]) {
      matched.add(a);
      matched.add(b);
    }
  }
  return { won: matched.size === deck.length, moves };
}

export function memoryScore(level: MemoryLevel, moves: number, durationMs: number): number {
  const extraMoves = Math.max(0, moves - level.pairs);
  const seconds = Math.round(durationMs / 1000);
  const base = 100 * level.pairs * level.level;
  return Math.max(10 * level.pairs, base - extraMoves * 15 - seconds * 2);
}

export function memoryReward(level: MemoryLevel): Resources {
  return { xp: 15 + 10 * level.level, coins: 5 * level.level, crystals: level.level, materials: 0 };
}

export function memorySourceKey(level: number, today: string): string {
  return `minigame:memory:${today}:L${level}`;
}
