// Layered, programmatically drawn avatars. The same renderer feeds the Phaser
// spritesheets and the React avatar editor preview, so every slot added here
// (outfits, accessories, emotes) shows up in both. Option lists must match
// apps/api/src/game/avatar.ts, which validates what gets saved.

export const AVATAR_OPTIONS = {
  skin: ["#f9d7b9", "#eab68f", "#c68863", "#8d5a3b", "#5c3a24"],
  hair: ["short", "long", "spiky", "bun"],
  hairColor: ["#2b1d14", "#6b3e1f", "#c7862f", "#e8c766", "#b8452f", "#5a5f7a"],
  outfit: ["#e85d75", "#3b82f6", "#22a06b", "#f59e0b", "#8b5cf6", "#0ea5a4"],
  accessory: ["none", "cap", "bow", "crown", "glasses"],
} as const;

type Opt<K extends keyof typeof AVATAR_OPTIONS> = (typeof AVATAR_OPTIONS)[K][number];

export interface AvatarConfig {
  v: 1;
  skin: Opt<"skin">;
  hair: Opt<"hair">;
  hairColor: Opt<"hairColor">;
  outfit: Opt<"outfit">;
  accessory: Opt<"accessory">;
}

export type Facing = "down" | "left" | "right" | "up";
export const FACINGS: Facing[] = ["down", "left", "right", "up"];

/** Source frames are drawn at 2x and displayed at 0.5 scale for crisp edges. */
export const FRAME_W = 64;
export const FRAME_H = 80;
export const WALK_FRAMES = 3; // 0 = idle, 1 and 2 = stride

