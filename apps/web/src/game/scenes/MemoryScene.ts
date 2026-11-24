import Phaser from "phaser";
import { CARD_H, CARD_W, generateMemoryArt } from "../art";
import type { GameBridge } from "../bridge";
import type { MemorySession } from "../types";

type Translate = (key: string, params?: Record<string, unknown>) => string;

interface Card {
  index: number;
  symbol: number;
  container: Phaser.GameObjects.Container;
  image: Phaser.GameObjects.Image;
  faceUp: boolean;
  matched: boolean;
}

const MISMATCH_MS = 750;

/**
 * Memory Crystal Challenge board. The scene records every flip; the server
 * replays that sequence against the deck it dealt before granting a reward.
 */
export class MemoryScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private t!: Translate;
  private dpr = 1;
  private reducedMotion = false;

  private session!: MemorySession;
  private cards: Card[] = [];
  private open: Card[] = [];
  private flips: number[] = [];
  private moves = 0;
  private matchedPairs = 0;
  private busy = false;
  private finished = false;
  private startedAt = 0;
  private focus = 0;

  private bg!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private focusRing!: Phaser.GameObjects.Graphics;
  private unsubscribers: (() => void)[] = [];

  constructor() {
    super("memory");
  }

  init(data: { session: MemorySession }) {
    this.session = data.session;
    this.cards = [];
    this.open = [];
    this.flips = [];
    this.moves = 0;
    this.matchedPairs = 0;
    this.busy = false;
    this.finished = false;
    this.focus = 0;
  }

  create() {
    this.bridge = this.registry.get("bridge") as GameBridge;
    this.t = this.registry.get("t") as Translate;
    this.dpr = (this.registry.get("dpr") as number) ?? 1;
    this.reducedMotion = !!this.registry.get("reducedMotion");
    generateMemoryArt(this);

    this.bg = this.add.graphics();
    if (!this.reducedMotion) {
      this.add
        .particles(0, 0, "glow", {
          x: { min: 0, max: this.scale.width },
          y: { min: 0, max: this.scale.height },
          lifespan: 5000,
          speedY: { min: -12, max: -4 },
          scale: { start: 0.3 * this.dpr, end: 0 },
          alpha: { start: 0.6, end: 0 },
          frequency: 260,
          blendMode: "ADD",
        })
        .setDepth(1);
    }

    const font = "system-ui, -apple-system, Segoe UI, sans-serif";
    this.title = this.add
      .text(0, 0, this.t("game.memory.levelTitle", { level: this.session.level }), {
        fontFamily: font, fontSize: `${20 * this.dpr}px`, fontStyle: "bold", color: "#fff7d6",
      })
      .setOrigin(0.5, 0)
      .setDepth(5);
    this.hud = this.add
      .text(0, 0, "", { fontFamily: font, fontSize: `${14 * this.dpr}px`, color: "#e9e2ff" })
      .setOrigin(0.5, 0)
      .setDepth(5);

    this.session.deck.forEach((symbol, index) => {
      const image = this.add.image(0, 0, "card-back");
      const container = this.add.container(0, 0, [image]).setDepth(10);
      container.setSize(CARD_W, CARD_H).setInteractive({ useHandCursor: true });
      const card: Card = { index, symbol, container, image, faceUp: false, matched: false };
      container.on(Phaser.Input.Events.POINTER_DOWN, () => this.flip(card));
      container.on(Phaser.Input.Events.POINTER_OVER, () => !card.faceUp && container.setAlpha(0.92));
      container.on(Phaser.Input.Events.POINTER_OUT, () => container.setAlpha(1));
      this.cards.push(card);
    });
    this.focusRing = this.add.graphics().setDepth(11).setVisible(false);

    const kb = this.input.keyboard!;
    kb.enabled = true;
    kb.enableGlobalCapture();
    kb.on("keydown", this.onKey, this);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.unsubscribers.push(this.bridge.on("endMemory", () => this.leave()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);

    // The scene clock has not ticked yet during create(), so use wall time.
    this.startedAt = performance.now();
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.updateHud() });
    this.updateHud();
    if (!this.reducedMotion) {
      this.cameras.main.fadeIn(300, 20, 12, 40);
      this.cards.forEach((c, i) => {
        c.container.setScale(0);
        this.tweens.add({ targets: c.container, scale: c.container.getData("scale") ?? 1, delay: i * 30, duration: 260, ease: "Back.out" });
      });
    }
  }

  private cleanup() {
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.input.keyboard?.off("keydown", this.onKey, this);
  }

  private leave() {
    this.scene.stop();
    // In board-only mode (Learning Academy) the host page unmounts the game instead.
    if (this.scene.manager.keys["village"]) this.scene.wake("village");
  }

  private layout() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.bg.clear();
    this.bg.fillGradientStyle(0x2b1f5c, 0x2b1f5c, 0x15284d, 0x15284d, 1);
    this.bg.fillRect(0, 0, w, h);
    // Bookshelves along the academy walls
    const shelfW = Math.min(90 * this.dpr, w * 0.12);
    for (const x of [0, w - shelfW]) {
      this.bg.fillStyle(0x4a2f22, 0.9);
      this.bg.fillRect(x, 0, shelfW, h);
      const colors = [0xe85d75, 0x3b82f6, 0xf59e0b, 0x22a06b, 0x8b5cf6];
      for (let y = 20 * this.dpr, row = 0; y < h; y += 70 * this.dpr, row++) {
        this.bg.fillStyle(0x6b4430, 1);
        this.bg.fillRect(x, y + 52 * this.dpr, shelfW, 6 * this.dpr);
        for (let b = 0; b < 5; b++) {
          this.bg.fillStyle(colors[(b + row) % colors.length]!, 0.85);
          const bw = shelfW / 7;
          this.bg.fillRect(x + 6 * this.dpr + b * (bw + 2), y + (10 + (b % 2) * 6) * this.dpr, bw, (42 - (b % 2) * 6) * this.dpr);
        }
      }
    }

    const cols = this.session.cols;
    const rows = Math.ceil(this.session.deck.length / cols);
    const top = 70 * this.dpr;
    const sidePad = shelfW + 12 * this.dpr;
    const availW = w - sidePad * 2;
    const availH = h - top - 16 * this.dpr;
    const gap = 10 * this.dpr;
    const scale = Math.min((availW - gap * (cols - 1)) / cols / CARD_W, (availH - gap * (rows - 1)) / rows / CARD_H, 1.2 * this.dpr);
    const cw = CARD_W * scale;
    const ch = CARD_H * scale;
    const gridW = cols * cw + (cols - 1) * gap;
    const gridH = rows * ch + (rows - 1) * gap;
    const x0 = (w - gridW) / 2 + cw / 2;
    const y0 = top + (availH - gridH) / 2 + ch / 2;
    this.cards.forEach((c, i) => {
      c.container.setPosition(x0 + (i % cols) * (cw + gap), y0 + Math.floor(i / cols) * (ch + gap));
      c.container.setData("scale", scale);
      if (!this.tweens.isTweening(c.container)) c.container.setScale(scale);
    });
    this.title.setPosition(w / 2, 14 * this.dpr);
    this.hud.setPosition(w / 2, 42 * this.dpr);
    this.drawFocus();
  }

  private updateHud() {
    if (this.finished) return;
    const seconds = Math.floor((performance.now() - this.startedAt) / 1000);
    this.hud.setText(
      this.t("game.memory.hud", { moves: this.moves, pairs: this.matchedPairs, total: this.session.pairs, seconds }),
    );
  }

  private onKey(e: KeyboardEvent) {
    const cols = this.session.cols;
    const n = this.cards.length;
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
    if (e.key in moves) {
      this.focus = Phaser.Math.Clamp(this.focus + moves[e.key]!, 0, n - 1);
      this.focusRing.setVisible(true);
      this.drawFocus();
    } else if (e.key === "Enter" || e.key === " ") {
      this.focusRing.setVisible(true);
      this.flip(this.cards[this.focus]!);
    }
  }

  private drawFocus() {
    const card = this.cards[this.focus];
    if (!card) return;
    const s = (card.container.getData("scale") as number) ?? 1;
    this.focusRing.clear();
    this.focusRing.lineStyle(4 * this.dpr, 0xffe27a, 1);
    this.focusRing.strokeRoundedRect(
      card.container.x - (CARD_W * s) / 2 - 4 * this.dpr,
      card.container.y - (CARD_H * s) / 2 - 4 * this.dpr,
      CARD_W * s + 8 * this.dpr,
      CARD_H * s + 8 * this.dpr,
      14 * this.dpr,
    );
  }

  private turn(card: Card, faceUp: boolean, done?: () => void) {
    card.faceUp = faceUp;
    const key = faceUp ? `card-face-${card.symbol}` : "card-back";
    if (this.reducedMotion) {
      card.image.setTexture(key);
      done?.();
      return;
    }
    const s = (card.container.getData("scale") as number) ?? 1;
    this.tweens.add({
      targets: card.container,
      scaleX: 0,
      duration: 110,
      ease: "Quad.in",
      onComplete: () => {
        card.image.setTexture(key);
        this.tweens.add({ targets: card.container, scaleX: s, duration: 130, ease: "Quad.out", onComplete: () => done?.() });
      },
    });
  }

  private flip(card: Card) {
    if (this.busy || this.finished || card.faceUp || card.matched) return;
    card.container.setAlpha(1);
    this.flips.push(card.index);
    this.open.push(card);
    this.turn(card, true);
    if (this.open.length < 2) return;

    this.moves++;
    const [a, b] = this.open as [Card, Card];
    this.open = [];
    if (a.symbol === b.symbol) {
      a.matched = b.matched = true;
      this.matchedPairs++;
      this.time.delayedCall(260, () => {
        this.burst(a.container.x, a.container.y, 10);
        this.burst(b.container.x, b.container.y, 10);
        if (!this.reducedMotion) {
          const s = (a.container.getData("scale") as number) ?? 1;
          this.tweens.add({ targets: [a.container, b.container], scale: s * 1.08, duration: 140, yoyo: true });
        }
      });
      if (this.matchedPairs === this.session.pairs) this.win();
    } else {
      this.busy = true;
      this.time.delayedCall(MISMATCH_MS, () => {
        this.turn(a, false);
        this.turn(b, false, () => (this.busy = false));
      });
    }
    this.updateHud();
  }

  private burst(x: number, y: number, count: number) {
    if (this.reducedMotion) return;
    const p = this.add
      .particles(x, y, "sparkle", {
        speed: { min: 60 * this.dpr, max: 200 * this.dpr },
        lifespan: 800,
        scale: { start: 0.8 * this.dpr, end: 0 },
        rotate: { start: 0, end: 300 },
        tint: [0xffe27a, 0xff9ad0, 0x8fd3f5, 0xffffff],
        emitting: false,
      })
      .setDepth(20);
    p.explode(count);
    this.time.delayedCall(1000, () => p.destroy());
  }

  private win() {
    this.finished = true;
    this.updateHudFinal();
    this.time.delayedCall(450, () => {
      const { width, height } = this.scale;
      for (let i = 0; i < 5; i++) {
        this.time.delayedCall(i * 160, () => this.burst(Phaser.Math.Between(width * 0.2, width * 0.8), Phaser.Math.Between(height * 0.25, height * 0.7), 24));
      }
      this.bridge.emit("memoryFinished", { sessionId: this.session.sessionId, flips: [...this.flips] });
    });
  }

  private updateHudFinal() {
    const seconds = Math.floor((performance.now() - this.startedAt) / 1000);
    this.hud.setText(this.t("game.memory.hud", { moves: this.moves, pairs: this.matchedPairs, total: this.session.pairs, seconds }));
  }
}
