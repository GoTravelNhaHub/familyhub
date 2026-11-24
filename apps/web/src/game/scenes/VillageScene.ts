import Phaser from "phaser";
import { avatarKey, type AvatarConfig, type Facing } from "../avatar";
import { ensureAvatarTexture, ensureHouseTexture, generateNpcArt, generateWorldArt, idleFrame } from "../art";
import type { GameBridge, InteractableId, Marker, WorldSnapshot } from "../bridge";
import type { MemorySession } from "../types";
import { NavGrid, type Point } from "../pathfinding";
import {
  FOREST_FENCE_X,
  HOUSE_SLOTS,
  INTERACTABLES,
  NPCS,
  PROPS,
  RIVER,
  SPAWN,
  WORLD_H,
  WORLD_W,
  scatterDecorations,
  type Interactable,
} from "../world";

const SPEED = 150;
const AVATAR_SCALE = 0.5;
const GUIDE_LOOK: AvatarConfig = {
  v: 1, skin: "#eab68f", hair: "bun", hairColor: "#5a5f7a", outfit: "#0ea5a4", accessory: "glasses",
};
const MARKER_OFFSET: Partial<Record<InteractableId, number>> = { guide: -84, owl: -90, board: -140, chest: -52 };
/** Clearance around obstacles for the player's footprint when path-finding. */
const NAV_PAD = 9;

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

    generateWorldArt(this);
    generateNpcArt(this);

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.add.image(0, 0, "ground").setOrigin(0, 0).setDepth(-10_000);
    this.obstacles = this.physics.add.staticGroup();

    this.buildRiver();
    this.buildDecorations();
    this.buildProps();
    this.buildForestFence();
    this.buildNpcs();
    this.buildPlayer();
    this.buildAmbience();
    this.buildInput();
    this.rebuildNav();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(this.player, true, this.reducedMotion ? 1 : 0.12, this.reducedMotion ? 1 : 0.12);
    this.applyZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    if (!this.reducedMotion) cam.fadeIn(400, 0, 0, 0);

    this.unsubscribers.push(
      this.bridge.on("world", (w) => this.applyWorld(w)),
      this.bridge.on("triggerInteract", () => this.interact()),
      this.bridge.on("setInputEnabled", (enabled) => this.setInputEnabled(enabled)),
      this.bridge.on("celebrate", () => this.celebrate(this.player.x, this.player.y - 20)),
      this.bridge.on("startMemory", (session) => this.enterMemory(session)),
    );
    const snapshot = this.bridge.latest("world");
    if (snapshot) this.applyWorld(snapshot);

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
      }
    }
  }

  private buildProps() {
    for (const p of PROPS) {
      switch (p.kind) {
        case "academy":
          this.add.image(p.x, p.y, "academy").setOrigin(0.5, 0.95).setScale(0.8).setDepth(p.y);
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
          this.add.image(p.x, p.y, "board").setOrigin(0.5, 0.92).setScale(0.7).setDepth(p.y);
          this.block(p.x, p.y - 6, 66, 14);
          this.label(p.x, p.y - 92, this.t("game.place.board"));
          break;
        case "chest":
          this.chest = this.add.image(p.x, p.y, "chest").setOrigin(0.5, 0.9).setScale(0.62).setDepth(p.y);
          this.block(p.x, p.y - 8, 40, 16);
          break;
        case "bridge":
          this.add.image(p.x, p.y, "bridge").setDisplaySize(112, 70).setDepth(-8000);
          break;
        case "gate":
          this.gate = this.add.image(p.x, p.y, "gate").setOrigin(0.5, 0.95).setScale(0.75).setDepth(p.y);
          this.label(p.x, p.y - 104, this.t("game.place.forest"));
          break;
      }
    }
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

    this.chest.setTexture(w.chestOpen ? "chest-open" : "chest");
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

    w.family.slice(0, HOUSE_SLOTS.length).forEach((m, idx) => {
      const slot = HOUSE_SLOTS[idx]!;
      const parts: Phaser.GameObjects.GameObject[] = [];
      parts.push(this.add.image(slot.x, slot.y, ensureHouseTexture(this, m.color)).setOrigin(0.5, 0.95).setScale(0.7).setDepth(slot.y));
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
    this.bridge.emit("interact", this.nearby);
  }

  private celebrate(x: number, y: number) {
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
    this.cameras.main.setZoom(Math.max(base, cover));
  }

  update(_time: number, delta: number) {
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

    const near = this.nearest();
    if (near !== this.nearby) {
      this.nearby = near;
      for (const [id, img] of this.markers) img.setScale(id === near ? 0.7 : 0.55);
      this.bridge.emit("nearby", near);
    }
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
        this.bridge.emit("interact", pending);
      }
    }
  }
}
