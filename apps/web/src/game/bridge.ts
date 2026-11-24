// Typed event channel between the Phaser scenes and the React UI. Phaser owns
// rendering and movement; React owns data, dialogue, and API calls.

import type { AvatarConfig } from "./avatar";
import type { GameMember, MemorySession } from "./types";

export type InteractableId = "guide" | "owl" | "board" | "chest" | "academy" | "forestGate" | "home" | `house:${string}`;

export type Marker = "available" | "claim" | null;

export interface WorldSnapshot {
  player: { memberId: string; name: string; avatar: AvatarConfig };
  family: GameMember[];
  markers: Partial<Record<InteractableId, Marker>>;
  chestOpen: boolean;
  forestUnlocked: boolean;
}

export interface MemoryFinish {
  sessionId: string;
  flips: number[];
}

/** A floating "+10" label shown in the world when rewards land. */
export interface RewardFloat {
  text: string;
  color: string;
}

interface Events {
  /** Phaser -> React */
  ready: void;
  nearby: InteractableId | null;
  interact: InteractableId;
  /** Player feet position in world pixels, throttled. */
  player: { x: number; y: number };
  memoryFinished: MemoryFinish;
  memoryExit: void;
  /** React -> Phaser */
  world: WorldSnapshot;
  triggerInteract: void;
  startMemory: MemorySession;
  endMemory: void;
  /** Sparkle burst at an interactable (or the player) with optional reward labels. */
  celebrate: { at?: InteractableId; items?: RewardFloat[] };
  setInputEnabled: boolean;
  /** Objective the HUD tracks: beacon in the world, arrow at the screen edge. */
  track: InteractableId | null;
  /** Walk to an interactable (and use it) or to a world point. */
  walkTo: { id: InteractableId } | { x: number; y: number };
}

type Handler<T> = (payload: T) => void;

export class GameBridge {
  private handlers = new Map<keyof Events, Set<Handler<never>>>();
  /** Last value per event, so a scene created later can catch up. */
  private last = new Map<keyof Events, unknown>();

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) this.handlers.set(event, (set = new Set()));
    set.add(handler as Handler<never>);
    return () => set!.delete(handler as Handler<never>);
  }

  emit<K extends keyof Events>(event: K, ...payload: Events[K] extends void ? [] : [Events[K]]) {
    this.last.set(event, payload[0]);
    for (const h of this.handlers.get(event) ?? []) (h as Handler<Events[K]>)(payload[0] as Events[K]);
  }

  latest<K extends keyof Events>(event: K): Events[K] | undefined {
    return this.last.get(event) as Events[K] | undefined;
  }

  clear() {
    this.handlers.clear();
    this.last.clear();
  }
}
