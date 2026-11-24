// Viewport-anchored HUD: player card, quest tracker, menu, minimap, and the
// first-run coach. Everything here sits in DOM layers above the canvas with
// pointer-events only on the controls, so the world stays tappable around them.

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { InteractableId } from "../bridge";
import type { GameState, Quest, QuestNpc, Resources } from "../types";
import { HOUSE_SLOTS, INTERACTABLES, FOREST_FENCE_X, PATHS, PLAZA, RIVER, WORLD_H, WORLD_W } from "../world";
import { AvatarPortrait } from "./AvatarEditor";
import { PinIcon, RESOURCE_ICONS } from "./icons";
import { useResourceLabel } from "./Panels";

// --- Objective ------------------------------------------------------------------

const NPC_TARGET: Record<QuestNpc, InteractableId> = { guide: "guide", owl: "owl", board: "board" };
const KIND_ORDER: Record<Quest["kind"], number> = { story: 0, activity: 1, daily: 2 };

export interface Objective {
  key: string;
  who?: QuestNpc;
  target: InteractableId | null;
  quest?: Quest;
  ready: boolean;
}

/** What the player should do next: claim > in progress > story to start > chest > anything else. */
export function pickObjective(state: GameState): Objective {
  const sorted = (status: Quest["status"]) =>
    state.quests.filter((q) => q.status === status).sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  const claim = sorted("completed")[0];
  if (claim) return { key: "game.track.claim", who: claim.npc, target: NPC_TARGET[claim.npc], quest: claim, ready: true };
  const active = sorted("active")[0];
  if (active) {
    const o = active.objective;
    if (o.type === "minigame") return { key: "game.track.memory", who: "owl", target: "owl", quest: active, ready: false };
    if (o.type === "task") return { key: "game.track.task", who: "board", target: "board", quest: active, ready: false };
    return { key: "game.track.talk", who: o.npc, target: NPC_TARGET[o.npc], quest: active, ready: false };
  }
  const available = sorted("available");
  const story = available.find((q) => q.kind === "story");
  if (story) return { key: "game.track.accept", who: story.npc, target: NPC_TARGET[story.npc], quest: story, ready: false };
  if (!state.dailyChest.claimed) return { key: "game.track.chest", target: "chest", ready: false };
  const next = available[0];
  if (next) return { key: "game.track.accept", who: next.npc, target: NPC_TARGET[next.npc], quest: next, ready: false };
  return { key: "game.track.explore", target: null, ready: false };
}

function useWho() {
  const { t } = useTranslation();
  return (who?: QuestNpc) => (who === "board" ? t("game.place.board") : who ? t(`game.npc.${who}.name`) : "");
}

// --- Player card --------------------------------------------------------------------

/** Re-triggers a CSS animation whenever `value` changes (not on first render). */
function useBump(value: number) {
  const prev = useRef(value);
  const [n, setN] = useState(0);
  const [delta, setDelta] = useState(0);
  useEffect(() => {
    if (value !== prev.current) {
      setDelta(value - prev.current);
      setN((x) => x + 1);
      prev.current = value;
    }
  }, [value]);
  return { n, delta };
}

function ResourceValue({ k, value, label }: { k: keyof Resources; value: number; label: string }) {
  const Icon = RESOURCE_ICONS[k];
  const { n } = useBump(value);
  return (
    <span className="g-res-item" title={label}>
      <Icon size={16} />
      <b key={n} className={n ? "g-bump" : undefined}>{value}</b>
      <span className="sr-only"> {label}</span>
    </span>
  );
}

