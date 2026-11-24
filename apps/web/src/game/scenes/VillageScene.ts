import Phaser from "phaser";
import { avatarKey, GUIDE_LOOK, type AvatarConfig, type Facing } from "../avatar";
import { ensureAvatarTexture, ensureHouseTexture, generateNpcArt, generateWorldArt, idleFrame } from "../art";
import type { GameBridge, InteractableId, Marker, RewardFloat, WorldSnapshot } from "../bridge";
import type { MemorySession } from "../types";
import { NavGrid, type Point } from "../pathfinding";
import {
  FOREST_FENCE_X,
  HOUSE_SLOTS,
  INTERACTABLES,
  LAMPS,
  NPCS,
  PROPS,
  PLAZA,
  RIVER,
  SPAWN,
  WORLD_H,
  WORLD_W,
  mulberry32,
  scatterDecorations,
  type Interactable,
} from "../world";

const SPEED = 150;
const AVATAR_SCALE = 0.5;
const MARKER_OFFSET: Partial<Record<InteractableId, number>> = { guide: -84, owl: -90, board: -140, chest: -52 };
/** Clearance around obstacles for the player's footprint when path-finding. */
const NAV_PAD = 9;
/** Highlight ring size per interactable (1 = 128x52 world px). */
const RING_SCALE: Partial<Record<InteractableId, number>> = {
  guide: 0.5, owl: 0.55, board: 0.7, chest: 0.55, academy: 1.9, forestGate: 0.9,
};
/** Things that hop when used (buildings stay put and get a ring flash instead). */
const HOPPERS: InteractableId[] = ["guide", "owl", "board", "chest"];
/** Viewport insets in CSS px kept clear for the HUD when placing the objective arrow. */
const EDGE_INSET = { top: 72, right: 40, bottom: 96, left: 40 };

type Translate = (key: string, params?: Record<string, unknown>) => string;

interface HouseView {
  memberId: string;
  parts: Phaser.GameObjects.GameObject[];
}

