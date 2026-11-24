import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError, auth } from "../lib/api";
import { useMe } from "../hooks/useAuth";
import { GameBridge, type InteractableId, type WorldSnapshot } from "../game/bridge";
import { GameCanvas } from "../game/GameCanvas";
import { gameApi, gameKeys, serverBackend, type GameBackend } from "../game/gameApi";
import type { GameState, MemoryResult, Quest, Resources } from "../game/types";
import { GUIDE_LOOK, type AvatarConfig } from "../game/avatar";
import { AvatarEditor, AvatarPortrait } from "../game/ui/AvatarEditor";
import { Dialogue, HouseCard, Panel, QuestBoard, QuestCard, useResourceLabel, type QuestAction } from "../game/ui/Panels";
import { MemoryIntro, MemoryResultView } from "../game/ui/MemoryPanels";
import { ChestIcon, GateIcon, MapIcon, OwlIcon, RewardChips, ScrollIcon, ShirtIcon, SwapIcon } from "../game/ui/icons";
import { Coach, Minimap, MenuButton, PlayerCard, QuestTracker, pickObjective, type CoachStep } from "../game/ui/Hud";
import { SPAWN } from "../game/world";
import "../game/game.css";

const PLAYER_KEY = "fh.game.playerId";
const COACH_KEY = "fh.game.coach";
const MAP_KEY = "fh.game.mapHidden";
const FLOAT_COLOR: Record<keyof Resources, string> = { xp: "#86efac", coins: "#fde047", crystals: "#d8b4fe", materials: "#fdba74" };

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // per-viewer convenience only
  }
}

type PanelState =
  | { kind: "npc"; npc: "guide" | "owl" }
  | { kind: "board" }
  | { kind: "chest" }
  | { kind: "gate" }
  | { kind: "house"; memberId: string }
  | { kind: "avatar" }
  | { kind: "memoryIntro" }
  | { kind: "playing"; level: number }
  | { kind: "memoryResult"; level: number; result: MemoryResult };

