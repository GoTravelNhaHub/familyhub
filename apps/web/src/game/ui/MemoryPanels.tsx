import { useTranslation } from "react-i18next";
import type { MemoryLevelState, MemoryResult } from "../types";
import { RewardChips } from "./icons";
import { useResourceLabel } from "./Panels";

export function MemoryIntro({
  levels,
  busy,
  onStart,
}: {
  levels: MemoryLevelState[];
  busy: boolean;
  onStart: (level: number) => void;
}) {
  const { t } = useTranslation();
  const label = useResourceLabel();
  return (
    <div className="g-memory-intro">
      <p className="g-speech">{t("game.memory.intro")}</p>
      <ol className="g-howto">
        <li>{t("game.memory.step1")}</li>
        <li>{t("game.memory.step2")}</li>
        <li>{t("game.memory.step3")}</li>
      </ol>
      <div className="g-levels">
        {levels.map((l) => (
          <button
            key={l.level}
            type="button"
            className={`g-level ${l.unlocked ? "" : "locked"}`}
            disabled={!l.unlocked || busy}
            onClick={() => onStart(l.level)}
          >
            <span className="g-level-title">{t("game.memory.levelTitle", { level: l.level })}</span>
            <span className="small">{t("game.memory.pairs", { count: l.pairs })}</span>
            {l.unlocked ? (
              l.rewardedToday ? (
                <span className="small muted">{t("game.memory.practice")}</span>
              ) : (
                <RewardChips reward={l.reward} label={label} />
              )
            ) : (
              <span className="small muted">{t("game.memory.locked")}</span>
            )}
            {l.best > 0 && <span className="small">{t("game.memory.best", { score: l.best })}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MemoryResultView({
  result,
  level,
  nextUnlocked,
  busy,
  onReplay,
  onNext,
  onExit,
}: {
  result: MemoryResult;
  level: number;
  nextUnlocked: boolean;
  busy: boolean;
  onReplay: () => void;
  onNext: () => void;
  onExit: () => void;
}) {
  const { t } = useTranslation();
  const label = useResourceLabel();
  return (
    <div className="g-memory-result">
      {result.won ? (
        <>
          <div className="g-trophy" aria-hidden>
            <svg viewBox="0 0 64 64" width="72" height="72">
              <path d="M32 4 L52 24 L32 60 L12 24 Z" fill="#8b5cf6" />
              <path d="M32 4 L41 24 L32 60 L23 24 Z" fill="#b69cff" />
              <path d="M12 24 H52" stroke="#6d3fe0" strokeWidth="2" />
              <circle cx="24" cy="14" r="2.5" fill="#fff" />
            </svg>
          </div>
          <p className="g-result-title">{t("game.memory.won")}</p>
          <div className="g-stats">
            <span>{t("game.memory.score", { score: result.score })}</span>
            <span>{t("game.memory.moves", { moves: result.moves })}</span>
            <span>{t("game.memory.time", { seconds: Math.round(result.durationMs / 1000) })}</span>
          </div>
          {result.reward ? (
            <p>
              {t("game.memory.rewardEarned")} <RewardChips reward={result.reward} label={label} />
            </p>
          ) : (
            <p className="muted">{t("game.memory.practiceDone")}</p>
          )}
        </>
      ) : (
        <p className="g-result-title">{t(result.error === "too_fast" ? "game.memory.tooFast" : "game.memory.notCleared")}</p>
      )}
      <div className="g-actions">
        <button type="button" className="ghost" onClick={onExit}>{t("game.memory.backToVillage")}</button>
        <button type="button" disabled={busy} onClick={onReplay}>{t("game.memory.again")}</button>
        {result.won && level < 3 && nextUnlocked && (
          <button type="button" className="happy" disabled={busy} onClick={onNext}>{t("game.memory.next")}</button>
        )}
      </div>
    </div>
  );
}
