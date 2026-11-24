import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { GameState, Quest, Resources } from "../types";
import { RewardChips } from "./icons";
import { AvatarPortrait } from "./AvatarEditor";

export type QuestAction = "accept" | "cancel" | "claim" | "markDone" | "play";

export function useResourceLabel() {
  const { t } = useTranslation();
  return (k: keyof Resources) => t(`game.resource.${k}`);
}

export function Panel({
  title,
  icon,
  onClose,
  children,
  wide,
}: {
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.querySelector<HTMLElement>("button:not(.g-close)")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="g-scrim" onClick={onClose}>
      <div
        ref={ref}
        className={`g-panel ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="g-panel-head">
          {icon && <div className="g-panel-icon">{icon}</div>}
          <h2>{title}</h2>
          <button type="button" className="g-close" onClick={onClose} aria-label={t("game.ui.close")}>
            ×
          </button>
        </div>
        <div className="g-panel-body">{children}</div>
      </div>
    </div>
  );
}

const STATUS_CLASS: Record<Quest["status"], string> = {
  locked: "muted",
  available: "new",
  active: "active",
  completed: "ready",
  rewarded: "done",
};

export function QuestCard({
  quest,
  busy,
  onAction,
}: {
  quest: Quest;
  busy: boolean;
  onAction: (q: Quest, a: QuestAction) => void;
}) {
  const { t } = useTranslation();
  const label = useResourceLabel();
  const isTask = quest.objective.type === "task";
  const isGame = quest.objective.type === "minigame";
  return (
    <div className={`g-quest ${STATUS_CLASS[quest.status]}`}>
      <div className="g-quest-main">
        <div className="g-quest-top">
          <strong>{t(quest.titleKey, quest.params)}</strong>
          <span className={`g-status ${STATUS_CLASS[quest.status]}`}>{t(`game.status.${quest.status}`)}</span>
        </div>
        <p>{t(quest.descKey, quest.params)}</p>
        {isTask && (
          <p className="g-real-task">
            {t("game.quest.realTask")}: <span>{String(quest.params.icon ?? "")} {String(quest.params.task ?? "")}</span>
          </p>
        )}
        <RewardChips reward={quest.reward} label={label} />
      </div>
      <div className="g-quest-actions">
        {quest.status === "available" && (
          <button type="button" disabled={busy} onClick={() => onAction(quest, "accept")}>{t("game.action.accept")}</button>
        )}
        {quest.status === "active" && isTask && (
          <button type="button" className="happy" disabled={busy} onClick={() => onAction(quest, "markDone")}>
            {t("game.action.markDone")}
          </button>
        )}
        {quest.status === "active" && isGame && (
          <button type="button" disabled={busy} onClick={() => onAction(quest, "play")}>{t("game.action.play")}</button>
        )}
        {quest.status === "completed" && (
          <button type="button" className="happy g-glow" disabled={busy} onClick={() => onAction(quest, "claim")}>
            {t("game.action.claim")}
          </button>
        )}
        {(quest.status === "active" || quest.status === "completed") && (
          <button type="button" className="ghost small" disabled={busy} onClick={() => onAction(quest, "cancel")}>
            {t("game.action.cancel")}
          </button>
        )}
        {quest.status === "locked" && <span className="muted small">{t("game.quest.lockedHint")}</span>}
      </div>
    </div>
  );
}

export function QuestBoard({
  state,
  busy,
  guest = false,
  onAction,
}: {
  state: GameState;
  busy: boolean;
  guest?: boolean;
  onAction: (q: Quest, a: QuestAction) => void;
}) {
  const { t } = useTranslation();
  const groups: [string, Quest[]][] = [
    ["game.board.activity", state.quests.filter((q) => q.kind === "activity")],
    ["game.board.story", state.quests.filter((q) => q.kind === "story")],
    ["game.board.daily", state.quests.filter((q) => q.kind === "daily")],
  ];
  return (
    <>
      <p className="muted">{t("game.board.intro")}</p>
      {groups.map(([key, quests]) => (
        <section key={key} className="g-quest-group">
          <h3>{t(key)}</h3>
          {quests.length === 0 ? (
            <p className="muted small">
              {t(key !== "game.board.activity" ? "game.board.empty" : guest ? "game.guest.boardHint" : "game.board.noTasks")}
            </p>
          ) : (
            quests.map((q) => <QuestCard key={q.key} quest={q} busy={busy} onAction={onAction} />)
          )}
        </section>
      ))}
    </>
  );
}

export interface DialogueOption {
  label: string;
  onSelect: () => void;
}

/** Scripted, branching NPC conversation. Options can open sub-lines or act. */
export function Dialogue({
  lines,
  options,
  children,
}: {
  lines: string[];
  options: DialogueOption[];
  children?: ReactNode;
}) {
  const [step, setStep] = useState(0);
  const last = step >= lines.length - 1;
  useEffect(() => setStep(0), [lines.join("|")]);
  return (
    <div className="g-dialogue">
      <p className="g-speech" aria-live="polite">{lines[step]}</p>
      {!last ? (
        <div className="g-actions">
          <button type="button" onClick={() => setStep((s) => s + 1)}>{"▸"}</button>
        </div>
      ) : (
        <>
          {children}
          <div className="g-options">
            {options.map((o) => (
              <button key={o.label} type="button" className="ghost" onClick={o.onSelect}>
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function HouseCard({ state, memberId, onCustomize }: { state: GameState; memberId: string; onCustomize: () => void }) {
  const { t } = useTranslation();
  const m = state.family.members.find((x) => x.memberId === memberId);
  if (!m) return null;
  const mine = m.memberId === state.player.memberId;
  return (
    <div className="g-house">
      <AvatarPortrait avatar={m.avatar} size={84} />
      <div>
        <p className="g-house-name">{m.name}</p>
        <p className="muted">
          {t("game.ui.level", { level: m.level })} · {t(m.role === "parent" ? "common.parent" : "common.child")}
        </p>
        <p>{mine ? t("game.house.mine") : t("game.house.visit", { name: m.name })}</p>
        {mine && (
          <button type="button" onClick={onCustomize}>{t("game.ui.avatar")}</button>
        )}
      </div>
    </div>
  );
}