export function avatarKey(cfg: AvatarConfig): string {
  return ["av", cfg.skin, cfg.hair, cfg.hairColor, cfg.outfit, cfg.accessory].join("-").replace(/#/g, "");
}

export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => {
    const c = (n >> shift) & 0xff;
    const v = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw one frame with its top-left corner at (ox, oy). */
export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  cfg: AvatarConfig,
  facing: Facing,
  frame: number,
  ox = 0,
  oy = 0,
) {
  ctx.save();
  ctx.translate(ox, oy);
  const stride = frame === 0 ? 0 : frame === 1 ? 1 : -1;
  const bob = frame === 0 ? 0 : -1;
  const side = facing === "left" || facing === "right";
  const dirX = facing === "left" ? -1 : 1;

  // Shadow
  ctx.fillStyle = "rgba(20, 30, 20, 0.22)";
  ctx.beginPath();
  ctx.ellipse(32, 74, 15, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs and shoes
  const pants = "#3d4166";
  const shoe = "#2a2238";
  if (side) {
    const swing = stride * 4;
    ctx.fillStyle = shade(pants, -0.2);
    rr(ctx, 28 - swing, 56, 8, 15, 3);
    ctx.fillStyle = pants;
    rr(ctx, 28 + swing, 56, 8, 15, 3);
    ctx.fillStyle = shoe;
    rr(ctx, 27 - swing + dirX * 1, 68, 10, 5, 2.5);
    rr(ctx, 27 + swing + dirX * 1, 68, 10, 5, 2.5);
  } else {
    ctx.fillStyle = pants;
    rr(ctx, 23, 56 - (stride > 0 ? 3 : 0), 8, 15, 3);
    rr(ctx, 33, 56 - (stride < 0 ? 3 : 0), 8, 15, 3);
    ctx.fillStyle = shoe;
    rr(ctx, 22, 68 - (stride > 0 ? 3 : 0), 10, 5, 2.5);
    rr(ctx, 32, 68 - (stride < 0 ? 3 : 0), 10, 5, 2.5);
  }

  ctx.translate(0, bob);

  // Back arm (side view) sits behind the torso
  if (side) {
    ctx.fillStyle = shade(cfg.outfit, -0.25);
    rr(ctx, 28 - stride * 4, 40, 8, 15, 4);
  }

  // Torso
  ctx.fillStyle = cfg.outfit;
  rr(ctx, 19, 37, 26, 23, 8);
  ctx.fillStyle = shade(cfg.outfit, -0.22);
  rr(ctx, 19, 53, 26, 4, 1);
  ctx.fillStyle = shade(cfg.outfit, 0.25);
  if (facing === "down") rr(ctx, 27, 38, 10, 4, 2); // collar

  // Front arms
  if (side) {
    ctx.fillStyle = cfg.outfit;
    rr(ctx, 28 + stride * 4, 40, 8, 14, 4);
    ctx.fillStyle = cfg.skin;
    circle(ctx, 32 + stride * 4, 55, 3.6);
  } else {
    ctx.fillStyle = cfg.outfit;
    rr(ctx, 13, 39 + stride * 2, 8, 15, 4);
    rr(ctx, 43, 39 - stride * 2, 8, 15, 4);
    ctx.fillStyle = cfg.skin;
    circle(ctx, 17, 55 + stride * 2, 3.6);
    circle(ctx, 47, 55 - stride * 2, 3.6);
  }

  // Long hair falls behind the head
  ctx.fillStyle = cfg.hairColor;
  if (cfg.hair === "long") {
    if (facing === "up") rr(ctx, 16, 22, 32, 24, 8);
    else if (side) rr(ctx, 32 - dirX * 14 - 5, 20, 12, 24, 6);
    else {
      rr(ctx, 14, 22, 9, 22, 4);
      rr(ctx, 41, 22, 9, 22, 4);
    }
  }
  if (cfg.hair === "bun") circle(ctx, 32, 9, 6.5);

  // Head
  ctx.fillStyle = cfg.skin;
  circle(ctx, 32, 25, 15);

  // Face
  if (facing !== "up") {
    const eye = "#2a1f2d";
    const blush = "rgba(255, 110, 120, 0.42)";
    const eyes = side ? [32 + dirX * 7] : [26, 38];
    ctx.fillStyle = eye;
    for (const ex of eyes) circle(ctx, ex, 27, 2.3);
    ctx.fillStyle = "#ffffff";
    for (const ex of eyes) circle(ctx, ex + 0.8, 26.2, 0.8);
    ctx.fillStyle = blush;
    for (const ex of side ? [32 + dirX * 5] : [22.5, 41.5]) circle(ctx, ex, 31.5, 2.6);
    ctx.strokeStyle = shade(cfg.skin, -0.45);
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    const mx = side ? 32 + dirX * 8 : 32;
    ctx.arc(mx, 31.5, 2.6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  // Hair cap
  ctx.fillStyle = cfg.hairColor;
  if (facing === "up") {
    ctx.beginPath();
    ctx.arc(32, 25, 15.5, Math.PI * 0.92, Math.PI * 2.08);
    ctx.fill();
    rr(ctx, 17, 22, 30, 12, 6);
  } else {
    ctx.beginPath();
    ctx.arc(32, 24, 15.8, Math.PI * 1.02, Math.PI * 1.98);
    ctx.fill();
    if (side) {
      // Fringe sweeps toward the facing side, the back of the head stays covered
      rr(ctx, 32 - dirX * 15 - (dirX > 0 ? 0 : 8), 16, 9, 16, 4);
    } else {
      ctx.beginPath();
      ctx.moveTo(17, 22);
      ctx.quadraticCurveTo(24, 26, 30, 19);
      ctx.quadraticCurveTo(38, 26, 47, 22);
      ctx.lineTo(47, 16);
      ctx.lineTo(17, 16);
      ctx.fill();
    }
  }
  if (cfg.hair === "spiky") {
    ctx.beginPath();
    for (const [x, h] of [[20, 7], [27, 10], [34, 11], [41, 8]] as const) {
      ctx.moveTo(x - 4, 14);
      ctx.lineTo(x + 1, 14 - h);
      ctx.lineTo(x + 5, 14);
    }
    ctx.fill();
  }

  // Accessory
  switch (cfg.accessory) {
    case "cap": {
      const capColor = shade(cfg.outfit, -0.15);
      ctx.fillStyle = capColor;
      ctx.beginPath();
      ctx.arc(32, 21, 15.5, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = shade(capColor, -0.2);
      if (facing === "down") rr(ctx, 18, 18, 28, 5, 2.5);
      else if (side) rr(ctx, facing === "right" ? 34 : 14, 18, 16, 5, 2.5);
      ctx.fillStyle = "#ffffff";
      circle(ctx, 32, 7, 2.2);
      break;
    }
    case "bow": {
      ctx.fillStyle = "#ff5fa2";
      const bx = facing === "left" ? 22 : 43;
      ctx.beginPath();
      ctx.moveTo(bx, 12);
      ctx.lineTo(bx - 7, 6);
      ctx.lineTo(bx - 7, 18);
      ctx.closePath();
      ctx.moveTo(bx, 12);
      ctx.lineTo(bx + 7, 6);
      ctx.lineTo(bx + 7, 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#d63f84";
      circle(ctx, bx, 12, 2.6);
      break;
    }
    case "crown": {
      ctx.fillStyle = "#f6c445";
      ctx.beginPath();
      ctx.moveTo(21, 13);
      ctx.lineTo(21, 4);
      ctx.lineTo(26.5, 9);
      ctx.lineTo(32, 2);
      ctx.lineTo(37.5, 9);
      ctx.lineTo(43, 4);
      ctx.lineTo(43, 13);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#e0484f";
      circle(ctx, 32, 9, 1.8);
      break;
    }
    case "glasses": {
      if (facing === "up") break;
      ctx.strokeStyle = "#2f2a3b";
      ctx.lineWidth = 1.6;
      const lenses = side ? [32 + dirX * 7] : [26, 38];
      for (const lx of lenses) {
        ctx.beginPath();
        ctx.arc(lx, 27, 4.6, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (!side) {
        ctx.beginPath();
        ctx.moveTo(30.6, 27);
        ctx.lineTo(33.4, 27);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

/** 3 columns (idle, stride A, stride B) x 4 rows (down, left, right, up). */
export function renderAvatarSheet(cfg: AvatarConfig): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_W * WALK_FRAMES;
  canvas.height = FRAME_H * FACINGS.length;
  const ctx = canvas.getContext("2d")!;
  FACINGS.forEach((facing, row) => {
    for (let f = 0; f < WALK_FRAMES; f++) drawAvatar(ctx, cfg, facing, f, f * FRAME_W, row * FRAME_H);
  });
  return canvas;
}

/** Static front-facing preview for React (avatar editor, HUD portrait). */
export function paintAvatarPreview(canvas: HTMLCanvasElement, cfg: AvatarConfig) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / FRAME_W, canvas.height / FRAME_H);
  ctx.save();
  ctx.translate((canvas.width - FRAME_W * scale) / 2, (canvas.height - FRAME_H * scale) / 2);
  ctx.scale(scale, scale);
  drawAvatar(ctx, cfg, "down", 0);
  ctx.restore();
}
