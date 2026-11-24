import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "./navItems";

const NAV = NAV_ITEMS.filter((item) => !item.drawerOnly);

export function BottomTabs() {
  const { t } = useTranslation();
  return (
    <nav className="bottom-tabs" aria-label="Primary">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) => `bottom-tab ${isActive ? "active" : ""}`}
        >
          <span className="bottom-tab-emoji">{item.emoji}</span>
          <span className="bottom-tab-label">{t(item.key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
