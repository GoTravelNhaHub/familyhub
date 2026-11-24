// Learning Academy: Professor Owl's hall with three Memory Crystal boards.
// The hall is plain React (no engine). Phaser loads only when a board starts,
// reusing the village's MemoryScene in board-only mode. Rules, scores, rewards,
// and badges are decided by the backend (API for members, local engine for guests).

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "../lib/api";
import { GameBridge } from "../game/bridge";
import type { GameBackend } from "../game/gameApi";
import type { GameState, MemoryLevelState, MemoryResult, MemorySession } from "../game/types";
import { Dialogue, useResourceLabel } from "../game/ui/Panels";
import { MemoryResultView } from "../game/ui/MemoryPanels";
import { RewardChips } from "../game/ui/icons";
import { markPlayed } from "../platform/recent";
import { ProfessorOwl } from "./ProfessorOwl";
import "../game/game.css";
import "./academy.css";

// Phaser (~360 KB gzip) stays out of the hall until a board is dealt.
const BoardCanvas = lazy(() => import("../game/GameCanvas").then((m) => ({ default: m.GameCanvas })));

export const ACADEMY_WORLD_ID = "learning-academy";

type Phase =
  | { kind: "hall" }
  | { kind: "playing"; session: MemorySession }
  | { kind: "result"; session: MemorySession; result: MemoryResult; prevBest: number };

type Topic = "howto" | "level" | "scoring" | "tip" | "badges";
/** What Professor Owl remembers about the last board, to react in the hall. */
interface LastRun {
  level: number;
  result: MemoryResult;
}
const TIPS = 4;

/** The board to suggest: the first unlocked level not yet cleared, else the hardest unlocked. */
function recommended(levels: MemoryLevelState[]): MemoryLevelState | undefined {
  const open = levels.filter((l) => l.unlocked);
  return open.find((l) => l.wins === 0) ?? open[open.length - 1];
}

