// Data-driven layout of the Family Village. Scenes read this config; changing
// positions, adding decorations, or adding interactables does not touch scene code.

import type { InteractableId } from "./bridge";

export const WORLD_W = 1600;
export const WORLD_H = 1100;
/** Hedge line separating the village from the Adventure Forest. */
export const FOREST_FENCE_X = 1420;
export const PLAZA = { x: 800, y: 560, r: 96 };
export const SPAWN = { x: 800, y: 700 };

export const RIVER = {
  width: 64,
  bridgeY: 560,
  bridgeHalf: 44,
  xAt: (y: number) => 1180 + 28 * Math.sin(y / 150),
};

/** Polylines the ground renderer paints as sandy paths. */
export const PATHS: { width: number; points: [number, number][] }[] = [
  { width: 44, points: [[60, 560], [1560, 560]] },
  { width: 44, points: [[800, 280], [800, 1060]] },
  { width: 36, points: [[100, 930], [800, 930]] },
  { width: 30, points: [[120, 560], [120, 410]] },
  { width: 30, points: [[330, 560], [330, 410]] },
  { width: 30, points: [[540, 560], [540, 410]] },
  { width: 30, points: [[120, 930], [120, 790]] },
  { width: 30, points: [[330, 930], [330, 790]] },
  { width: 30, points: [[540, 930], [540, 790]] },
];

export type Prop =
  | { kind: "academy"; x: number; y: number }
  | { kind: "board"; x: number; y: number }
  | { kind: "chest"; x: number; y: number }
  | { kind: "fountain"; x: number; y: number }
  | { kind: "gate"; x: number; y: number }
  | { kind: "bridge"; x: number; y: number };

export const PROPS: Prop[] = [
  { kind: "academy", x: 800, y: 270 },
  { kind: "fountain", x: PLAZA.x, y: PLAZA.y + 18 },
  { kind: "board", x: 690, y: 500 },
  { kind: "chest", x: 905, y: 640 },
  { kind: "bridge", x: RIVER.xAt(RIVER.bridgeY), y: RIVER.bridgeY },
  { kind: "gate", x: FOREST_FENCE_X, y: 590 },
];

/** Family houses: one per member, in creation order. Base (door) position. */
export const HOUSE_SLOTS: { x: number; y: number }[] = [
  { x: 330, y: 410 },
  { x: 540, y: 410 },
  { x: 330, y: 790 },
  { x: 540, y: 790 },
  { x: 120, y: 410 },
  { x: 120, y: 790 },
];

export const NPCS: { id: "guide" | "owl"; x: number; y: number }[] = [
  { id: "guide", x: 885, y: 492 },
  { id: "owl", x: 880, y: 322 },
];

export interface Interactable {
  id: InteractableId;
  x: number;
  y: number;
  radius: number;
}

export const INTERACTABLES: Interactable[] = [
  { id: "guide", x: 885, y: 500, radius: 60 },
  { id: "owl", x: 880, y: 330, radius: 60 },
  { id: "board", x: 690, y: 515, radius: 64 },
  { id: "chest", x: 905, y: 650, radius: 56 },
  { id: "academy", x: 800, y: 290, radius: 56 },
  { id: "forestGate", x: FOREST_FENCE_X - 30, y: 566, radius: 70 },
];

/** Deterministic PRNG so the village looks the same for everyone, every visit. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function distToSegment(px: number, py: number, [ax, ay]: [number, number], [bx, by]: [number, number]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Keep-out test for scattered decorations. */
export function isOpenGround(x: number, y: number, margin = 0): boolean {
  if (x < 30 || y < 40 || x > WORLD_W - 30 || y > WORLD_H - 20) return false;
  for (const p of PATHS) {
    for (let i = 0; i < p.points.length - 1; i++) {
      if (distToSegment(x, y, p.points[i]!, p.points[i + 1]!) < p.width / 2 + 18 + margin) return false;
    }
  }
  if (Math.hypot(x - PLAZA.x, y - PLAZA.y) < PLAZA.r + 40 + margin) return false;
  if (Math.abs(x - RIVER.xAt(y)) < RIVER.width / 2 + 26 + margin) return false;
  if (Math.abs(x - 800) < 170 + margin && y > 90 && y < 360) return false; // academy
  if (Math.abs(x - FOREST_FENCE_X) < 34 + margin) return false;
  for (const h of HOUSE_SLOTS) if (Math.abs(x - h.x) < 80 + margin && y > h.y - 120 && y < h.y + 40) return false;
  for (const i of INTERACTABLES) if (Math.hypot(x - i.x, y - i.y) < i.radius + 20 + margin) return false;
  return true;
}

export interface Decoration {
  kind: "tree" | "pine" | "bush" | "rock";
  x: number;
  y: number;
}

export function scatterDecorations(): Decoration[] {
  const rand = mulberry32(20261123);
  const out: Decoration[] = [];
  // Border of trees keeps the edge of the world readable.
  for (let x = 30; x < WORLD_W; x += 58) {
    out.push({ kind: rand() > 0.5 ? "tree" : "pine", x: x + rand() * 16, y: 52 + rand() * 18 });
    out.push({ kind: rand() > 0.5 ? "tree" : "pine", x: x + rand() * 16, y: WORLD_H - 8 - rand() * 14 });
  }
  for (let y = 120; y < WORLD_H - 40; y += 64) {
    if (Math.abs(y - 560) < 50) continue; // leave the path exits open visually
    out.push({ kind: "pine", x: 22 + rand() * 12, y });
  }
  // Dense forest past the gate.
  for (let i = 0; i < 70; i++) {
    const x = 1270 + rand() * 320;
    const y = 120 + rand() * 940;
    if (Math.abs(y - 572) < 60) continue;
    if (isOpenGround(x, y)) out.push({ kind: rand() > 0.35 ? "pine" : "tree", x, y });
  }
  // Village greenery.
  let attempts = 0;
  while (out.length < 230 && attempts++ < 3000) {
    const x = 60 + rand() * 1180;
    const y = 110 + rand() * 950;
    if (!isOpenGround(x, y, 6)) continue;
    if (out.some((d) => Math.hypot(d.x - x, d.y - y) < 46)) continue;
    const r = rand();
    out.push({ kind: r < 0.45 ? "tree" : r < 0.6 ? "pine" : r < 0.88 ? "bush" : "rock", x, y });
  }
  return out;
}
