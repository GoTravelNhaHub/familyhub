import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { canLaunchWorld, featuredWorld, listedWorlds, WORLD_CATEGORIES, type WorldCategory, type WorldDefinition } from "@family-hub/core";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { AvatarPortrait } from "../game/ui/AvatarEditor";
import { RESOURCE_ICONS } from "../game/ui/icons";
import { WorldArt } from "./WorldArt";
import { readRecent } from "./recent";
import { usePlayerSummary, type PlayerSummary } from "./usePlayerSummary";
import "./platform.css";

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Game-first home: featured world, player card, family or account card, and the world catalog. */
export function Lobby({ signedIn }: { signedIn: boolean }) {
  const { t } = useTranslation();
  const { summary, loading, error } = usePlayerSummary(signedIn);
  const world = featuredWorld();
  const recent = useMemo(() => readRecent(), []);
  const resumed = recent.some((r) => r.worldId === world.id) || !!summary?.started;
  const animate = useMemo(() => !reducedMotion(), []);
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname === "/discover") document.getElementById("discover")?.scrollIntoView({ block: "start" });
  }, [pathname]);

  return (
    <div className={`lobby ${signedIn ? "in-shell" : "standalone"}`}>
      {!signedIn && <GuestHeader />}
      <main className="lobby-main">
        <section className="lobby-hero" aria-labelledby="lobby-hero-title">
          <WorldArt thumbnail={world.thumbnail} animated={animate} className="lobby-hero-art" />
          <div className="lobby-hero-copy">
            <span className="lobby-kicker">{t(resumed ? "platform.kicker.continue" : "platform.kicker.featured")}</span>
            <h1 id="lobby-hero-title">{t(`platform.world.${world.id}.title`)}</h1>
            <p>{t(`platform.world.${world.id}.desc`)}</p>
            <div className="lobby-tags">
              <span className="lobby-tag">{t(`platform.category.${world.category}`)}</span>
              {world.guestAccessible && <span className="lobby-tag">{t("platform.guestFriendly")}</span>}
              <span className="lobby-tag">{t("platform.devices")}</span>
            </div>
            {summary?.started && (
              <div className="lobby-hero-progress">
                <span>{t("game.ui.level", { level: summary.level.level })}</span>
                <XpBar summary={summary} />
              </div>
            )}
            <div className="lobby-actions">
              <Link to={world.entryRoute!} className="lobby-btn primary">
                ▶ {t(resumed ? "platform.continue" : "platform.playNow")}
              </Link>
              <Link to={`${world.entryRoute}?open=avatar`} className="lobby-btn soft">
                {t("platform.customizeAvatar")}
              </Link>
            </div>
          </div>
        </section>

        <div className="lobby-cards">
          <PlayerCard summary={summary} loading={loading} error={error} />
          {signedIn ? <FamilyCard summary={summary} /> : <AccountCard />}
        </div>

        <Discover guest={!signedIn} summary={summary} />
      </main>
      {!signedIn && <GuestTabBar />}
    </div>
  );
}

function GuestHeader() {
  const { t } = useTranslation();
  const onDiscover = useLocation().pathname === "/discover";
  return (
    <header className="lobby-header">
      <Link to="/" className="lobby-brand">
        <span aria-hidden>👨‍👩‍👧‍👦</span> {t("common.appName")}
      </Link>
      <nav className="lobby-nav" aria-label={t("platform.nav.label")}>
        <Link to="/" aria-current={onDiscover ? undefined : "page"}>{t("platform.nav.home")}</Link>
        <Link to="/discover" aria-current={onDiscover ? "page" : undefined}>{t("platform.nav.discover")}</Link>
        <Link to="/play">{t("platform.nav.play")}</Link>
      </nav>
      <div className="lobby-header-end">
        <LanguageSwitcher compact />
        <Link to="/login" className="lobby-btn ghost small">{t("common.login")}</Link>
        <Link to="/register?next=/play" className="lobby-btn primary small">{t("platform.signUp")}</Link>
      </div>
    </header>
  );
}

/** Phone-width navigation for signed-out visitors (members get the app's tab bar). */
function GuestTabBar() {
  const { t } = useTranslation();
  const onDiscover = useLocation().pathname === "/discover";
  return (
    <nav className="lobby-tabbar" aria-label={t("platform.nav.label")}>
      <Link to="/" aria-current={onDiscover ? undefined : "page"}><span aria-hidden>🎮</span>{t("platform.nav.home")}</Link>
      <Link to="/discover" aria-current={onDiscover ? "page" : undefined}><span aria-hidden>🧭</span>{t("platform.nav.discover")}</Link>
      <Link to="/play"><span aria-hidden>🗺️</span>{t("platform.nav.play")}</Link>
      <Link to="/register?next=/play"><span aria-hidden>✨</span>{t("platform.nav.join")}</Link>
    </nav>
  );
}

function XpBar({ summary }: { summary: PlayerSummary }) {
  const { t } = useTranslation();
  const { intoLevel, span, level } = summary.level;
  const pct = Math.round((intoLevel / Math.max(1, span)) * 100);
  return (
    <div className="lobby-xp">
      <div className="lobby-xpbar" role="progressbar" aria-valuemin={0} aria-valuemax={span} aria-valuenow={intoLevel} aria-label={t("game.resource.xp")}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <span className="muted small">{t("platform.player.xp", { into: intoLevel, span, next: level + 1 })}</span>
    </div>
  );
}

