// World registry: the catalog of game experiences on the platform. Data only —
// every entry points at a trusted, bundled route; nothing here is executable.
// Copy lives in i18n under `platform.world.<id>.*`.

import { z } from "zod";

export const WORLD_STATUSES = ["draft", "coming_soon", "available", "disabled"] as const;
export const WORLD_CATEGORIES = ["adventure", "learning", "creative", "puzzle"] as const;
export const WORLD_ENGINES = ["phaser", "react", "three"] as const;
export const WORLD_DEVICES = ["desktop", "tablet", "mobile"] as const;

export type WorldStatus = (typeof WORLD_STATUSES)[number];
export type WorldCategory = (typeof WORLD_CATEGORIES)[number];
export type WorldEngine = (typeof WORLD_ENGINES)[number];

export const worldDefinitionSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    slug: z.string().regex(/^[a-z][a-z0-9-]*$/),
    category: z.enum(WORLD_CATEGORIES),
    engine: z.enum(WORLD_ENGINES),
    status: z.enum(WORLD_STATUSES),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    /** In-app route that launches the world. Must be an internal path. */
    entryRoute: z
      .string()
      .regex(/^\/[a-z0-9/-]*$/)
      .nullable(),
    /** Key of a bundled thumbnail illustration (never a remote URL). */
    thumbnail: z.string().regex(/^[a-z][a-z0-9-]*$/),
    guestAccessible: z.boolean(),
    supportedDevices: z.array(z.enum(WORLD_DEVICES)).min(1),
    /** Ids of worlds that should be played first (informational for now). */
    prerequisites: z.array(z.string()).default([]),
  })
  .refine((w) => w.status !== "available" || w.entryRoute !== null, {
    message: "available worlds need an entryRoute",
    path: ["entryRoute"],
  });

export type WorldDefinition = z.infer<typeof worldDefinitionSchema>;

/** Validates a catalog: each entry must parse and ids/slugs must be unique. */
export function parseWorldCatalog(input: unknown[]): WorldDefinition[] {
  const worlds = input.map((w) => worldDefinitionSchema.parse(w));
  const seen = new Set<string>();
  for (const w of worlds) {
    for (const k of [`id:${w.id}`, `slug:${w.slug}`]) {
      if (seen.has(k)) throw new Error(`duplicate world ${k}`);
      seen.add(k);
    }
  }
  return worlds;
}

export const WORLDS: WorldDefinition[] = parseWorldCatalog([
  {
    id: "family-adventure",
    slug: "family-adventure",
    category: "adventure",
    engine: "phaser",
    status: "available",
    version: "1.1.0",
    entryRoute: "/play",
    thumbnail: "village",
    guestAccessible: true,
    supportedDevices: ["desktop", "tablet", "mobile"],
  },
  {
    // Hall is React; boards reuse the village's Phaser MemoryScene (lazy).
    id: "learning-academy",
    slug: "learning-academy",
    category: "learning",
    engine: "phaser",
    status: "available",
    version: "1.0.0",
    entryRoute: "/academy",
    thumbnail: "academy",
    guestAccessible: true,
    supportedDevices: ["desktop", "tablet", "mobile"],
  },
  {
    id: "adventure-forest",
    slug: "adventure-forest",
    category: "adventure",
    engine: "phaser",
    status: "coming_soon",
    version: "0.1.0",
    entryRoute: null,
    thumbnail: "forest",
    guestAccessible: true,
    supportedDevices: ["desktop", "tablet", "mobile"],
    prerequisites: ["family-adventure"],
  },
  {
    id: "creative-home",
    slug: "creative-home",
    category: "creative",
    engine: "react",
    status: "coming_soon",
    version: "0.1.0",
    entryRoute: null,
    thumbnail: "home",
    guestAccessible: false,
    supportedDevices: ["desktop", "tablet", "mobile"],
  },
  {
    id: "puzzle-island",
    slug: "puzzle-island",
    category: "puzzle",
    engine: "react",
    status: "coming_soon",
    version: "0.1.0",
    entryRoute: null,
    thumbnail: "island",
    guestAccessible: true,
    supportedDevices: ["desktop", "tablet", "mobile"],
  },
]);

/** Worlds shown in discovery: drafts and disabled worlds stay hidden. */
export function listedWorlds(worlds: WorldDefinition[] = WORLDS): WorldDefinition[] {
  return worlds.filter((w) => w.status === "available" || w.status === "coming_soon");
}

/** Whether a viewer can launch the world right now. */
export function canLaunchWorld(world: WorldDefinition, viewer: { guest: boolean }): boolean {
  return world.status === "available" && world.entryRoute !== null && (world.guestAccessible || !viewer.guest);
}

export function featuredWorld(worlds: WorldDefinition[] = WORLDS): WorldDefinition {
  return worlds.find((w) => w.status === "available") ?? worlds[0]!;
}