export function AcademyWorld({
  backend,
  canSwitch = false,
  onSwitch,
}: {
  backend: GameBackend;
  canSwitch?: boolean;
  onSwitch?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const label = useResourceLabel();
  const bridge = useMemo(() => new GameBridge(), []);
  const [phase, setPhase] = useState<Phase>({ kind: "hall" });
  const [topic, setTopic] = useState<Topic | null>(null);
  const [tip, setTip] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<LastRun | null>(null);

  const stateQ = useQuery({ queryKey: backend.key, queryFn: backend.state });
  const state = useMemo(() => (stateQ.data ? withAcademyDefaults(stateQ.data) : undefined), [stateQ.data]);
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: backend.key }), [qc, backend.key]);
  useEffect(() => markPlayed(ACADEMY_WORLD_ID), []);
  useEffect(() => () => bridge.clear(), [bridge]);

  const fail = (e: unknown) =>
    setError(e instanceof ApiError ? t(`game.error.${e.message}`, { defaultValue: e.message }) : t("game.error.generic"));

  const startMut = useMutation({
    mutationFn: (level: number) => backend.startMemory(level),
    onSuccess: (session) => {
      setError(null);
      setPhase({ kind: "playing", session });
    },
    onError: fail,
  });

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const finishMut = useMutation({
    mutationFn: (p: { sessionId: string; flips: number[] }) => backend.finishMemory(p.sessionId, p.flips),
    onSuccess: (result) => {
      const p = phaseRef.current;
      if (p.kind !== "playing") return;
      const prevBest = state?.memory.levels.find((l) => l.level === p.session.level)?.best ?? 0;
      setPhase({ kind: "result", session: p.session, result, prevBest });
      setLast({ level: p.session.level, result });
      refresh();
    },
    onError: (e) => {
      fail(e);
      setPhase({ kind: "hall" });
      refresh();
    },
  });
  const finishRef = useRef(finishMut.mutate);
  finishRef.current = finishMut.mutate;
  useEffect(() => bridge.on("memoryFinished", (f) => finishRef.current(f)), [bridge]);

  const exitBoard = useCallback(() => {
    setPhase({ kind: "hall" });
    setTopic(null);
  }, []);
  const restart = useCallback(() => {
    const p = phaseRef.current;
    if (p.kind !== "hall" && !startMut.isPending) startMut.mutate(p.session.level);
  }, [startMut]);

  // Board shortcuts: Esc leaves, R deals a fresh board. MemoryScene owns arrows/Enter.
  useEffect(() => {
    if (phase.kind !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitBoard();
      else if (e.key === "r" || e.key === "R") restart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase.kind, exitBoard, restart]);

  if (stateQ.isLoading) return <div className="ac-loading"><div className="g-loader" />{t("game.ui.loading")}</div>;
  if (!state) return <div className="ac-loading">{t("game.ui.loadError")}</div>;

  const levels = state.memory.levels;
  const rec = recommended(levels);
  const tier = (level: number) => t(`academy.tier.${level}`);
  const busy = startMut.isPending || finishMut.isPending;

  return (
    <div className="academy">
      <section className="ac-hall" aria-labelledby="ac-title">
        <div className="ac-backdrop" aria-hidden>
          <div className="ac-windows"><i /><i /><i /></div>
          <div className="ac-shelves" />
          <span className="ac-float c1" /><span className="ac-float c2" /><span className="ac-float c3" />
        </div>
        <div className="ac-stage">
          <button
            type="button"
            className="ac-owl-btn"
            onClick={() => {
              setTopic("tip");
              setTip((n) => (n + 1) % TIPS);
            }}
            aria-label={t("academy.ask.tip")}
          >
            <ProfessorOwl talking={busy || topic !== null} />
          </button>
          <div className="ac-dialogue">
            <div className="ac-speaker">
              <strong>{t("game.npc.owl.name")}</strong>
              <span>{t("academy.instructor")}</span>
            </div>
            <Dialogue
              lines={owlLines({ t, state, topic, tip, rec, tier, last })}
              options={(["howto", "level", "scoring", "tip", "badges"] as Topic[]).map((k) => ({
                label: t(`academy.ask.${k}`),
                onSelect: () => {
                  if (k === "tip") setTip((n) => (n + 1) % TIPS);
                  setTopic(k);
                },
              }))}
            />
          </div>
        </div>
        <div className="ac-headline">
          <h1 id="ac-title">{t("platform.world.learning-academy.title")}</h1>
          <div className="ac-head-actions">
            {canSwitch && <button type="button" className="ghost small" onClick={onSwitch}>{t("game.ui.switchPlayer")}</button>}
            <Link to="/play" className="ac-link">{t("academy.toVillage")} →</Link>
          </div>
        </div>
      </section>

      {error && <div className="ac-error" role="alert" onClick={() => setError(null)}>{error}</div>}

      <section className="ac-section" aria-labelledby="ac-boards">
        <h2 id="ac-boards">{t("academy.boards")}</h2>
        <div className="ac-boards">
          {levels.map((l) => (
            <article key={l.level} className={`ac-board t${l.level} ${l.unlocked ? "" : "locked"} ${rec?.level === l.level ? "suggested" : ""}`}>
              <div className="ac-crystal" aria-hidden><span /></div>
              <h3>{tier(l.level)}</h3>
              <p className="ac-board-meta">
                {t("game.memory.pairs", { count: l.pairs })} · {t("academy.grid", { cols: l.cols, rows: (l.pairs * 2) / l.cols })}
              </p>
              {l.unlocked ? (
                l.rewardedToday ? <p className="ac-muted">{t("academy.practiceToday")}</p> : <RewardChips reward={l.reward} label={label} />
              ) : (
                <p className="ac-muted">{t("academy.locked", { tier: tier(l.level - 1) })}</p>
              )}
              <p className="ac-board-stats">
                {l.best > 0 ? t("academy.best", { score: l.best }) : " "}
                {l.wins > 0 && <span> · {t("academy.cleared", { count: l.wins })}</span>}
              </p>
              <button
                type="button"
                className={rec?.level === l.level ? "happy" : ""}
                disabled={!l.unlocked || busy}
                onClick={() => startMut.mutate(l.level)}
              >
                {l.unlocked ? t("academy.start") : "🔒"}
              </button>
            </article>
          ))}
        </div>
        <p className="ac-muted small">{t("academy.keys")}</p>
      </section>

      <div className="ac-columns">
        <section className="ac-section" aria-labelledby="ac-badges">
          <h2 id="ac-badges">
            {t("academy.badges")}{" "}
            <span className="ac-count">{state.achievements.filter((a) => a.unlocked).length}/{state.achievements.length}</span>
          </h2>
          <ul className="ac-badges">
            {state.achievements.map((a) => (
              <li key={a.key} className={a.unlocked ? "on" : ""}>
                <span className="ac-badge-icon" aria-hidden>{a.unlocked ? "🏅" : "🔒"}</span>
                <span className="ac-badge-text">
                  <strong>{t(`game.achievement.${a.key}.title`)}</strong>
                  <span>{t(`game.achievement.${a.key}.desc`)}</span>
                </span>
                <RewardChips reward={a.reward} label={label} />
                <span className="sr-only">{a.unlocked ? t("academy.badgeEarned") : t("academy.badgeLocked")}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="ac-section" aria-labelledby="ac-recent">
          <h2 id="ac-recent">{t("academy.recent")}</h2>
          {state.memory.recent.length === 0 ? (
            <p className="ac-muted">{t("academy.noRecent")}</p>
          ) : (
            <table className="ac-table">
              <thead>
                <tr>
                  <th scope="col">{t("academy.col.board")}</th>
                  <th scope="col">{t("academy.col.result")}</th>
                  <th scope="col">{t("academy.col.score")}</th>
                  <th scope="col">{t("academy.col.moves")}</th>
                  <th scope="col">{t("academy.col.time")}</th>
                </tr>
              </thead>
              <tbody>
                {state.memory.recent.map((r) => (
                  <tr key={r.finishedAt}>
                    <td>
                      {tier(r.level)}
                      <span className="ac-muted small"> {new Date(r.finishedAt).toLocaleDateString(i18n.resolvedLanguage)}</span>
                    </td>
                    <td>{r.won ? "✅" : "—"}</td>
                    <td>{r.won ? r.score : "—"}</td>
                    <td>{r.moves}</td>
                    <td>{Math.round(r.durationMs / 1000)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {backend.guest && (
            <p className="ac-guest">
              {t("academy.guestNote")} <Link to="/register?next=/academy">{t("game.guest.signUp")}</Link>
            </p>
          )}
        </section>
      </div>

      {phase.kind !== "hall" && (
        <div className="ac-board-layer" role="dialog" aria-modal="true" aria-label={tier(phase.session.level)}>
          <Suspense fallback={<div className="ac-loading"><div className="g-loader" /></div>}>
            {/* A new session remounts the game, so restarts never reuse listeners or state. */}
            <BoardCanvas key={phase.session.sessionId} bridge={bridge} memory={phase.session} />
          </Suspense>
          <div className="ac-board-bar">
            <span className="ac-board-title">{tier(phase.session.level)}</span>
            <button type="button" className="ghost small" disabled={busy} onClick={restart}>↻ {t("academy.restart")}</button>
            <button type="button" className="ghost small" onClick={exitBoard}>{t("academy.exit")}</button>
          </div>
          {phase.kind === "result" && (
            <div className="ac-result">
              <div className="g-panel">
                <div className="g-panel-body">
                  <MemoryResultView
                    result={phase.result}
                    level={phase.session.level}
                    nextUnlocked={!!levels.find((l) => l.level === phase.session.level + 1)?.unlocked}
                    busy={busy}
                    onReplay={restart}
                    onNext={() => startMut.mutate(phase.session.level + 1)}
                    onExit={exitBoard}
                    exitLabel={t("academy.backToHall")}
                  >
                    {phase.result.won && phase.result.score > phase.prevBest && phase.prevBest > 0 && (
                      <p className="ac-newbest">⭐ {t("academy.newBest")}</p>
                    )}
                    {(phase.result.achievements ?? []).length > 0 && (
                      <ul className="ac-unlocked" aria-label={t("academy.badgeUnlocked")}>
                        {(phase.result.achievements ?? []).map((a) => (
                          <li key={a.key}>
                            🏅 <strong>{t(`game.achievement.${a.key}.title`)}</strong>
                            <RewardChips reward={a.reward} label={label} />
                          </li>
                        ))}
                      </ul>
                    )}
                    {backend.guest && phase.result.won && (
                      <p className="ac-guest">
                        {t("academy.guestNote")} <Link to="/register?next=/academy">{t("game.guest.signUp")}</Link>
                      </p>
                    )}
                  </MemoryResultView>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Tolerates an API that predates badges and recent results (web may deploy first). */
function withAcademyDefaults(s: GameState): GameState {
  return {
    ...s,
    achievements: s.achievements ?? [],
    memory: { ...s.memory, recent: s.memory.recent ?? [], levels: s.memory.levels.map((l) => ({ ...l, wins: l.wins ?? 0 })) },
  };
}

function owlLines({
  t,
  state,
  topic,
  tip,
  rec,
  tier,
  last,
}: {
  t: (k: string, o?: Record<string, unknown>) => string;
  last: LastRun | null;
  state: GameState;
  topic: Topic | null;
  tip: number;
  rec: MemoryLevelState | undefined;
  tier: (l: number) => string;
}): string[] {
  const name = state.player.name;
  const suggest = rec ? t("academy.owl.recommend", { tier: tier(rec.level), pairs: rec.pairs }) : "";
  switch (topic) {
    case "howto":
      return [t("academy.owl.howto")];
    case "level":
      return [suggest];
    case "scoring":
      return [t("academy.owl.scoring")];
    case "tip":
      return [t(`academy.owl.tip${tip + 1}`)];
    case "badges":
      return [t("academy.owl.badges", { count: state.achievements.length })];
    default: {
      if (last) {
        const r = last.result;
        if (!r.won) return [t(r.error === "too_fast" ? "academy.owl.tooFast" : "academy.owl.lost"), suggest];
        const praise = t("academy.owl.won", { score: r.score, tier: tier(last.level) });
        return r.reward ? [praise, suggest] : [praise, t("academy.owl.practice"), suggest];
      }
      const anyWin = state.memory.levels.some((l) => l.wins > 0);
      return anyWin
        ? [t("academy.owl.welcomeBack", { name }), suggest]
        : [t("academy.owl.welcome", { name }), t("academy.owl.howto"), suggest];
    }
  }
}
