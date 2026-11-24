import { z } from "zod";

/**
 * Avatar appearance, stored as versioned JSON in game_profiles.avatar so new
 * slots (outfits, accessories, emotes) can be added without a migration.
 * Keep the option lists in sync with apps/web/src/game/avatar.ts.
 */
export const AVATAR_OPTIONS = {
  skin: ["#f9d7b9", "#eab68f", "#c68863", "#8d5a3b", "#5c3a24"],
  hair: ["short", "long", "spiky", "bun"],
  hairColor: ["#2b1d14", "#6b3e1f", "#c7862f", "#e8c766", "#b8452f", "#5a5f7a"],
  outfit: ["#e85d75", "#3b82f6", "#22a06b", "#f59e0b", "#8b5cf6", "#0ea5a4"],
  accessory: ["none", "cap", "bow", "crown", "glasses"],
} as const;

export const avatarSchema = z.object({
  v: z.literal(1),
  skin: z.enum(AVATAR_OPTIONS.skin),
  hair: z.enum(AVATAR_OPTIONS.hair),
  hairColor: z.enum(AVATAR_OPTIONS.hairColor),
  outfit: z.enum(AVATAR_OPTIONS.outfit),
  accessory: z.enum(AVATAR_OPTIONS.accessory),
});

export type AvatarConfig = z.infer<typeof avatarSchema>;

/** Deterministic starter look so every member is distinct before customizing. */
export function defaultAvatar(seed: string, role: "parent" | "child"): AvatarConfig {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = <T>(arr: readonly T[], salt: number) => arr[(h + salt) % arr.length]!;
  return {
    v: 1,
    skin: pick(AVATAR_OPTIONS.skin, 0),
    hair: pick(AVATAR_OPTIONS.hair, 1),
    hairColor: pick(AVATAR_OPTIONS.hairColor, 2),
    outfit: pick(AVATAR_OPTIONS.outfit, 3),
    accessory: role === "parent" ? "glasses" : pick(["none", "cap", "bow"] as const, 4),
  };
}

export function readAvatar(raw: unknown, seed: string, role: "parent" | "child"): AvatarConfig {
  const parsed = avatarSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultAvatar(seed, role);
}
