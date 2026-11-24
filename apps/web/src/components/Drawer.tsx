import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "./navItems";

const NAV = NAV_ITEMS;

interface DrawerProps {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapsed: () => void;
}

export function Drawer({ open, collapsed, onClose, onToggleCollapsed }: DrawerProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className={`drawer-scrim ${open ? "visible" : ""}`} onClick={onClose} aria-hidden />
      <aside className={`drawer ${collapsed ? "collapsed" : ""} ${open ? "open" : ""}`} aria-label="Main menu">
        <div className="drawer-head">
          {!collapsed && <strong>{t("common.appName")}</strong>}
          <button
            className="icon-btn drawer-collapse"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            type="button"
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>
        <nav>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={onClose}
              className={({ isActive }) => `drawer-link ${isActive ? "active" : ""}`}
              title={t(item.key)}
            >
              <span className="drawer-emoji">{item.emoji}</span>
              {!collapsed && <span className="drawer-label">{t(item.key)}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
