// Original, programmatically drawn art. Everything is painted onto canvases at
// startup (no external image assets), at 2x for props so they stay crisp when
// displayed at 0.5 scale on high-DPI screens.

import Phaser from "phaser";
import { renderAvatarSheet, shade, avatarKey, FRAME_H, FRAME_W, FACINGS, type AvatarConfig } from "./avatar";
import { mulberry32, PATHS, PLAZA, RIVER, WORLD_H, WORLD_W } from "./world";

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: Draw) {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, w, h);
  scene.textures.addCanvas(key, canvas);
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
function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.2) {
  ctx.fillStyle = `rgba(20, 40, 20, ${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Spritesheet + walk animations for an avatar look. Returns the texture key. */
export function ensureAvatarTexture(scene: Phaser.Scene, cfg: AvatarConfig): string {
  const key = avatarKey(cfg);
  if (!scene.textures.exists(key)) {
    scene.textures.addSpriteSheet(key, renderAvatarSheet(cfg) as unknown as HTMLImageElement, {
      frameWidth: FRAME_W,
      frameHeight: FRAME_H,
    });
  }
  FACINGS.forEach((facing, row) => {
    const animKey = `${key}-walk-${facing}`;
    if (scene.anims.exists(animKey)) return;
    scene.anims.create({
      key: animKey,
      frames: scene.anims.generateFrameNumbers(key, { frames: [row * 3 + 1, row * 3, row * 3 + 2, row * 3] }),
      frameRate: 9,
      repeat: -1,
    });
  });
  return key;
}

export function idleFrame(facing: (typeof FACINGS)[number]): number {
  return FACINGS.indexOf(facing) * 3;
}

function paintGround(ctx: CanvasRenderingContext2D) {
  const rand = mulberry32(7);
  const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  g.addColorStop(0, "#86cc6f");
  g.addColorStop(1, "#73bb63");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Meadow patches and grass texture
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = rand() > 0.5 ? "rgba(255,255,200,0.07)" : "rgba(30,90,30,0.07)";
    ctx.beginPath();
    ctx.ellipse(rand() * WORLD_W, rand() * WORLD_H, 40 + rand() * 120, 24 + rand() * 60, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(40,110,40,0.35)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 2600; i++) {
    const x = rand() * WORLD_W;
    const y = rand() * WORLD_H;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 1.5, y - 4);
    ctx.moveTo(x + 2, y);
    ctx.lineTo(x + 3, y - 5);
    ctx.stroke();
  }

  // River with banks
  const riverPath = () => {
    ctx.beginPath();
    for (let y = -10; y <= WORLD_H + 10; y += 10) {
      const x = RIVER.xAt(y);
      if (y === -10) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#5f9e4f";
  ctx.lineWidth = RIVER.width + 18;
  riverPath();
  ctx.stroke();
  ctx.strokeStyle = "#d9c48d";
  ctx.lineWidth = RIVER.width + 8;
  riverPath();
  ctx.stroke();
  ctx.strokeStyle = "#3e9fd6";
  ctx.lineWidth = RIVER.width;
  riverPath();
  ctx.stroke();
  ctx.strokeStyle = "#5cb8e8";
  ctx.lineWidth = RIVER.width - 22;
  riverPath();
  ctx.stroke();

  // Paths: soft edge, sandy fill, pebbles
  for (const [width, color] of [[14, "#c8ad72"], [0, "#e9d39d"]] as const) {
    ctx.strokeStyle = color;
    for (const p of PATHS) {
      ctx.lineWidth = p.width + width;
      ctx.beginPath();
      p.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
    }
    ctx.fillStyle = color;
    circle(ctx, PLAZA.x, PLAZA.y, PLAZA.r + width / 2);
  }
  ctx.fillStyle = "#dcc48a";
  for (let ring = 0; ring < 3; ring++) {
    ctx.strokeStyle = "rgba(160,130,80,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(PLAZA.x, PLAZA.y, 40 + ring * 22, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 500; i++) {
    const p = PATHS[Math.floor(rand() * PATHS.length)]!;
    const [a, b] = [p.points[0]!, p.points[p.points.length - 1]!];
    const t = rand();
    const x = a[0] + (b[0] - a[0]) * t + (rand() - 0.5) * p.width * 0.8;
    const y = a[1] + (b[1] - a[1]) * t + (rand() - 0.5) * p.width * 0.8;
    if (Math.abs(x - RIVER.xAt(y)) < RIVER.width / 2 + 4) continue;
    ctx.fillStyle = rand() > 0.5 ? "rgba(150,120,70,0.35)" : "rgba(255,250,230,0.5)";
    circle(ctx, x, y, 1 + rand() * 1.6);
  }

  // Flower beds
  const petals = ["#ff7aa8", "#ffd84d", "#ffffff", "#b388ff", "#ff9a52"];
  for (let i = 0; i < 90; i++) {
    const cx = rand() * 1150 + 50;
    const cy = rand() * 960 + 100;
    if (Math.abs(cx - RIVER.xAt(cy)) < 70) continue;
    const onPath = PATHS.some((p) => {
      const [a, b] = [p.points[0]!, p.points[1]!];
      return Math.abs(a[0] - b[0]) < 1 ? Math.abs(cx - a[0]) < 40 && cy > Math.min(a[1], b[1]) - 10 && cy < Math.max(a[1], b[1]) + 10 : Math.abs(cy - a[1]) < 40;
    });
    if (onPath || Math.hypot(cx - PLAZA.x, cy - PLAZA.y) < PLAZA.r + 20) continue;
    const color = petals[Math.floor(rand() * petals.length)]!;
    for (let j = 0; j < 6; j++) {
      const x = cx + (rand() - 0.5) * 30;
      const y = cy + (rand() - 0.5) * 18;
      ctx.fillStyle = "#3f8f3a";
      ctx.fillRect(x - 0.6, y, 1.2, 4);
      ctx.fillStyle = color;
      circle(ctx, x, y, 2.4);
      ctx.fillStyle = "#ffe27a";
      circle(ctx, x, y, 0.9);
    }
  }
}

export function generateWorldArt(scene: Phaser.Scene) {
  canvasTexture(scene, "ground", WORLD_W, WORLD_H, (ctx) => paintGround(ctx));

  canvasTexture(scene, "tree", 104, 136, (ctx) => {
    shadow(ctx, 52, 126, 34, 9);
    ctx.fillStyle = "#7a4f2e";
    rr(ctx, 44, 78, 16, 48, 5);
    ctx.fillStyle = "#5e3b21";
    rr(ctx, 52, 82, 5, 40, 2);
    const blobs: [number, number, number, string][] = [
      [52, 62, 38, "#3f9a46"], [30, 70, 24, "#3f9a46"], [74, 70, 24, "#3f9a46"],
      [52, 44, 30, "#4fb153"], [36, 54, 20, "#4fb153"], [68, 52, 20, "#4fb153"],
      [46, 34, 14, "#6fca69"], [62, 44, 10, "#6fca69"],
    ];
    for (const [x, y, r, c] of blobs) {
      ctx.fillStyle = c;
      circle(ctx, x, y, r);
    }
    ctx.fillStyle = "#e9475a";
    for (const [x, y] of [[34, 62], [66, 70], [56, 52], [44, 78]]) circle(ctx, x!, y!, 3.4);
  });

  canvasTexture(scene, "pine", 88, 144, (ctx) => {
    shadow(ctx, 44, 134, 26, 7);
    ctx.fillStyle = "#6d4426";
    rr(ctx, 38, 108, 12, 28, 3);
    const layers: [number, number, number, string][] = [
      [110, 40, 44, "#2f7a4a"], [84, 34, 40, "#36905a"], [58, 27, 36, "#43a66a"], [34, 19, 30, "#55b97a"],
    ];
    for (const [y, half, h, c] of layers) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(44, y - h);
      ctx.quadraticCurveTo(44 + half * 0.6, y - h * 0.35, 44 + half, y);
      ctx.quadraticCurveTo(44, y + 6, 44 - half, y);
      ctx.quadraticCurveTo(44 - half * 0.6, y - h * 0.35, 44, y - h);
      ctx.fill();
    }
  });

  canvasTexture(scene, "bush", 64, 48, (ctx) => {
    shadow(ctx, 32, 42, 26, 6);
    for (const [x, y, r, c] of [[20, 30, 14, "#3d9447"], [44, 30, 14, "#3d9447"], [32, 22, 16, "#4eaa52"], [26, 18, 7, "#6cc566"]] as const) {
      ctx.fillStyle = c;
      circle(ctx, x, y, r);
    }
    ctx.fillStyle = "#ffffff";
    for (const [x, y] of [[18, 26], [40, 20], [46, 32]]) circle(ctx, x!, y!, 2);
  });

  canvasTexture(scene, "rock", 56, 40, (ctx) => {
    shadow(ctx, 28, 34, 24, 5);
    ctx.fillStyle = "#9aa0a6";
    ctx.beginPath();
    ctx.ellipse(28, 24, 22, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b9bec4";
    ctx.beginPath();
    ctx.ellipse(23, 19, 12, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6fae5c";
    circle(ctx, 40, 15, 4);
  });

  canvasTexture(scene, "academy", 300, 250, (ctx) => {
    shadow(ctx, 150, 236, 140, 14, 0.25);
    // Towers
    for (const tx of [34, 266]) {
      ctx.fillStyle = "#d9d2c3";
      rr(ctx, tx - 26, 80, 52, 150, 6);
      ctx.fillStyle = "#6b4fb3";
      ctx.beginPath();
      ctx.moveTo(tx - 34, 86);
      ctx.lineTo(tx, 18);
      ctx.lineTo(tx + 34, 86);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#4f3a8a";
      ctx.fillRect(tx - 34, 84, 68, 6);
      ctx.fillStyle = "#7ec8f0";
      rr(ctx, tx - 9, 120, 18, 26, 9);
    }
    // Main hall
    ctx.fillStyle = "#e8e1d1";
    rr(ctx, 50, 104, 200, 126, 6);
    ctx.fillStyle = "#cfc6b2";
    for (let y = 116; y < 226; y += 18) for (let x = 56 + ((y / 18) % 2) * 12; x < 244; x += 26) rr(ctx, x, y, 20, 3, 1);
    ctx.fillStyle = "#7d5fd0";
    ctx.beginPath();
    ctx.moveTo(36, 112);
    ctx.lineTo(150, 36);
    ctx.lineTo(264, 112);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#5c43a6";
    ctx.fillRect(36, 108, 228, 8);
    // Round emblem window with a star
    ctx.fillStyle = "#f7f1ff";
    circle(ctx, 150, 82, 20);
    ctx.fillStyle = "#f6c445";
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 13 : 5.5;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(150 + r * Math.cos(a), 82 + r * Math.sin(a));
    }
    ctx.fill();
    // Windows
    for (const wx of [86, 214]) {
      ctx.fillStyle = "#7ec8f0";
      rr(ctx, wx - 16, 140, 32, 40, 14);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      rr(ctx, wx - 10, 146, 8, 14, 4);
    }
    // Door
    ctx.fillStyle = "#7a4a2a";
    rr(ctx, 124, 162, 52, 68, 24);
    ctx.fillStyle = "#5a341d";
    ctx.fillRect(148, 168, 4, 62);
    ctx.fillStyle = "#f6c445";
    circle(ctx, 162, 200, 3);
    // Flag
    ctx.fillStyle = "#6d4426";
    ctx.fillRect(149, 4, 3, 34);
    ctx.fillStyle = "#ff7aa8";
    ctx.beginPath();
    ctx.moveTo(152, 6);
    ctx.lineTo(176, 13);
    ctx.lineTo(152, 20);
    ctx.fill();
  });

  canvasTexture(scene, "board", 110, 120, (ctx) => {
    shadow(ctx, 55, 112, 44, 7);
    ctx.fillStyle = "#7a4f2e";
    rr(ctx, 16, 30, 10, 82, 3);
    rr(ctx, 84, 30, 10, 82, 3);
    ctx.fillStyle = "#a8743f";
    rr(ctx, 8, 18, 94, 64, 8);
    ctx.fillStyle = "#8c5d30";
    rr(ctx, 8, 12, 94, 12, 5);
    ctx.fillStyle = "#c48a4c";
    rr(ctx, 14, 26, 82, 50, 5);
    const notes: [number, number, string][] = [[22, 32, "#fff6d8"], [52, 30, "#e5f4ff"], [36, 52, "#ffe3ec"], [66, 50, "#fff6d8"]];
    for (const [x, y, c] of notes) {
      ctx.fillStyle = c;
      rr(ctx, x, y, 24, 20, 2);
      ctx.fillStyle = "rgba(80,60,40,0.4)";
      ctx.fillRect(x + 4, y + 7, 16, 2);
      ctx.fillRect(x + 4, y + 12, 12, 2);
      ctx.fillStyle = "#e9475a";
      circle(ctx, x + 12, y + 2, 2.4);
    }
  });

  const chest = (open: boolean): Draw => (ctx) => {
    shadow(ctx, 36, 60, 30, 6);
    ctx.fillStyle = "#9b5f2c";
    rr(ctx, 8, 30, 56, 30, 5);
    ctx.fillStyle = "#f2b84b";
    ctx.fillRect(8, 40, 56, 5);
    ctx.fillRect(32, 30, 8, 30);
    if (open) {
      ctx.fillStyle = "#fff3b0";
      rr(ctx, 12, 24, 48, 10, 4);
      ctx.fillStyle = "#7d4a20";
      rr(ctx, 8, 2, 56, 22, 6);
      ctx.fillStyle = "#5e3716";
      rr(ctx, 12, 6, 48, 14, 4);
    } else {
      ctx.fillStyle = "#b87436";
      rr(ctx, 6, 14, 60, 22, 9);
      ctx.fillStyle = "#f2b84b";
      ctx.fillRect(32, 14, 8, 22);
      rr(ctx, 30, 28, 12, 12, 3);
      ctx.fillStyle = "#7d4a20";
      circle(ctx, 36, 34, 2);
    }
  };
  canvasTexture(scene, "chest", 72, 68, chest(false));
  canvasTexture(scene, "chest-open", 72, 68, chest(true));

  canvasTexture(scene, "fountain", 150, 110, (ctx) => {
    shadow(ctx, 75, 92, 66, 12, 0.22);
    ctx.fillStyle = "#b9b3a6";
    ctx.beginPath();
    ctx.ellipse(75, 74, 66, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4fb0e3";
    ctx.beginPath();
    ctx.ellipse(75, 70, 56, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8fd3f5";
    ctx.beginPath();
    ctx.ellipse(66, 66, 26, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#cfc9bc";
    rr(ctx, 66, 26, 18, 46, 6);
    ctx.fillStyle = "#b9b3a6";
    ctx.beginPath();
    ctx.ellipse(75, 30, 24, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4fb0e3";
    ctx.beginPath();
    ctx.ellipse(75, 28, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  canvasTexture(scene, "bridge", 110, 96, (ctx) => {
    ctx.fillStyle = "rgba(20,40,60,0.25)";
    rr(ctx, 4, 12, 102, 80, 6);
    for (let x = 6; x < 104; x += 14) {
      ctx.fillStyle = x % 28 === 6 ? "#b07a45" : "#a06a38";
      rr(ctx, x, 8, 12, 80, 3);
    }
    ctx.fillStyle = "#7a4f2e";
    ctx.fillRect(0, 6, 110, 6);
    ctx.fillRect(0, 84, 110, 6);
    for (const x of [2, 54, 100]) {
      rr(ctx, x, 0, 8, 14, 2);
      rr(ctx, x, 80, 8, 14, 2);
    }
  });

  const gate = (open: boolean): Draw => (ctx) => {
    shadow(ctx, 70, 120, 64, 8);
    ctx.fillStyle = "#6f7a66";
    rr(ctx, 4, 20, 26, 104, 6);
    rr(ctx, 110, 20, 26, 104, 6);
    ctx.fillStyle = "#4f9e4f";
    circle(ctx, 17, 22, 16);
    circle(ctx, 123, 22, 16);
    ctx.fillStyle = "#7a5a34";
    ctx.beginPath();
    ctx.arc(70, 48, 50, Math.PI, 0);
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#7a5a34";
    ctx.stroke();
    if (open) {
      ctx.fillStyle = "#8c6a3f";
      rr(ctx, 30, 44, 12, 76, 3);
      rr(ctx, 98, 44, 12, 76, 3);
    } else {
      for (let x = 32; x < 108; x += 13) {
        ctx.fillStyle = "#8c6a3f";
        rr(ctx, x, 42, 10, 80, 3);
      }
      ctx.fillStyle = "#6a4f2c";
      ctx.fillRect(30, 62, 80, 7);
      ctx.fillRect(30, 96, 80, 7);
      ctx.fillStyle = "#f2b84b";
      rr(ctx, 60, 70, 20, 18, 4);
      ctx.strokeStyle = "#f2b84b";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(70, 70, 7, Math.PI, 0);
      ctx.stroke();
    }
  };
  canvasTexture(scene, "gate", 140, 128, gate(false));
  canvasTexture(scene, "gate-open", 140, 128, gate(true));

  canvasTexture(scene, "hedge", 40, 44, (ctx) => {
    shadow(ctx, 20, 38, 18, 5);
    ctx.fillStyle = "#2f7a3e";
    rr(ctx, 2, 10, 36, 30, 12);
    ctx.fillStyle = "#3f9447";
    circle(ctx, 14, 16, 10);
    circle(ctx, 27, 15, 10);
  });

  for (const [key, glyph, color] of [["marker-available", "!", "#f6c445"], ["marker-claim", "★", "#5fd18a"]] as const) {
    canvasTexture(scene, key, 44, 52, (ctx) => {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      circle(ctx, 22, 24, 19);
      ctx.fillStyle = color;
      circle(ctx, 22, 21, 18);
      ctx.beginPath();
      ctx.moveTo(15, 34);
      ctx.lineTo(22, 48);
      ctx.lineTo(29, 34);
      ctx.fill();
      ctx.fillStyle = shade(color, -0.55);
      ctx.font = "bold 24px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(glyph, 22, 22);
    });
  }

  canvasTexture(scene, "sparkle", 24, 24, (ctx) => {
    const g = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,235,150,0.9)");
    g.addColorStop(1, "rgba(255,200,80,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 12 : 3.5;
      const a = (i * Math.PI) / 4;
      ctx.lineTo(12 + r * Math.cos(a), 12 + r * Math.sin(a));
    }
    ctx.fill();
  });
  canvasTexture(scene, "glow", 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, "rgba(255,255,190,1)");
    g.addColorStop(1, "rgba(255,255,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  });
  canvasTexture(scene, "shimmer", 28, 8, (ctx) => {
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(3, 5);
    ctx.quadraticCurveTo(9, 1, 14, 5);
    ctx.quadraticCurveTo(19, 8, 25, 4);
    ctx.stroke();
  });
  canvasTexture(scene, "butterfly", 20, 16, (ctx) => {
    ctx.fillStyle = "#ff9ad0";
    ctx.beginPath();
    ctx.ellipse(6, 7, 5, 6, -0.4, 0, Math.PI * 2);
    ctx.ellipse(14, 7, 5, 6, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5a3d6b";
    rr(ctx, 9, 3, 2, 10, 1);
  });
}

export function ensureHouseTexture(scene: Phaser.Scene, roof: string): string {
  const safe = /^#[0-9a-fA-F]{6}$/.test(roof) ? roof : "#e85d75";
  const key = `house-${safe.slice(1)}`;
  canvasTexture(scene, key, 170, 160, (ctx) => {
    shadow(ctx, 85, 148, 76, 10, 0.24);
    ctx.fillStyle = "#f4e6cc";
    rr(ctx, 22, 66, 126, 82, 6);
    ctx.fillStyle = "#e5d3b2";
    for (let y = 76; y < 144; y += 14) ctx.fillRect(22, y, 126, 2);
    ctx.fillStyle = safe;
    ctx.beginPath();
    ctx.moveTo(8, 74);
    ctx.lineTo(85, 10);
    ctx.lineTo(162, 74);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(safe, -0.25);
    ctx.fillRect(8, 70, 154, 8);
    ctx.fillStyle = shade(safe, 0.3);
    for (let i = 0; i < 5; i++) ctx.fillRect(40 + i * 18, 40 + (i % 2) * 6, 10, 3);
    ctx.fillStyle = "#9c6b46";
    rr(ctx, 118, 24, 16, 30, 2);
    ctx.fillStyle = "#7a4a2a";
    rr(ctx, 70, 100, 30, 48, 12);
    ctx.fillStyle = "#f6c445";
    circle(ctx, 92, 126, 2.6);
    for (const wx of [44, 126]) {
      ctx.fillStyle = "#7ec8f0";
      rr(ctx, wx - 13, 92, 26, 24, 4);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(wx - 1, 92, 2, 24);
      ctx.fillRect(wx - 13, 103, 26, 2);
      ctx.fillStyle = "#ff7aa8";
      rr(ctx, wx - 15, 116, 30, 6, 3);
    }
  });
  return key;
}

export function generateNpcArt(scene: Phaser.Scene) {
  // Village Guide: a regular avatar with a fixed look.
  ensureAvatarTexture(scene, {
    v: 1, skin: "#eab68f", hair: "bun", hairColor: "#5a5f7a", outfit: "#0ea5a4", accessory: "glasses",
  });

  // Professor Owl, two frames (eyes open / blink).
  const owl = (blink: boolean): Draw => (ctx) => {
    shadow(ctx, 40, 90, 24, 6);
    ctx.fillStyle = "#8a5a3b";
    ctx.beginPath();
    ctx.ellipse(40, 60, 26, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e9cfa3";
    ctx.beginPath();
    ctx.ellipse(40, 68, 16, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(138,90,59,0.5)";
    ctx.lineWidth = 1.5;
    for (let y = 60; y < 84; y += 6) {
      ctx.beginPath();
      ctx.arc(40, y, 6, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }
    ctx.fillStyle = "#6e4429";
    ctx.beginPath();
    ctx.ellipse(16, 62, 8, 18, 0.25, 0, Math.PI * 2);
    ctx.ellipse(64, 62, 8, 18, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2b84b";
    rr(ctx, 28, 86, 8, 5, 2);
    rr(ctx, 44, 86, 8, 5, 2);
    // Head
    ctx.fillStyle = "#9b6a46";
    circle(ctx, 40, 34, 22);
    ctx.beginPath();
    ctx.moveTo(20, 22);
    ctx.lineTo(22, 8);
    ctx.lineTo(32, 16);
    ctx.moveTo(60, 22);
    ctx.lineTo(58, 8);
    ctx.lineTo(48, 16);
    ctx.fill();
    for (const ex of [31, 49]) {
      ctx.fillStyle = "#fff8e8";
      circle(ctx, ex, 33, 9);
      if (blink) {
        ctx.strokeStyle = "#3a2a1f";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ex - 6, 33);
        ctx.lineTo(ex + 6, 33);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#3a2a1f";
        circle(ctx, ex, 34, 4.5);
        ctx.fillStyle = "#ffffff";
        circle(ctx, ex + 1.5, 32, 1.4);
      }
    }
    ctx.fillStyle = "#f2a33a";
    ctx.beginPath();
    ctx.moveTo(36, 40);
    ctx.lineTo(44, 40);
    ctx.lineTo(40, 48);
    ctx.fill();
    // Mortarboard
    ctx.fillStyle = "#2f2a4a";
    ctx.beginPath();
    ctx.moveTo(14, 14);
    ctx.lineTo(40, 4);
    ctx.lineTo(66, 14);
    ctx.lineTo(40, 22);
    ctx.closePath();
    ctx.fill();
    rr(ctx, 30, 14, 20, 8, 2);
    ctx.strokeStyle = "#f6c445";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 13);
    ctx.lineTo(60, 18);
    ctx.lineTo(60, 28);
    ctx.stroke();
  };
  canvasTexture(scene, "owl", 80, 96, owl(false));
  canvasTexture(scene, "owl-blink", 80, 96, owl(true));
}

/** Ten crystal symbols that differ in both shape and color (color-blind friendly). */
export const GEM_COLORS = [
  "#ff5d8f", "#3b9cff", "#2fc27a", "#ffb020", "#9b6bff",
  "#16b6b0", "#ff7a3d", "#e04bd9", "#7bc93b", "#4f6bff",
];

function gemPath(ctx: CanvasRenderingContext2D, kind: number, cx: number, cy: number, r: number) {
  ctx.beginPath();
  const poly = (n: number, rot: number, inner?: number) => {
    const pts = inner ? n * 2 : n;
    for (let i = 0; i < pts; i++) {
      const rad = inner && i % 2 === 1 ? r * inner : r;
      const a = rot + (i * Math.PI * 2) / pts;
      ctx.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
    }
    ctx.closePath();
  };
  switch (kind) {
    case 0: ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2); break;
    case 1: poly(4, -Math.PI / 2); break;
    case 2: poly(3, -Math.PI / 2); break;
    case 3: poly(5, -Math.PI / 2, 0.45); break;
    case 4: poly(6, 0); break;
    case 5: ctx.roundRect(cx - r * 0.72, cy - r * 0.72, r * 1.44, r * 1.44, r * 0.2); break;
    case 6:
      ctx.moveTo(cx, cy + r * 0.85);
      ctx.bezierCurveTo(cx - r * 1.3, cy - r * 0.1, cx - r * 0.6, cy - r * 1.05, cx, cy - r * 0.4);
      ctx.bezierCurveTo(cx + r * 0.6, cy - r * 1.05, cx + r * 1.3, cy - r * 0.1, cx, cy + r * 0.85);
      break;
    case 7:
      ctx.arc(cx, cy, r * 0.85, Math.PI * 0.3, Math.PI * 1.7);
      ctx.arc(cx + r * 0.42, cy, r * 0.62, Math.PI * 1.55, Math.PI * 0.45, true);
      break;
    case 8: {
      const a = r * 0.3;
      const b = r * 0.85;
      ctx.moveTo(cx - a, cy - b);
      for (const [x, y] of [[a, -b], [a, -a], [b, -a], [b, a], [a, a], [a, b], [-a, b], [-a, a], [-b, a], [-b, -a], [-a, -a]]) {
        ctx.lineTo(cx + x!, cy + y!);
      }
      ctx.closePath();
      break;
    }
    default:
      ctx.moveTo(cx, cy - r);
      ctx.quadraticCurveTo(cx + r * 0.95, cy + r * 0.1, cx, cy + r);
      ctx.quadraticCurveTo(cx - r * 0.95, cy + r * 0.1, cx, cy - r);
  }
}

export const CARD_W = 120;
export const CARD_H = 150;

export function generateMemoryArt(scene: Phaser.Scene) {
  canvasTexture(scene, "card-back", CARD_W, CARD_H, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    g.addColorStop(0, "#6b4fd8");
    g.addColorStop(1, "#3f2c9a");
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    rr(ctx, 4, 8, CARD_W - 6, CARD_H - 8, 16);
    ctx.fillStyle = g;
    rr(ctx, 2, 2, CARD_W - 6, CARD_H - 8, 16);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(10, 10, CARD_W - 22, CARD_H - 24, 10);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    for (let i = 0; i < 6; i++) for (let j = 0; j < 7; j++) circle(ctx, 22 + i * 16, 22 + j * 17, 2);
    ctx.fillStyle = "#f6c445";
    gemPath(ctx, 1, CARD_W / 2 - 2, CARD_H / 2 - 3, 20);
    ctx.fill();
    ctx.fillStyle = "#fff3b0";
    gemPath(ctx, 1, CARD_W / 2 - 6, CARD_H / 2 - 8, 7);
    ctx.fill();
  });
  GEM_COLORS.forEach((color, kind) => {
    canvasTexture(scene, `card-face-${kind}`, CARD_W, CARD_H, (ctx) => {
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      rr(ctx, 4, 8, CARD_W - 6, CARD_H - 8, 16);
      ctx.fillStyle = "#fffaf0";
      rr(ctx, 2, 2, CARD_W - 6, CARD_H - 8, 16);
      ctx.strokeStyle = shade(color, 0.55);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(8, 8, CARD_W - 18, CARD_H - 20, 12);
      ctx.stroke();
      const cx = CARD_W / 2 - 2;
      const cy = CARD_H / 2 - 3;
      const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 46);
      glow.addColorStop(0, shade(color, 0.7));
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      circle(ctx, cx, cy, 46);
      const g = ctx.createLinearGradient(cx - 30, cy - 30, cx + 30, cy + 30);
      g.addColorStop(0, shade(color, 0.35));
      g.addColorStop(1, shade(color, -0.25));
      ctx.fillStyle = g;
      gemPath(ctx, kind, cx, cy, 32);
      ctx.fill();
      ctx.strokeStyle = shade(color, -0.4);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(cx - 9, cy - 11, 8, 4, -0.6, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}