function PlayerCard({ summary, loading, error }: { summary: PlayerSummary | null; loading: boolean; error: boolean }) {
  const { t } = useTranslation();
  if (loading) return <div className="lobby-card skeleton" aria-busy="true" />;
  if (!summary) {
    return (
      <div className="lobby-card">
        <h2>{t("platform.player.title")}</h2>
        <p className="muted">{t(error ? "platform.player.error" : "platform.player.newPlayer")}</p>
        <Link to="/play" className="lobby-btn soft">{t("platform.playNow")}</Link>
      </div>
    );
  }
  return (
    <div className="lobby-card lobby-player">
      <div className="lobby-player-head">
        <div className="lobby-portrait">
          <AvatarPortrait avatar={summary.avatar} size={64} />
        </div>
        <div>
          <h2>{summary.name}</h2>
          <span className="lobby-level">{t("game.ui.level", { level: summary.level.level })}</span>
        </div>
      </div>
      <XpBar summary={summary} />
      <div className="lobby-res">
        {(["coins", "crystals", "materials"] as const).map((k) => {
          const Icon = RESOURCE_ICONS[k];
          return (
            <span key={k} title={t(`game.resource.${k}`)}>
              <Icon size={18} /> <b>{summary.resources[k]}</b>
              <span className="sr-only"> {t(`game.resource.${k}`)}</span>
            </span>
          );
        })}
      </div>
      <p className="muted small">
        {summary.started
          ? summary.questsWaiting > 0
            ? t("platform.player.questsWaiting", { count: summary.questsWaiting })
            : t("platform.player.allCaughtUp")
          : t("platform.player.newPlayer")}
      </p>
      {summary.guest && <p className="lobby-note">{t("platform.player.localOnly")}</p>}
    </div>
  );
}

function FamilyCard({ summary }: { summary: PlayerSummary | null }) {
  const { t } = useTranslation();
  const family = summary?.family;
  const parent = summary?.role === "parent";
  return (
    <div className="lobby-card lobby-family">
      <h2>{family?.name ?? t("platform.family.title")}</h2>
      {family && <span className="lobby-level alt">{t("game.ui.familyLevel", { level: family.level })}</span>}
      {family && family.members.length > 0 && (
        <ul className="lobby-members">
          {family.members.slice(0, 6).map((m) => (
            <li key={m.memberId}>
              <AvatarPortrait avatar={m.avatar} size={40} />
              <span>{m.name}</span>
              <span className="muted small">{t("game.ui.level", { level: m.level })}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">{t(parent ? "platform.family.parentHint" : "platform.family.childHint")}</p>
      <Link to="/family" className="lobby-btn soft">{t("platform.family.open")}</Link>
    </div>
  );
}

function AccountCard() {
  const { t } = useTranslation();
  return (
    <div className="lobby-card lobby-account">
      <h2>{t("platform.account.title")}</h2>
      <ul className="lobby-benefits">
        <li>✅ {t("platform.account.b1")}</li>
        <li>⭐ {t("platform.account.b2")}</li>
        <li>🧑 {t("platform.account.b3")}</li>
      </ul>
      <div className="lobby-actions">
        <Link to="/register?next=/play" className="lobby-btn primary">{t("platform.account.signUp")}</Link>
        <Link to="/login" className="lobby-btn ghost">{t("platform.account.login")}</Link>
      </div>
      <p className="lobby-note">{t("platform.account.note")}</p>
      <Link to="/welcome" className="lobby-link">{t("platform.account.learn")} →</Link>
    </div>
  );
}

function Discover({ guest, summary }: { guest: boolean; summary: PlayerSummary | null }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<WorldCategory | "all">("all");
  const worlds = listedWorlds();
  const shown = worlds.filter((w) => category === "all" || w.category === category);
  const used = new Set(worlds.map((w) => w.category));
  return (
    <section id="discover" className="lobby-discover" aria-labelledby="discover-title">
      <div className="lobby-section-head">
        <h2 id="discover-title">{t("platform.discover.title")}</h2>
        <p className="muted">{t("platform.discover.sub")}</p>
      </div>
      <div className="lobby-filters" role="group" aria-label={t("platform.discover.filter")}>
        {(["all", ...WORLD_CATEGORIES.filter((c) => used.has(c))] as const).map((c) => (
          <button
            key={c}
            type="button"
            className={`lobby-chip ${category === c ? "on" : ""}`}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c === "all" ? t("platform.discover.all") : t(`platform.category.${c}`)}
          </button>
        ))}
      </div>
      <div className="lobby-worlds">
        {shown.map((w) => (
          <WorldCard key={w.id} world={w} guest={guest} level={w.id === "family-adventure" && summary?.started ? summary.level.level : null} />
        ))}
      </div>
    </section>
  );
}

function WorldCard({ world, guest, level }: { world: WorldDefinition; guest: boolean; level: number | null }) {
  const { t } = useTranslation();
  const playable = canLaunchWorld(world, { guest });
  const soon = world.status === "coming_soon";
  return (
    <article className={`lobby-world ${playable ? "" : "locked"}`}>
      <div className="lobby-world-art">
        <WorldArt thumbnail={world.thumbnail} />
        {soon && <span className="lobby-badge">{t("platform.comingSoon")}</span>}
      </div>
      <div className="lobby-world-body">
        <span className="lobby-world-cat">{t(`platform.category.${world.category}`)}</span>
        <h3>{t(`platform.world.${world.id}.title`)}</h3>
        <p className="muted small">{t(`platform.world.${world.id}.desc`)}</p>
        <div className="lobby-world-foot">
          {level !== null && <span className="lobby-level">{t("game.ui.level", { level })}</span>}
          {playable ? (
            <Link to={world.entryRoute!} className="lobby-btn primary small">▶ {t("platform.play")}</Link>
          ) : (
            <span className="muted small">
              {soon ? t("platform.comingSoon") : !world.guestAccessible && guest ? t("platform.accountOnly") : ""}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