export function PlayerCard({ state }: { state: GameState }) {
  const { t } = useTranslation();
  const label = useResourceLabel();
  const { level, intoLevel, span, xp } = state.player.level;
  const pct = Math.max(0, Math.min(100, Math.round((intoLevel / Math.max(1, span)) * 100)));
  const xpBump = useBump(xp);
  const lvBump = useBump(level);
  return (
    <div className={`g-card ${lvBump.n ? "levelup" : ""}`} key={`lv-${lvBump.n}`}>
      <div className="g-card-portrait">
        <AvatarPortrait avatar={state.player.avatar} size={44} />
        <span className="g-card-lv" aria-hidden>{level}</span>
      </div>
      <div className="g-card-main">
        <div className="g-card-name">
          <span className="g-card-player">{state.player.name}</span>
          <span className="g-lv">{t("game.ui.level", { level })}</span>
          <span className="g-family-chip" title={state.family.name}>
            {t("game.ui.familyLevel", { level: state.family.level.level })}
          </span>
        </div>
        <div className="g-xp">
          <div
            className="g-xpbar"
            role="progressbar"
            aria-label={t("game.resource.xp")}
            aria-valuemin={0}
            aria-valuemax={span}
            aria-valuenow={intoLevel}
          >
            <div className="g-xpfill" style={{ width: `${pct}%` }} />
          </div>
          <span className="g-xptext">{t("game.ui.xp", { into: intoLevel, span })}</span>
          {xpBump.n > 0 && xpBump.delta > 0 && (
            <span key={xpBump.n} className="g-xpgain" aria-hidden>+{xpBump.delta}</span>
          )}
        </div>
        <div className="g-res">
          {(["coins", "crystals", "materials"] as const).map((k) => (
            <ResourceValue key={k} k={k} value={state.player.resources[k]} label={label(k)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Quest tracker ------------------------------------------------------------------

export function QuestTracker({
  objective,
  onGo,
  onOpen,
}: {
  objective: Objective;
  onGo: (() => void) | null;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const who = useWho();
  const q = objective.quest;
  return (
    <div className={`g-tracker ${objective.ready ? "ready" : ""}`} role="status">
      <button type="button" className="g-tracker-main" onClick={onOpen}>
        <span className="g-tracker-label">
          <PinIcon size={14} /> {t("game.track.label")}
        </span>
        {q && <strong className="g-tracker-title">{t(q.titleKey, q.params)}</strong>}
        <span className="g-tracker-text">{t(objective.key, { who: who(objective.who) })}</span>
      </button>
      {onGo && (
        <button type="button" className="g-tracker-go" onClick={onGo}>
          {t("game.track.go")}
        </button>
      )}
    </div>
  );
}

// --- Menu ------------------------------------------------------------------------------

export function MenuButton({
  icon,
  label,
  badge,
  onClick,
  className = "",
}: {
  icon: ReactNode;
  label: string;
  badge?: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button type="button" className={`g-menu-btn ${className}`} onClick={onClick} aria-label={label} title={label}>
      {icon}
      <span className="g-menu-label">{label}</span>
      {!!badge && <span className="g-badge">{badge}</span>}
    </button>
  );
}

// --- Minimap ---------------------------------------------------------------------------

const POI_COLOR: Partial<Record<InteractableId, string>> = {
  guide: "#0ea5a4",
  owl: "#8a5a3c",
  board: "#b8893a",
  chest: "#f6c445",
  forestGate: "#2c6e33",
};
const RIVER_PTS = Array.from({ length: 23 }, (_, i) => {
  const y = (i * WORLD_H) / 22;
  return `${RIVER.xAt(y).toFixed(0)},${y.toFixed(0)}`;
}).join(" ");

export function Minimap({
  state,
  player,
  tracked,
  onWalk,
}: {
  state: GameState;
  player: { x: number; y: number } | null;
  tracked: InteractableId | null;
  onWalk: (dest: { id: InteractableId } | { x: number; y: number }) => void;
}) {
  const { t } = useTranslation();
  const onClick = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * WORLD_W;
    const y = ((e.clientY - r.top) / r.height) * WORLD_H;
    const poi = INTERACTABLES.find((i) => Math.hypot(i.x - x, i.y - y) < 70);
    onWalk(poi ? { id: poi.id } : { x, y });
  };
  const houses = state.family.members.slice(0, HOUSE_SLOTS.length);
  return (
    <svg
      className="g-minimap"
      viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
      role="img"
      aria-label={t("game.ui.map")}
      onClick={onClick}
    >
      <rect width={WORLD_W} height={WORLD_H} fill="#86c96f" />
      <rect x={FOREST_FENCE_X} width={WORLD_W - FOREST_FENCE_X} height={WORLD_H} fill="#3f8a46" />
      {PATHS.map((p, i) => (
        <polyline key={i} points={p.points.map((pt) => pt.join(",")).join(" ")} fill="none" stroke="#ecd9a6" strokeWidth={p.width * 1.4} strokeLinecap="round" />
      ))}
      <circle cx={PLAZA.x} cy={PLAZA.y} r={PLAZA.r} fill="#ecd9a6" />
      <circle cx={PLAZA.x} cy={PLAZA.y + 10} r={42} fill="#4fb0e3" />
      <polyline points={RIVER_PTS} fill="none" stroke="#4fb0e3" strokeWidth={RIVER.width} />
      <rect x={RIVER.xAt(RIVER.bridgeY) - 56} y={RIVER.bridgeY - 30} width={112} height={60} rx={8} fill="#a0602e" />
      <rect x={PLAZA.x - 110} y={170} width={220} height={110} rx={14} fill="#7c6bd6" />
      {houses.map((m, i) => (
        <rect key={m.memberId} x={HOUSE_SLOTS[i]!.x - 50} y={HOUSE_SLOTS[i]!.y - 80} width={100} height={80} rx={10} fill={m.color} stroke="#fff" strokeWidth={8} />
      ))}
      {INTERACTABLES.filter((i) => POI_COLOR[i.id]).map((i) => (
        <circle key={i.id} cx={i.x} cy={i.y} r={30} fill={POI_COLOR[i.id]} stroke="#fff" strokeWidth={8} />
      ))}
      {INTERACTABLES.filter((i) => i.id === tracked).map((i) => (
        <circle key="target" className="g-minimap-target" cx={i.x} cy={i.y} r={56} fill="none" stroke="#f6c445" strokeWidth={14} />
      ))}
      {player && (
        <g transform={`translate(${player.x} ${player.y})`}>
          <circle r={44} fill="rgba(255,255,255,0.35)" />
          <circle r={26} fill="#ff5a8a" stroke="#fff" strokeWidth={10} />
        </g>
      )}
    </svg>
  );
}

// --- First-run coach -----------------------------------------------------------------

export type CoachStep = 0 | 1 | 2;

export function Coach({ step, touch, onSkip }: { step: CoachStep; touch: boolean; onSkip: () => void }) {
  const { t } = useTranslation();
  const text = [
    t(touch ? "game.tutorial.moveTouch" : "game.tutorial.moveKeys"),
    t(touch ? "game.tutorial.talkTouch" : "game.tutorial.talkKeys"),
    t("game.tutorial.quests"),
  ][step];
  return (
    <div className="g-coach" role="status" aria-live="polite">
      <div className="g-coach-head">
        <strong>{t("game.tutorial.title")}</strong>
        <span className="g-coach-dots" aria-label={t("game.tutorial.step", { n: step + 1, total: 3 })}>
          {[0, 1, 2].map((i) => <i key={i} className={i <= step ? "on" : ""} />)}
        </span>
      </div>
      <p key={step}>{text}</p>
      <button type="button" className="g-coach-skip" onClick={onSkip}>{t("game.tutorial.skip")}</button>
    </div>
  );
}