export default function PlayPage() {
  const { t } = useTranslation();
  const me = useMe();
  const familyId = auth.getFamilyId();
  const membership = me.data?.memberships.find((m) => m.familyId === familyId) ?? me.data?.memberships[0];
  const [playerId, setPlayerId] = useState<string | null>(() => readLocal(PLAYER_KEY));
  const state = useQuery({
    queryKey: gameKeys.state(membership?.memberId ?? "self"),
    queryFn: () => gameApi.state(membership!.memberId),
    enabled: !!membership,
  });

  if (me.isLoading || !membership || state.isLoading) {
    return <div className="play-root play-loading"><div className="g-loader" />{t("game.ui.loading")}</div>;
  }
  if (state.isError || !state.data) {
    return <div className="play-root play-loading">{t("game.ui.loadError")}</div>;
  }

  const family = state.data.family.members;
  const isParent = membership.role === "parent";
  // Kids play as themselves; grown-ups pick who is holding the device.
  const chosen =
    !isParent || family.length <= 1 ? membership.memberId : family.find((m) => m.memberId === playerId)?.memberId;

  if (!chosen) {
    return (
      <div className="play-root play-picker">
        <h1>{t("game.picker.title")}</h1>
        <p className="muted">{t("game.picker.subtitle")}</p>
        <div className="g-picker-grid">
          {family.map((m) => (
            <button
              key={m.memberId}
              type="button"
              className="g-picker-card"
              onClick={() => {
                writeLocal(PLAYER_KEY, m.memberId);
                setPlayerId(m.memberId);
              }}
            >
              <AvatarPortrait avatar={m.avatar} size={72} />
              <strong>{m.name}</strong>
              <span className="muted small">{t("game.ui.level", { level: m.level })}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <GameSession
      key={chosen}
      backend={serverBackend(chosen)}
      canSwitch={isParent && family.length > 1}
      onSwitch={() => {
        writeLocal(PLAYER_KEY, null);
        setPlayerId(null);
      }}
    />
  );
}

function worldSnapshot(s: GameState): WorldSnapshot {
  const q = (pred: (q: Quest) => boolean) => s.quests.filter(pred);
  const marker = (quests: Quest[]) =>
    quests.some((x) => x.status === "completed") ? "claim" : quests.some((x) => x.status === "available") ? "available" : null;
  return {
    player: { memberId: s.player.memberId, name: s.player.name, avatar: s.player.avatar },
    family: s.family.members,
    markers: {
      guide: marker(q((x) => x.npc === "guide")),
      owl: marker(q((x) => x.npc === "owl")),
      board: marker(q((x) => x.npc === "board")),
      chest: s.dailyChest.claimed ? null : "available",
    },
    chestOpen: s.dailyChest.claimed,
    forestUnlocked: s.player.zones.includes("forest"),
  };
}

interface Toast {
  id: number;
  reward: Resources;
  text: string;
}

export function GameSession({
  backend,
  canSwitch = false,
  onSwitch,
}: {
  backend: GameBackend;
  canSwitch?: boolean;
  onSwitch?: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const label = useResourceLabel();
  const bridge = useMemo(() => new GameBridge(), []);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [nearby, setNearby] = useState<InteractableId | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [player, setPlayer] = useState<{ x: number; y: number } | null>(null);
  const [mapOpen, setMapOpen] = useState(() => readLocal(MAP_KEY) !== "1");
  const [coach, setCoach] = useState<CoachStep | null>(() => {
    const v = readLocal(COACH_KEY);
    return v === "done" ? null : v === "1" || v === "2" ? (Number(v) as CoachStep) : 0;
  });
  const touch = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches, []);

  const stateQ = useQuery({ queryKey: backend.key, queryFn: backend.state });
  const state = stateQ.data;
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: backend.key }), [qc, backend.key]);
  const objective = useMemo(() => (state ? pickObjective(state) : null), [state]);

  const advanceCoach = useCallback((from: CoachStep) => {
    setCoach((c) => {
      if (c !== from) return c;
      const next = c < 2 ? ((c + 1) as CoachStep) : null;
      writeLocal(COACH_KEY, next === null ? "done" : String(next));
      return next;
    });
  }, []);
  const skipCoach = () => {
    writeLocal(COACH_KEY, "done");
    setCoach(null);
  };
  // Returning players who already met the guide skip the coach.
  useEffect(() => {
    if (coach !== null && state?.quests.find((q) => q.key === "story.welcome")?.status === "rewarded") skipCoach();
  }, [state, coach]);

  useEffect(() => () => bridge.clear(), [bridge]);
  useEffect(() => {
    if (state) bridge.emit("world", worldSnapshot(state));
  }, [state, bridge]);
  useEffect(() => {
    bridge.emit("setInputEnabled", panel === null);
  }, [panel, bridge]);
  useEffect(() => {
    bridge.emit("track", coach === 1 ? "guide" : objective?.target ?? null);
  }, [objective?.target, coach, bridge]);

  const nearbyRef = useRef(nearby);
  nearbyRef.current = nearby;
  const reward = useCallback(
    (r: Resources, text: string, at?: InteractableId) => {
      const id = Date.now() + Math.random();
      setToasts((ts) => [...ts, { id, reward: r, text }]);
      setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 3200);
      const items = (Object.keys(FLOAT_COLOR) as (keyof Resources)[])
        .filter((k) => r[k] > 0)
        .map((k) => ({ text: `+${r[k]} ${label(k)}`, color: FLOAT_COLOR[k] }));
      bridge.emit("celebrate", { at: at && (at === "chest" || nearbyRef.current === at) ? at : undefined, items });
    },
    [bridge, label],
  );
  const fail = (e: unknown) => setError(e instanceof ApiError ? t(`game.error.${e.message}`, { defaultValue: e.message }) : t("game.error.generic"));

  const questMut = useMutation({
    mutationFn: async ({ quest, action }: { quest: Quest; action: QuestAction }) => {
      if (action === "accept") await backend.accept(quest.key);
      else if (action === "cancel") await backend.cancel(quest.key);
      else if (action === "markDone" && quest.objective.type === "task" && backend.completeTask) {
        await backend.completeTask(quest.objective.taskId, state!.today);
        // Completion goes through the regular Tasks workflow (stars included).
        qc.invalidateQueries({ queryKey: ["completions"] });
        qc.invalidateQueries({ queryKey: ["balances"] });
      } else if (action === "claim") {
        const res = await backend.claim(quest.key);
        reward(res.reward, t(quest.titleKey, quest.params), quest.npc);
      }
    },
    onSuccess: refresh,
    onError: (e) => {
      fail(e);
      refresh();
    },
  });

  const chestMut = useMutation({
    mutationFn: () => backend.claimChest(),
    onSuccess: (res) => {
      reward(res.reward, t("game.chest.title"), "chest");
      refresh();
    },
    onError: fail,
  });

  const avatarMut = useMutation({
    mutationFn: (a: AvatarConfig) => backend.setAvatar(a),
    onSuccess: () => {
      setPanel(null);
      refresh();
    },
    onError: fail,
  });

  const startMut = useMutation({
    mutationFn: (level: number) => backend.startMemory(level),
    onSuccess: (session) => {
      setPanel({ kind: "playing", level: session.level });
      bridge.emit("startMemory", session);
    },
    onError: fail,
  });

  const finishMut = useMutation({
    mutationFn: (p: { sessionId: string; flips: number[]; level: number }) => backend.finishMemory(p.sessionId, p.flips),
    onSuccess: (result, vars) => {
      setPanel({ kind: "memoryResult", level: vars.level, result });
      if (result.reward) reward(result.reward, t("game.memory.title"));
      refresh();
    },
    onError: (e) => {
      fail(e);
      bridge.emit("endMemory");
      setPanel(null);
    },
  });

  // Phaser -> React events, registered once per session.
  useEffect(() => {
    const offs = [
      bridge.on("ready", () => setReady(true)),
      bridge.on("nearby", setNearby),
      bridge.on("player", (p) => {
        setPlayer(p);
        if (Math.hypot(p.x - SPAWN.x, p.y - SPAWN.y) > 48) advanceCoach(0);
      }),
      bridge.on("interact", (id) => {
        if (id === "guide") advanceCoach(1);
        if (id === "guide" || id === "owl") setPanel({ kind: "npc", npc: id });
        else if (id === "academy") setPanel({ kind: "npc", npc: "owl" });
        else if (id === "board") setPanel({ kind: "board" });
        else if (id === "chest") setPanel({ kind: "chest" });
        else if (id === "forestGate") setPanel({ kind: "gate" });
        else if (id.startsWith("house:")) setPanel({ kind: "house", memberId: id.slice(6) });
      }),
    ];
    return () => offs.forEach((o) => o());
  }, [bridge, advanceCoach]);
  useEffect(() => {
    if (panel?.kind === "board") advanceCoach(2);
  }, [panel, advanceCoach]);

  const panelRef = useRef(panel);
  panelRef.current = panel;
  const finishRef = useRef(finishMut.mutate);
  finishRef.current = finishMut.mutate;
  useEffect(
    () =>
      bridge.on("memoryFinished", ({ sessionId, flips }) => {
        const p = panelRef.current;
        finishRef.current({ sessionId, flips, level: p?.kind === "playing" ? p.level : 1 });
      }),
    [bridge],
  );

  const close = useCallback(() => setPanel(null), []);
  const exitMemory = useCallback(() => {
    bridge.emit("endMemory");
    setPanel(null);
  }, [bridge]);

  const onQuestAction = (quest: Quest, action: QuestAction) => {
    setError(null);
    if (action === "play") setPanel({ kind: "memoryIntro" });
    else questMut.mutate({ quest, action });
  };

  const busy = questMut.isPending || chestMut.isPending || startMut.isPending || finishMut.isPending;
  const nearbyLabel = nearby ? t(nearby.startsWith("house:") ? "game.interact.house" : `game.interact.${nearby}`) : null;

  return (
    <div className="play-root">
      <GameCanvas bridge={bridge} />

      <div className={`g-boot ${ready ? "done" : ""}`} aria-hidden={ready}>
        <div className="g-loader" />
        {t("game.ui.loading")}
      </div>

      {state && panel?.kind !== "playing" && (
        <div className={`g-hud ${panel ? "dimmed" : ""}`}>
          <div className="g-hud-left">
            <PlayerCard state={state} />
            {objective && (
              <QuestTracker
                objective={objective}
                onOpen={() => setPanel({ kind: "board" })}
                onGo={objective.target && objective.target !== nearby ? () => bridge.emit("walkTo", { id: objective.target! }) : null}
              />
            )}
          </div>
          <div className="g-hud-right">
            <div className="g-menu">
              <MenuButton
                icon={<ScrollIcon />}
                label={t("game.ui.quests")}
                badge={state.quests.filter((q) => q.status === "completed" || q.status === "available").length}
                onClick={() => setPanel({ kind: "board" })}
                className={coach === 2 ? "g-coach-target" : ""}
              />
              <MenuButton icon={<ShirtIcon />} label={t("game.ui.avatar")} onClick={() => setPanel({ kind: "avatar" })} />
              <MenuButton
                icon={<MapIcon />}
                label={t(mapOpen ? "game.ui.mapHide" : "game.ui.mapShow")}
                onClick={() => {
                  writeLocal(MAP_KEY, mapOpen ? "1" : null);
                  setMapOpen(!mapOpen);
                }}
                className={mapOpen ? "on" : ""}
              />
              {canSwitch && <MenuButton icon={<SwapIcon />} label={t("game.ui.switchPlayer")} onClick={() => onSwitch?.()} />}
              {backend.guest ? (
                <Link to="/register" className="g-link g-link-cta">{t("game.guest.save")}</Link>
              ) : (
                <Link to="/" className="g-link">{t("game.ui.dashboard")}</Link>
              )}
            </div>
            {mapOpen && (
              <Minimap state={state} player={player} tracked={coach === 1 ? "guide" : objective?.target ?? null} onWalk={(d) => bridge.emit("walkTo", d)} />
            )}
          </div>
        </div>
      )}

      {panel === null && coach !== null && ready && <Coach step={coach} touch={!!touch} onSkip={skipCoach} />}

      {panel === null && nearbyLabel && (
        <button type="button" className="g-interact" key={nearby} onClick={() => bridge.emit("triggerInteract")}>
          {nearbyLabel}
          {!touch && <kbd>E</kbd>}
        </button>
      )}

      {panel?.kind === "playing" && (
        <button type="button" className="g-leave ghost" onClick={exitMemory}>{t("game.memory.leave")}</button>
      )}

      {error && (
        <div className="g-error" role="alert" onClick={() => setError(null)}>{error}</div>
      )}

      <div className="g-toasts" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className="g-toast">
            <strong>{x.text}</strong>
            <RewardChips reward={x.reward} label={label} />
          </div>
        ))}
      </div>

      {state && panel && panel.kind !== "playing" && (
        <PanelView
          key={panel.kind === "npc" ? `npc-${panel.npc}` : panel.kind}
          panel={panel}
          guest={backend.guest}
          state={state}
          busy={busy}
          savingAvatar={avatarMut.isPending}
          onClose={panel.kind === "memoryResult" ? exitMemory : close}
          onQuestAction={onQuestAction}
          onChest={() => chestMut.mutate()}
          onAvatar={(a) => avatarMut.mutate(a)}
          onStart={(level) => startMut.mutate(level)}
          setPanel={setPanel}
          exitMemory={exitMemory}
          onReplay={(level) => {
            bridge.emit("endMemory");
            startMut.mutate(level);
          }}
        />
      )}
    </div>
  );
}

