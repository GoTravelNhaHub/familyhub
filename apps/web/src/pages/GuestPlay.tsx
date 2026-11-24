import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { guestBackend } from "../game/guest";
import { GameSession } from "./Play";

/** Signed-out play: same game, local-only progress, no API calls. */
export default function GuestPlayPage() {
  const { t } = useTranslation();
  const backend = useMemo(() => guestBackend(t("game.guest.name")), [t]);
  return (
    <div className="guest-play">
      <header className="guest-bar">
        <Link to="/" className="guest-brand">{t("common.appName")}</Link>
        <span className="guest-note">{t("game.guest.banner")}</span>
        <Link to="/login?next=/play" className="land-link">{t("common.login")}</Link>
        <Link to="/register?next=/play"><button type="button">{t("game.guest.signUp")}</button></Link>
      </header>
      <GameSession backend={backend} />
    </div>
  );
}
