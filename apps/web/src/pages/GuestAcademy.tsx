import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AcademyWorld } from "../academy/AcademyWorld";
import { guestBackend } from "../game/guest";

/** Signed-out Learning Academy: local-only progress shared with guest village play. */
export default function GuestAcademyPage() {
  const { t } = useTranslation();
  const backend = useMemo(() => guestBackend(t("game.guest.name")), [t]);
  return (
    <div className="guest-academy">
      <header className="guest-bar">
        <Link to="/" className="guest-brand">{t("common.appName")}</Link>
        <span className="guest-note">{t("game.guest.banner")}</span>
        <Link to="/login?next=/academy" className="land-link">{t("common.login")}</Link>
        <Link to="/register?next=/academy"><button type="button">{t("game.guest.signUp")}</button></Link>
      </header>
      <main className="guest-academy-main">
        <AcademyWorld backend={backend} />
      </main>
    </div>
  );
}