export class VillageScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private t!: Translate;
  private dpr = 1;
  private reducedMotion = false;

  private player!: Phaser.Physics.Arcade.Sprite;
  private playerKey = "";
  private playerLabel!: Phaser.GameObjects.Text;
  private facing: Facing = "down";
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private gateBlock!: Phaser.GameObjects.Zone;
  private gate!: Phaser.GameObjects.Image;
  private chest!: Phaser.GameObjects.Image;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private fireflies?: Phaser.GameObjects.Particles.ParticleEmitter;
  private lampLights: Phaser.GameObjects.Image[] = [];

  private touch = false;
  private playerShadow!: Phaser.GameObjects.Image;
  private dust?: Phaser.GameObjects.Particles.ParticleEmitter;
  private dustMs = 0;
  private bushes: Phaser.GameObjects.Image[] = [];
  private rustling = new Set<Phaser.GameObjects.Image>();
  private rustleMs = 0;
  /** World objects keyed by interactable, for hop and flash feedback. */
  private things = new Map<InteractableId, Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>();
  private highlight!: Phaser.GameObjects.Image;
  private prompt!: Phaser.GameObjects.Text;
  private tracked: InteractableId | null = null;
  private beacon!: Phaser.GameObjects.Image;
  private edgeArrow!: Phaser.GameObjects.Image;
  private chestOpen: boolean | null = null;
  private playerEmitMs = 0;
  private baseZoom = 1;
  private focused = false;

  private keys!: Record<"up" | "down" | "left" | "right" | "w" | "a" | "s" | "d" | "e" | "space" | "enter", Phaser.Input.Keyboard.Key>;
  private target: Point | null = null;
  private path: Point[] = [];
  private nav = new NavGrid(WORLD_W, WORLD_H, 16);
  private navRects: { zone: Phaser.GameObjects.Zone; x: number; y: number; w: number; h: number }[] = [];
  private gateLocked = true;
  private pendingInteract: InteractableId | null = null;
  private stuckMs = 0;
  private lastPos = { x: 0, y: 0 };
  private nearby: InteractableId | null = null;
  private inputEnabled = true;

  private interactables: Interactable[] = [...INTERACTABLES];
  private markers = new Map<InteractableId, Phaser.GameObjects.Image>();
  private houses: HouseView[] = [];
  private houseSignature = "";
  private unsubscribers: (() => void)[] = [];

  constructor() {
    super("village");
  }

  create() {
    this.bridge = this.registry.get("bridge") as GameBridge;
    this.t = this.registry.get("t") as Translate;
    this.dpr = (this.registry.get("dpr") as number) ?? 1;
    this.reducedMotion = !!this.registry.get("reducedMotion");
    this.touch = !!this.registry.get("touch");

    generateWorldArt(this);
    generateNpcArt(this);

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.add.image(0, 0, "ground").setOrigin(0, 0).setDepth(-10_000);
    this.obstacles = this.physics.add.staticGroup();

    this.buildRiver();
    this.buildWaterLife();
    this.buildDecorations();
    this.buildProps();
    this.buildLamps();
    this.buildForestFence();
    this.buildNpcs();
    this.buildPlayer();
    this.buildGuidance();
    this.buildAmbience();
    this.buildInput();
    this.rebuildNav();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    const lerp = this.reducedMotion ? 1 : 0.09;
    cam.startFollow(this.player, true, lerp, lerp);
    this.applyZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    if (!this.reducedMotion) cam.fadeIn(400, 0, 0, 0);

    this.unsubscribers.push(
      this.bridge.on("world", (w) => this.applyWorld(w)),
      this.bridge.on("triggerInteract", () => this.interact()),
      this.bridge.on("setInputEnabled", (enabled) => this.setInputEnabled(enabled)),
      this.bridge.on("celebrate", ({ at, items }) => this.celebrate(at, items)),
      this.bridge.on("track", (id) => this.setTracked(id)),
      this.bridge.on("walkTo", (dest) => {
        if (!this.inputEnabled) return;
        if ("id" in dest) {
          const at = this.interactables.find((i) => i.id === dest.id);
          if (!at) return;
          this.pendingInteract = at.id;
          this.walkTo({ x: at.x, y: at.y });
        } else {
          this.pendingInteract = null;
          this.walkTo(dest);
        }
      }),
      this.bridge.on("startMemory", (session) => this.enterMemory(session)),
    );
    const snapshot = this.bridge.latest("world");
    if (snapshot) this.applyWorld(snapshot);
    const tracked = this.bridge.latest("track");
    if (tracked !== undefined) this.setTracked(tracked);

    this.events.on(Phaser.Scenes.Events.WAKE, this.onWake, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
    this.bridge.emit("ready");
  }

  private cleanup() {
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.off(Phaser.Scenes.Events.WAKE, this.onWake, this);
  }

  // --- World building ------------------------------------------------------

  private block(x: number, y: number, w: number, h: number) {
    const zone = this.add.zone(x, y, w, h);
    this.physics.add.existing(zone, true);
    this.obstacles.add(zone);
    this.navRects.push({ zone, x, y, w, h });
    return zone;
  }

  private buildRiver() {
    for (let y = 0; y <= WORLD_H; y += 24) {
      if (Math.abs(y - RIVER.bridgeY) < RIVER.bridgeHalf) continue;
      this.block(RIVER.xAt(y), y, RIVER.width - 6, 26);
    }
    if (this.reducedMotion) return;
    for (let i = 0; i < 16; i++) {
      const y = 40 + i * 66 + Phaser.Math.Between(-10, 10);
      if (Math.abs(y - RIVER.bridgeY) < 50) continue;
      const s = this.add
        .image(RIVER.xAt(y) + Phaser.Math.Between(-14, 14), y, "shimmer")
        .setDepth(-9000)
        .setAlpha(0);
      this.tweens.add({
        targets: s,
        alpha: { from: 0, to: 0.8 },
        y: y + 10,
        duration: 1400 + Math.random() * 900,
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 2000,
      });
    }
  }

  private buildDecorations() {
    for (const d of scatterDecorations()) {
      const scale = d.kind === "tree" ? 0.62 : d.kind === "pine" ? 0.66 : 0.7;
      const img = this.add.image(d.x, d.y, d.kind).setOrigin(0.5, 0.94).setScale(scale).setDepth(d.y);
      if (d.kind === "tree" || d.kind === "pine") {
        this.block(d.x, d.y - 6, 18, 12);
        if (!this.reducedMotion && Math.random() < 0.35) {
          this.tweens.add({
            targets: img,
            angle: { from: -1.2, to: 1.2 },
            duration: 2200 + Math.random() * 1600,
            yoyo: true,
            repeat: -1,
            ease: "Sine.inOut",
            delay: Math.random() * 2000,
          });
        }
      } else {
        this.block(d.x, d.y - 6, d.kind === "bush" ? 36 : 32, 14);
        if (d.kind === "bush") this.bushes.push(img);
      }
    }
  }

  private buildProps() {
    for (const p of PROPS) {
      switch (p.kind) {
        case "academy":
          this.things.set("academy", this.add.image(p.x, p.y, "academy").setOrigin(0.5, 0.95).setScale(0.8).setDepth(p.y));
          this.block(p.x, p.y - 58, 232, 92);
          this.label(p.x, p.y - 214, this.t("game.place.academy"));
          break;
        case "fountain": {
          this.add.image(p.x, p.y, "fountain").setOrigin(0.5, 0.85).setScale(0.8).setDepth(p.y);
          this.block(p.x, p.y - 22, 104, 34);
          if (!this.reducedMotion) {
            this.add
              .particles(p.x, p.y - 64, "glow", {
                speedY: { min: -70, max: -40 },
                speedX: { min: -22, max: 22 },
                gravityY: 160,
                lifespan: 900,
                scale: { start: 0.5, end: 0.15 },
                alpha: { start: 0.9, end: 0 },
                tint: [0xbfe9ff, 0xffffff, 0x8fd3f5],
                frequency: 70,
              })
              .setDepth(p.y + 1);
          }
          break;
        }
        case "board":
          this.add.image(p.x, p.y - 2, "soft-shadow").setScale(1.3, 1).setDepth(-7000);
          this.things.set("board", this.add.image(p.x, p.y, "board").setOrigin(0.5, 0.92).setScale(0.7).setDepth(p.y));
          this.block(p.x, p.y - 6, 66, 14);
          this.label(p.x, p.y - 92, this.t("game.place.board"));
          break;
        case "chest":
          this.add.image(p.x, p.y - 2, "soft-shadow").setScale(0.9, 0.8).setDepth(-7000);
          this.chest = this.add.image(p.x, p.y, "chest").setOrigin(0.5, 0.9).setScale(0.62).setDepth(p.y);
          this.things.set("chest", this.chest);
          this.block(p.x, p.y - 8, 40, 16);
          break;
        case "bridge":
          this.add.image(p.x, p.y, "bridge").setDisplaySize(112, 70).setDepth(-8000);
          break;
        case "gate":
          this.gate = this.add.image(p.x, p.y, "gate").setOrigin(0.5, 0.95).setScale(0.75).setDepth(p.y);
          this.things.set("forestGate", this.gate);
          this.label(p.x, p.y - 104, this.t("game.place.forest"));
          break;
      }
    }
  }

  /** Lily pads, reeds, and slow ripples along the river and in the fountain. */
  private buildWaterLife() {
    const rand = mulberry32(7);
    for (let y = 70; y < WORLD_H - 40; y += 90) {
      if (Math.abs(y - RIVER.bridgeY) < 70) continue;
      const cx = RIVER.xAt(y);
      const bank = rand() > 0.5 ? 1 : -1;
      this.add
        .image(cx + bank * (RIVER.width / 2 + 2), y + rand() * 30, "reeds")
        .setOrigin(0.5, 0.95)
        .setScale(0.7)
        .setDepth(y + 20);
      if (rand() > 0.45) {
        const lx = cx + (rand() - 0.5) * 26;
        const ly = y + 40;
        const pad = this.add.image(lx, ly, "lily").setScale(0.6).setDepth(-8500).setAngle(rand() * 360);
        if (!this.reducedMotion) {
          this.tweens.add({ targets: pad, y: ly + 3, angle: pad.angle + 8, duration: 2600 + rand() * 1400, yoyo: true, repeat: -1, ease: "Sine.inOut" });
          this.ripple(lx, ly, 0.5, rand() * 3000);
        }
      }
    }
    if (!this.reducedMotion) {
      this.ripple(PLAZA.x, PLAZA.y + 4, 0.9, 0, 4);
      this.ripple(PLAZA.x - 12, PLAZA.y + 8, 0.7, 1300, 4);
    }
  }

  private ripple(x: number, y: number, scale: number, delay: number, depthOffset = 0) {
    const r = this.add.image(x, y, "ripple").setScale(scale * 0.4).setAlpha(0).setDepth(depthOffset ? PLAZA.y + 18 + depthOffset : -8400);
    this.tweens.add({
      targets: r,
      scale: { from: scale * 0.4, to: scale * 1.1 },
      alpha: { from: 0.7, to: 0 },
      duration: 2200,
      repeat: -1,
      repeatDelay: 600,
      delay,
      ease: "Sine.out",
    });
  }

  private buildLamps() {
    for (const l of LAMPS) {
      this.add.image(l.x, l.y, "lamp").setOrigin(0.5, 0.95).setScale(0.55).setDepth(l.y);
      this.block(l.x, l.y - 3, 10, 8);
      const light = this.add
        .image(l.x, l.y - 52, "light")
        .setScale(0.9)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0)
        .setDepth(20_001);
      this.lampLights.push(light);
    }
  }

  /** Proximity ring, key prompt, objective beacon, and off-screen arrow. */
  private buildGuidance() {
    this.highlight = this.add.image(0, 0, "ring").setVisible(false).setDepth(-6900);
    if (!this.reducedMotion) {
      this.tweens.add({ targets: this.highlight, alpha: { from: 1, to: 0.45 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    }
    this.prompt = this.add
      .text(0, 0, "E", {
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#2a2140",
        backgroundColor: "#fff7d6",
        padding: { x: 7, y: 3 },
        resolution: Math.max(2, this.dpr * 2),
      })
      .setOrigin(0.5, 1)
      .setDepth(9200)
      .setVisible(false);
    this.beacon = this.add.image(0, 0, "beacon").setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    if (!this.reducedMotion) {
      this.tweens.add({ targets: this.beacon, alpha: { from: 0.95, to: 0.5 }, scaleX: { from: 1, to: 0.85 }, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    }
    this.edgeArrow = this.add.image(0, 0, "edge-arrow").setDepth(21_000).setVisible(false);
    if (!this.reducedMotion) {
      this.dust = this.add.particles(0, 0, "glow", {
        lifespan: 420,
        speed: { min: 6, max: 20 },
        angle: { min: 200, max: 340 },
        scale: { start: 0.7, end: 0 },
        alpha: { start: 0.55, end: 0 },
        tint: 0xd9c49c,
        emitting: false,
      });
    }
  }

  private setTracked(id: InteractableId | null) {
    this.tracked = id;
    const at = id && this.interactables.find((i) => i.id === id);
    if (!at) {
      this.beacon.setVisible(false);
      this.edgeArrow.setVisible(false);
      return;
    }
    this.beacon.setPosition(at.x, at.y + 6).setDepth(at.y - 30).setVisible(true);
  }

  private buildForestFence() {
    const gapTop = 515;
    const gapBottom = 610;
    for (let y = 96; y < WORLD_H - 20; y += 34) {
      if (y > gapTop - 20 && y < gapBottom + 4) continue;
      this.add.image(FOREST_FENCE_X, y, "hedge").setOrigin(0.5, 0.9).setScale(0.9).setDepth(y);
    }
    this.block(FOREST_FENCE_X, gapTop / 2, 30, gapTop);
    this.block(FOREST_FENCE_X, (gapBottom + WORLD_H) / 2, 30, WORLD_H - gapBottom);
    this.gateBlock = this.block(FOREST_FENCE_X, 562, 30, 100);
  }

  private buildNpcs() {
    for (const npc of NPCS) {
      let sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
      if (npc.id === "guide") {
        const key = ensureAvatarTexture(this, GUIDE_LOOK);
        sprite = this.add.sprite(npc.x, npc.y, key, idleFrame("down")).setScale(AVATAR_SCALE);
      } else {
        sprite = this.add.image(npc.x, npc.y, "owl").setScale(0.55);
        this.time.addEvent({
          delay: 3200,
          loop: true,
          callback: () => {
            (sprite as Phaser.GameObjects.Image).setTexture("owl-blink");
            this.time.delayedCall(160, () => (sprite as Phaser.GameObjects.Image).setTexture("owl"));
          },
        });
      }
      sprite.setOrigin(0.5, 0.92).setDepth(npc.y);
      this.things.set(npc.id, sprite);
      this.add.image(npc.x, npc.y - 2, "soft-shadow").setScale(0.6, 0.7).setDepth(-7000);
      this.block(npc.x, npc.y - 6, 26, 12);
      this.label(npc.x, npc.y - (npc.id === "guide" ? 46 : 52), this.t(`game.npc.${npc.id}.name`), true);
      if (!this.reducedMotion) {
        this.tweens.add({ targets: sprite, scaleY: sprite.scaleY * 1.03, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      }
    }
  }

  private label(x: number, y: number, text: string, small = false) {
    return this.add
      .text(x, y, text, {
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        fontSize: `${small ? 11 : 13}px`,
        fontStyle: "bold",
        color: "#ffffff",
        backgroundColor: small ? "rgba(40, 30, 60, 0.55)" : "rgba(60, 40, 90, 0.72)",
        padding: { x: 6, y: 2 },
        resolution: Math.max(2, this.dpr * 2),
      })
      .setOrigin(0.5, 1)
      .setDepth(9000);
  }

  private buildPlayer() {
    const placeholder = ensureAvatarTexture(this, GUIDE_LOOK);
    this.player = this.physics.add.sprite(SPAWN.x, SPAWN.y, placeholder, idleFrame("down"));
    this.playerKey = placeholder;
    this.player.setOrigin(0.5, 0.92).setScale(AVATAR_SCALE).setCollideWorldBounds(true);
    // Body sizes are in unscaled frame pixels: a small footprint at the feet.
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(30, 14).setOffset(17, 60);
    this.physics.add.collider(this.player, this.obstacles);
    this.playerLabel = this.label(SPAWN.x, SPAWN.y - 44, "", true);
    this.playerShadow = this.add.image(SPAWN.x, SPAWN.y, "soft-shadow").setScale(0.55, 0.6).setDepth(-7000);
    this.lastPos = { x: SPAWN.x, y: SPAWN.y };
  }

  private setPlayerLook(avatar: AvatarConfig) {
    const key = ensureAvatarTexture(this, avatar);
    if (key === this.playerKey && this.player.texture.key === key) return;
    this.playerKey = key;
    this.player.anims.stop();
    this.player.setTexture(key, idleFrame(this.facing));
  }

  private buildAmbience() {
    this.nightOverlay = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x1b2550, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(20_000);
    this.updateDaylight();
    this.time.addEvent({ delay: 60_000, loop: true, callback: () => this.updateDaylight() });

    if (this.reducedMotion) return;
    for (let i = 0; i < 6; i++) {
      const b = this.add.image(Phaser.Math.Between(100, 1100), Phaser.Math.Between(150, 1000), "butterfly").setDepth(9500).setScale(0.8);
      const wander = () => {
        this.tweens.add({
          targets: b,
          x: Phaser.Math.Clamp(b.x + Phaser.Math.Between(-160, 160), 60, 1150),
          y: Phaser.Math.Clamp(b.y + Phaser.Math.Between(-120, 120), 120, 1040),
          duration: Phaser.Math.Between(2600, 4200),
          ease: "Sine.inOut",
          onComplete: wander,
        });
      };
      wander();
      this.tweens.add({ targets: b, scaleX: 0.25, duration: 160, yoyo: true, repeat: -1 });
    }
  }

  private updateDaylight() {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    let alpha = 0;
    let color = 0x1b2550;
    if (h >= 20.5 || h < 5.5) alpha = 0.38;
    else if (h >= 18.5) {
      color = 0xff8a3d;
      alpha = 0.14;
    } else if (h < 7) {
      color = 0xffb27a;
      alpha = 0.1;
    }
    this.nightOverlay.setFillStyle(color, alpha);
    const night = alpha > 0.3;
    const glow = night ? 0.85 : alpha > 0 ? 0.4 : 0;
    for (const l of this.lampLights) {
      this.tweens.killTweensOf(l);
      l.setAlpha(glow);
      if (glow && !this.reducedMotion) {
        this.tweens.add({ targets: l, alpha: glow * 0.8, duration: 1800 + Math.random() * 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      }
    }
    if (night && !this.fireflies && !this.reducedMotion) {
      this.fireflies = this.add
        .particles(0, 0, "glow", {
          x: { min: 0, max: WORLD_W },
          y: { min: 0, max: WORLD_H },
          lifespan: 4000,
          speed: { min: 4, max: 16 },
          scale: { start: 0.45, end: 0.1 },
          alpha: { start: 0, end: 1, ease: "Sine.inOut" },
          frequency: 120,
          blendMode: "ADD",
        })
        .setDepth(19_000);
    } else if (!night && this.fireflies) {
      this.fireflies.destroy();
      this.fireflies = undefined;
    }
  }

  private buildInput() {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: kb.addKey(K.UP), down: kb.addKey(K.DOWN), left: kb.addKey(K.LEFT), right: kb.addKey(K.RIGHT),
      w: kb.addKey(K.W), a: kb.addKey(K.A), s: kb.addKey(K.S), d: kb.addKey(K.D),
      e: kb.addKey(K.E), space: kb.addKey(K.SPACE), enter: kb.addKey(K.ENTER),
    };
    for (const k of [this.keys.e, this.keys.space, this.keys.enter]) k.on("down", () => this.interact());

    this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (!this.inputEnabled) return;
      if (p.getDistance() > 12 * this.dpr) return; // a drag, not a tap
      const wx = p.worldX;
      const wy = p.worldY;
      const hit = this.interactables.find((i) => Phaser.Math.Distance.Between(wx, wy, i.x, i.y - 20) < Math.max(40, i.radius * 0.8));
      this.pendingInteract = hit ? hit.id : null;
      this.walkTo(hit ? { x: hit.x, y: hit.y } : { x: wx, y: wy });
    });
  }

  private rebuildNav() {
    this.navRects = this.navRects.filter((r) => r.zone.active);
    this.nav = new NavGrid(WORLD_W, WORLD_H, 16);
    for (const r of this.navRects) {
      if (r.zone === this.gateBlock) continue;
      this.nav.markRect(r.x, r.y, r.w, r.h, true, NAV_PAD);
    }
    if (this.gateLocked) this.nav.markRect(this.gateBlock.x, this.gateBlock.y, 30, 100, true);
  }

  private walkTo(dest: Point) {
    this.target = dest;
    this.path = this.nav.findPath({ x: this.player.x, y: this.player.y }, dest) ?? [dest];
    this.stuckMs = 0;
  }

  private setInputEnabled(enabled: boolean) {
    this.inputEnabled = enabled;
    const kb = this.input.keyboard;
    if (kb) {
      kb.enabled = enabled;
      // Release arrow/space capture so React dialogs can use the keyboard.
      if (enabled) kb.enableGlobalCapture();
      else {
        kb.disableGlobalCapture();
        kb.resetKeys();
      }
    }
    this.setFocus(!enabled);
    if (!enabled) {
      this.target = null;
      this.path = [];
      this.pendingInteract = null;
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.player.setFrame(idleFrame(this.facing));
    }
  }

  // --- Snapshot from React ----------------------------------------------------

  private applyWorld(w: WorldSnapshot) {
    this.setPlayerLook(w.player.avatar);
    this.playerLabel.setText(w.player.name);

    const signature = w.family.map((m) => `${m.memberId}:${m.name}:${m.color}:${avatarKey(m.avatar)}`).join("|") + `|${w.player.memberId}`;
    let navDirty = false;
    if (signature !== this.houseSignature) {
      this.houseSignature = signature;
      this.buildHouses(w);
      navDirty = true;
    }

    for (const [id, img] of this.markers) {
      if (!w.markers[id]) {
        img.destroy();
        this.markers.delete(id);
      }
    }
    for (const [id, marker] of Object.entries(w.markers) as [InteractableId, Marker][]) {
      if (marker) this.setMarker(id, marker);
    }

    if (this.chestOpen === false && w.chestOpen) this.openChest();
    else if (this.chestOpen !== true || !w.chestOpen) this.chest.setTexture(w.chestOpen ? "chest-open" : "chest");
    this.chestOpen = w.chestOpen;
    this.gate.setTexture(w.forestUnlocked ? "gate-open" : "gate");
    const gateBody = this.gateBlock.body as Phaser.Physics.Arcade.StaticBody;
    gateBody.enable = !w.forestUnlocked;
    if (this.gateLocked !== !w.forestUnlocked) {
      this.gateLocked = !w.forestUnlocked;
      navDirty = true;
    }
    if (navDirty) this.rebuildNav();
  }

  private setMarker(id: InteractableId, marker: Exclude<Marker, null>) {
    const at = this.interactables.find((i) => i.id === id);
    const offset = MARKER_OFFSET[id];
    if (!at || offset === undefined) return;
    const key = marker === "claim" ? "marker-claim" : "marker-available";
    const existing = this.markers.get(id);
    if (existing) {
      existing.setTexture(key);
      return;
    }
    const baseY = (id === "guide" ? NPCS[0]!.y : id === "owl" ? NPCS[1]!.y : at.y) + offset;
    const img = this.add.image(at.x, baseY, key).setScale(0.55).setDepth(9100);
    if (!this.reducedMotion) {
      this.tweens.add({ targets: img, y: baseY - 6, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    }
    this.markers.set(id, img);
  }

  private buildHouses(w: WorldSnapshot) {
    for (const h of this.houses) h.parts.forEach((p) => p.destroy());
    this.houses = [];
    this.interactables = this.interactables.filter((i) => !i.id.startsWith("house:"));
    for (const id of [...this.things.keys()]) if (id.startsWith("house:")) this.things.delete(id);

    w.family.slice(0, HOUSE_SLOTS.length).forEach((m, idx) => {
      const slot = HOUSE_SLOTS[idx]!;
      const parts: Phaser.GameObjects.GameObject[] = [];
      const house = this.add.image(slot.x, slot.y, ensureHouseTexture(this, m.color)).setOrigin(0.5, 0.95).setScale(0.7).setDepth(slot.y);
      parts.push(house);
      this.things.set(`house:${m.memberId}`, house);
      parts.push(this.block(slot.x, slot.y - 30, 104, 52));
      parts.push(this.label(slot.x, slot.y - 112, this.t("game.place.house", { name: m.name })));
      if (m.memberId !== w.player.memberId) {
        const key = ensureAvatarTexture(this, m.avatar);
        const resident = this.add
          .sprite(slot.x + 46, slot.y + 16, key, idleFrame("down"))
          .setOrigin(0.5, 0.92)
          .setScale(AVATAR_SCALE)
          .setDepth(slot.y + 16);
        parts.push(resident, this.label(slot.x + 46, slot.y - 26, m.name, true));
        if (!this.reducedMotion) {
          this.time.addEvent({
            delay: 2400 + idx * 500,
            loop: true,
            callback: () => {
              if (!resident.active) return;
              const look: Facing[] = ["down", "left", "right", "down"];
              resident.setFrame(idleFrame(look[Math.floor(Math.random() * look.length)]!));
            },
          });
        }
      }
      this.houses.push({ memberId: m.memberId, parts });
      this.interactables.push({ id: `house:${m.memberId}`, x: slot.x, y: slot.y + 14, radius: 52 });
    });
    if (this.tracked) this.setTracked(this.tracked);
  }

  // --- Interaction ------------------------------------------------------------

  private nearest(): InteractableId | null {
    let best: { id: InteractableId; d: number } | null = null;
    for (const i of this.interactables) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, i.x, i.y);
      if (d <= i.radius && (!best || d < best.d)) best = { id: i.id, d };
    }
    return best?.id ?? null;
  }

  private interact() {
    if (!this.inputEnabled || !this.nearby) return;
    this.use(this.nearby);
  }

  private use(id: InteractableId) {
    this.feedback(id);
    this.bridge.emit("interact", id);
  }

  /** Hop (characters, small props) plus a ring flash, so every use registers. */
  private feedback(id: InteractableId) {
    if (this.reducedMotion) return;
    const obj = this.things.get(id);
    const at = this.interactables.find((i) => i.id === id);
    if (obj && HOPPERS.includes(id) && !this.tweens.isTweening(obj)) {
      this.tweens.add({ targets: obj, y: obj.y - 7, duration: 110, yoyo: true, ease: "Quad.out" });
    }
    if (at) {
      const s = (RING_SCALE[id] ?? 1) * 0.9;
      const flash = this.add.image(at.x, at.y, "ring").setScale(s).setDepth(-6890);
      this.tweens.add({ targets: flash, scale: s * 1.5, alpha: 0, duration: 420, ease: "Cubic.out", onComplete: () => flash.destroy() });
    }
  }

  private celebrate(at?: InteractableId, items: RewardFloat[] = []) {
    const spot = at && this.interactables.find((i) => i.id === at);
    const x = spot ? spot.x : this.player.x;
    const y = spot ? spot.y - 40 : this.player.y - 30;
    if (at === "chest" && this.chestOpen === false) {
      // Claimed before the refreshed snapshot arrives: play the lid now.
      this.chestOpen = true;
      this.openChest(items);
      return;
    }
    this.burst(x, y);
    this.floatRewards(x, y - 10, items);
  }

  private burst(x: number, y: number) {
    if (this.reducedMotion) return;
    const burst = this.add
      .particles(x, y, "sparkle", {
        speed: { min: 80, max: 220 },
        angle: { min: 200, max: 340 },
        gravityY: 260,
        lifespan: 1100,
        scale: { start: 0.9, end: 0.1 },
        rotate: { start: 0, end: 360 },
        tint: [0xffe27a, 0xff9ad0, 0x8fd3f5, 0xffffff],
        emitting: false,
      })
      .setDepth(15_000);
    burst.explode(36);
    this.time.delayedCall(1400, () => burst.destroy());
  }

  private floatRewards(x: number, y: number, items: RewardFloat[]) {
    items.forEach((item, i) => {
      const txt = this.add
        .text(x, y - i * 20, item.text, {
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          fontSize: "15px",
          fontStyle: "bold",
          color: item.color,
          stroke: "#2a2140",
          strokeThickness: 4,
          resolution: Math.max(2, this.dpr * 2),
        })
        .setOrigin(0.5, 1)
        .setDepth(15_100)
        .setAlpha(0);
      if (this.reducedMotion) {
        txt.setAlpha(1);
        this.time.delayedCall(1400, () => txt.destroy());
        return;
      }
      this.tweens.add({
        targets: txt,
        y: y - i * 20 - 48,
        alpha: { from: 1, to: 0 },
        duration: 1300,
        delay: i * 140,
        ease: "Cubic.out",
        onStart: () => txt.setAlpha(1),
        onComplete: () => txt.destroy(),
      });
    });
  }

  /** Shake, pop the lid, glow, and burst. Falls back to a plain swap with reduced motion. */
  private openChest(items: RewardFloat[] = []) {
    const c = this.chest;
    const done = () => {
      c.setTexture("chest-open");
      this.burst(c.x, c.y - 30);
      this.floatRewards(c.x, c.y - 46, items);
      if (this.reducedMotion) return;
      const base = c.scale;
      this.tweens.add({ targets: c, scale: base * 1.15, duration: 140, yoyo: true, ease: "Back.out" });
      const light = this.add.image(c.x, c.y - 24, "light").setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setDepth(c.depth + 1);
      this.tweens.add({ targets: light, scale: 1.1, alpha: 0, duration: 700, ease: "Cubic.out", onComplete: () => light.destroy() });
    };
    if (this.reducedMotion) return done();
    this.tweens.add({ targets: c, angle: { from: -6, to: 6 }, duration: 70, yoyo: true, repeat: 3, onComplete: () => { c.setAngle(0); done(); } });
  }

  /** Gentle push-in while a menu or dialogue is open. */
  private setFocus(on: boolean) {
    if (on === this.focused) return;
    this.focused = on;
    if (this.reducedMotion) return;
    this.cameras.main.zoomTo(on ? this.baseZoom * 1.06 : this.baseZoom, 320, "Sine.easeInOut", true);
  }

  private enterMemory(session: MemorySession) {
    this.setInputEnabled(false);
    const go = () => {
      this.scene.launch("memory", { session });
      this.scene.sleep();
    };
    if (this.reducedMotion) go();
    else {
      this.cameras.main.fadeOut(300, 20, 12, 40);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, go);
    }
  }

  private onWake() {
    this.setInputEnabled(true);
    this.applyZoom();
    if (!this.reducedMotion) this.cameras.main.fadeIn(350, 20, 12, 40);
    else this.cameras.main.resetFX();
  }

  // --- Layout -----------------------------------------------------------------

  private onResize(size: Phaser.Structs.Size) {
    this.cameras.main.setSize(size.width, size.height);
    this.nightOverlay?.setSize(size.width, size.height);
    this.applyZoom();
  }

  private applyZoom() {
    const w = this.scale.width;
    const h = this.scale.height;
    const css = Math.min(w, h) / this.dpr;
    const base = Phaser.Math.Clamp(css / 420, 1, 1.6) * this.dpr;
    const cover = Math.max(w / WORLD_W, h / WORLD_H);
    this.baseZoom = Math.max(base, cover);
    this.cameras.main.setZoom(this.focused && !this.reducedMotion ? this.baseZoom * 1.06 : this.baseZoom);
    const cam = this.cameras.main;
    cam.setDeadzone(this.reducedMotion ? 0 : (w * 0.05) / this.baseZoom, this.reducedMotion ? 0 : (h * 0.05) / this.baseZoom);
  }

  update(time: number, delta: number) {
    if (!this.player?.body) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    let vy = 0;

    if (this.inputEnabled) {
      const k = this.keys;
      if (k.left.isDown || k.a.isDown) vx -= 1;
      if (k.right.isDown || k.d.isDown) vx += 1;
      if (k.up.isDown || k.w.isDown) vy -= 1;
      if (k.down.isDown || k.s.isDown) vy += 1;

      if (vx !== 0 || vy !== 0) {
        this.target = null;
        this.path = [];
        this.pendingInteract = null;
      } else if (this.target) {
        let wp = this.path[0] ?? this.target;
        if (this.path.length > 1 && Math.hypot(wp.x - this.player.x, wp.y - this.player.y) < 6) {
          this.path.shift();
          wp = this.path[0]!;
        }
        const dx = wp.x - this.player.x;
        const dy = wp.y - this.player.y;
        const dist = Math.hypot(dx, dy);
        const pending = this.pendingInteract && this.interactables.find((i) => i.id === this.pendingInteract);
        if ((dist < 6 && this.path.length <= 1) || (pending && Phaser.Math.Distance.Between(this.player.x, this.player.y, pending.x, pending.y) < pending.radius * 0.7)) {
          this.arrive();
        } else {
          vx = dx / dist;
          vy = dy / dist;
          const moved = Math.hypot(this.player.x - this.lastPos.x, this.player.y - this.lastPos.y);
          this.stuckMs = moved < 0.3 ? this.stuckMs + delta : 0;
          if (this.stuckMs > 350) this.arrive();
        }
      }
    }
    this.lastPos = { x: this.player.x, y: this.player.y };

    const len = Math.hypot(vx, vy);
    if (len > 0) {
      body.setVelocity((vx / len) * SPEED, (vy / len) * SPEED);
      this.facing = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? "left" : "right") : vy < 0 ? "up" : "down";
      const anim = `${this.playerKey}-walk-${this.facing}`;
      if (this.player.anims.currentAnim?.key !== anim || !this.player.anims.isPlaying) this.player.play(anim, true);
    } else {
      body.setVelocity(0, 0);
      if (this.player.anims.isPlaying) {
        this.player.anims.stop();
        this.player.setFrame(idleFrame(this.facing));
      }
    }

    this.player.setDepth(this.player.y);
    this.playerLabel.setPosition(this.player.x, this.player.y - 44);
    this.playerShadow.setPosition(this.player.x, this.player.y - 2);
    this.animatePlayer(time, delta, len > 0);

    const near = this.nearest();
    if (near !== this.nearby) {
      this.nearby = near;
      for (const [id, img] of this.markers) img.setScale(id === near ? 0.7 : 0.55);
      this.showHighlight(near);
      this.bridge.emit("nearby", near);
    }
    this.updateEdgeArrow();

    this.playerEmitMs += delta;
    if (this.playerEmitMs > 120) {
      this.playerEmitMs = 0;
      const last = this.bridge.latest("player");
      if (!last || Math.abs(last.x - this.player.x) + Math.abs(last.y - this.player.y) > 1) {
        this.bridge.emit("player", { x: Math.round(this.player.x), y: Math.round(this.player.y) });
      }
    }
  }

  /** Breathing while idle, a stride bob, dust puffs, and bushes that rustle as you pass. */
  private animatePlayer(time: number, delta: number, moving: boolean) {
    if (this.reducedMotion) return;
    const bob = moving ? 1 - 0.03 * Math.abs(Math.sin(time / 75)) : 1 + 0.016 * Math.sin(time / 420);
    this.player.setScale(AVATAR_SCALE, AVATAR_SCALE * bob);
    if (!moving) return;
    this.dustMs += delta;
    if (this.dust && this.dustMs > 170) {
      this.dustMs = 0;
      this.dust.setDepth(this.player.y - 1);
      this.dust.emitParticleAt(this.player.x + Phaser.Math.Between(-4, 4), this.player.y - 2, 1);
    }
    this.rustleMs += delta;
    if (this.rustleMs < 100) return;
    this.rustleMs = 0;
    for (const b of this.bushes) {
      if (this.rustling.has(b) || Math.abs(b.x - this.player.x) > 30 || Math.abs(b.y - this.player.y) > 24) continue;
      this.rustling.add(b);
      this.tweens.add({
        targets: b,
        angle: { from: -5, to: 5 },
        duration: 80,
        yoyo: true,
        repeat: 2,
        onComplete: () => {
          b.setAngle(0);
          this.time.delayedCall(400, () => this.rustling.delete(b));
        },
      });
    }
  }

  private showHighlight(id: InteractableId | null) {
    const at = id && this.interactables.find((i) => i.id === id);
    if (!at) {
      this.highlight.setVisible(false);
      this.prompt.setVisible(false);
      return;
    }
    const s = RING_SCALE[id] ?? (id.startsWith("house:") ? 1.1 : 0.8);
    this.highlight.setPosition(at.x, at.y).setScale(s).setVisible(true);
    // Key hint sits at the ring's right edge so it never covers names or sprites.
    this.prompt.setPosition(at.x + 64 * s + 10, at.y + 8).setDepth(at.y + 40).setVisible(!this.touch);
  }

  /** Clamp the tracked objective to the viewport edge when it is off-screen. */
  private updateEdgeArrow() {
    const at = this.tracked && this.interactables.find((i) => i.id === this.tracked);
    if (!at || !this.inputEnabled) {
      this.edgeArrow.setVisible(false);
      return;
    }
    const cam = this.cameras.main;
    const v = cam.worldView;
    const k = this.dpr / cam.zoom;
    const left = v.x + EDGE_INSET.left * k;
    const right = v.right - EDGE_INSET.right * k;
    // Phones stack the HUD taller, so keep the arrow below the tracker there.
    const topCss = this.scale.width / this.dpr < 640 ? 190 : EDGE_INSET.top;
    const top = v.y + Math.min(topCss * k, v.height * 0.35);
    const bottom = v.bottom - EDGE_INSET.bottom * k;
    const tx = at.x;
    const ty = at.y - 30;
    if (tx > left && tx < right && ty > top && ty < bottom) {
      this.edgeArrow.setVisible(false);
      return;
    }
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const dx = tx - cx;
    const dy = ty - cy;
    const scale = Math.min(dx ? (dx > 0 ? right - cx : left - cx) / dx : Infinity, dy ? (dy > 0 ? bottom - cy : top - cy) / dy : Infinity);
    this.edgeArrow
      .setPosition(cx + dx * scale, cy + dy * scale)
      .setRotation(Math.atan2(dy, dx))
      .setScale(0.7 * k)
      .setVisible(true);
  }

  private arrive() {
    const pending = this.pendingInteract;
    this.target = null;
    this.path = [];
    this.pendingInteract = null;
    this.stuckMs = 0;
    if (pending) {
      const at = this.interactables.find((i) => i.id === pending);
      if (at && Phaser.Math.Distance.Between(this.player.x, this.player.y, at.x, at.y) < at.radius * 1.4) {
        this.use(pending);
      }
    }
  }
}
