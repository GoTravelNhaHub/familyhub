import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import Phaser from "phaser";
import type { GameBridge } from "./bridge";
import { VillageScene } from "./scenes/VillageScene";
import { MemoryScene } from "./scenes/MemoryScene";

/**
 * Owns exactly one Phaser.Game per mount and destroys it on unmount, so route
 * changes never leak canvases, loops, or listeners. Renders at device pixel
 * ratio (capped at 2) and lets CSS size the canvas via `zoom: 1 / dpr`.
 */
export function GameCanvas({ bridge }: { bridge: GameBridge }) {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const size = () => ({
      width: Math.max(1, Math.round(el.clientWidth * dpr)),
      height: Math.max(1, Math.round(el.clientHeight * dpr)),
    });

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: el,
      ...size(),
      backgroundColor: "#2b1f5c",
      banner: false,
      scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
      physics: { default: "arcade", arcade: { debug: false } },
      render: { antialias: true, roundPixels: false, powerPreference: "low-power" },
      input: { activePointers: 2 },
      audio: { noAudio: true }, // the game has no sound; avoids AudioContext errors on teardown
      callbacks: {
        preBoot: (g) => {
          g.registry.set("bridge", bridge);
          g.registry.set("t", (key: string, params?: Record<string, unknown>) => tRef.current(key, params) as string);
          g.registry.set("dpr", dpr);
          g.registry.set("reducedMotion", reducedMotion);
          g.registry.set("touch", window.matchMedia?.("(pointer: coarse)").matches ?? false);
        },
      },
      scene: [VillageScene, MemoryScene],
    });

    const ro = new ResizeObserver(() => {
      const s = size();
      if (s.width !== game.scale.width || s.height !== game.scale.height) game.scale.resize(s.width, s.height);
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      game.destroy(true);
    };
  }, [bridge]);

  return <div ref={ref} className="game-canvas" />;
}