function PanelView(props: {
  panel: PanelState;
  guest: boolean;
  state: GameState;
  busy: boolean;
  savingAvatar: boolean;
  onClose: () => void;
  onQuestAction: (q: Quest, a: QuestAction) => void;
  onChest: () => void;
  onAvatar: (a: AvatarConfig) => void;
  onStart: (level: number) => void;
  onReplay: (level: number) => void;
  setPanel: (p: PanelState | null) => void;
  exitMemory: () => void;
}) {
  const { t } = useTranslation();
  const label = useResourceLabel();
  const { panel, state, busy, onClose } = props;
  const name = state.player.name;
  const [topic, setTopic] = useState<string | null>(null);

  switch (panel.kind) {
    case "npc": {
      const quests = state.quests.filter((q) => q.npc === panel.npc);
      const welcomed = state.quests.find((q) => q.key === "story.welcome")?.status === "rewarded";
      const openTasks = state.quests.filter((q) => q.kind === "activity" && q.status !== "rewarded").length;
      let lines: string[];
      if (topic) lines = [t(`game.npc.${panel.npc}.topic.${topic}`, { name })];
      else if (panel.npc === "guide") {
        lines = welcomed
          ? [t("game.npc.guide.back", { name, count: openTasks })]
          : [t("game.npc.guide.hello1", { name }), t("game.npc.guide.hello2"), t("game.npc.guide.hello3")];
      } else {
        const academyDone = state.quests.find((q) => q.key === "story.academy")?.status === "rewarded";
        lines = [t(academyDone ? "game.npc.owl.back" : "game.npc.owl.hello", { name })];
      }
      const options =
        panel.npc === "guide"
          ? [
              { label: t("game.npc.guide.askVillage"), onSelect: () => setTopic("village") },
              { label: t("game.npc.guide.askQuests"), onSelect: () => setTopic("quests") },
              { label: t("game.npc.guide.openBoard"), onSelect: () => props.setPanel({ kind: "board" }) },
              { label: t("game.ui.bye"), onSelect: onClose },
            ]
          : [
              { label: t("game.npc.owl.play"), onSelect: () => props.setPanel({ kind: "memoryIntro" }) },
              { label: t("game.npc.owl.askCrystals"), onSelect: () => setTopic("crystals") },
              { label: t("game.ui.bye"), onSelect: onClose },
            ];
      return (
        <Panel
          title={t(`game.npc.${panel.npc}.name`)}
          icon={panel.npc === "guide" ? <AvatarPortrait avatar={GUIDE_LOOK} size={36} /> : <OwlIcon size={40} />}
          onClose={onClose}
        >
          <Dialogue lines={lines} options={topic ? [{ label: t("game.ui.back"), onSelect: () => setTopic(null) }] : options}>
            {!topic && quests.map((q) => <QuestCard key={q.key} quest={q} busy={busy} onAction={props.onQuestAction} />)}
          </Dialogue>
        </Panel>
      );
    }
    case "board":
      return (
        <Panel title={t("game.place.board")} icon={<ScrollIcon size={30} />} onClose={onClose} wide>
          <QuestBoard state={state} busy={busy} guest={props.guest} onAction={props.onQuestAction} />
        </Panel>
      );
    case "chest":
      return (
        <Panel title={t("game.chest.title")} icon={<ChestIcon size={40} />} onClose={onClose}>
          {state.dailyChest.claimed ? (
            <p>{t("game.chest.claimed")}</p>
          ) : (
            <>
              <p>{t("game.chest.ready")}</p>
              <RewardChips reward={state.dailyChest.reward} label={label} />
              <div className="g-actions">
                <button type="button" className="happy g-glow" disabled={busy} onClick={props.onChest}>
                  {t("game.chest.open")}
                </button>
              </div>
            </>
          )}
        </Panel>
      );
    case "gate": {
      const open = state.player.zones.includes("forest");
      return (
        <Panel title={t("game.npc.guardian.name")} icon={<GateIcon size={40} />} onClose={onClose}>
          <p className="g-speech">
            {open ? t("game.npc.guardian.open", { name }) : t("game.npc.guardian.locked", { level: 3, current: state.player.level.level })}
          </p>
        </Panel>
      );
    }
    case "house":
      return (
        <Panel title={t("game.place.house", { name: state.family.members.find((m) => m.memberId === panel.memberId)?.name ?? "" })} onClose={onClose}>
          <HouseCard state={state} memberId={panel.memberId} onCustomize={() => props.setPanel({ kind: "avatar" })} />
        </Panel>
      );
    case "avatar":
      return (
        <Panel title={t("game.avatar.title")} onClose={onClose}>
          <AvatarEditor initial={state.player.avatar} saving={props.savingAvatar} onSave={props.onAvatar} onCancel={onClose} />
        </Panel>
      );
    case "memoryIntro":
      return (
        <Panel title={t("game.memory.title")} onClose={onClose}>
          <MemoryIntro levels={state.memory.levels} busy={busy} onStart={props.onStart} />
        </Panel>
      );
    case "memoryResult": {
      const next = state.memory.levels.find((l) => l.level === panel.level + 1);
      return (
        <Panel title={t("game.memory.title")} onClose={onClose}>
          <MemoryResultView
            result={panel.result}
            level={panel.level}
            nextUnlocked={!!next?.unlocked}
            busy={busy}
            onReplay={() => props.onReplay(panel.level)}
            onNext={() => props.onReplay(panel.level + 1)}
            onExit={props.exitMemory}
          />
        </Panel>
      );
    }
    default:
      return null;
  }
}
