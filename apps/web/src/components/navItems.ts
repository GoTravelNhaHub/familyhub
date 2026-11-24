import { flags } from "../lib/flags";

export interface NavItem {
  to: string;
  emoji: string;
  key: string;
  /** Hidden from the mobile bottom bar (still in the drawer and on the Family page). */
  drawerOnly?: boolean;
}

const LEGACY: NavItem[] = [
  { to: "/", emoji: "🏠", key: "nav.home" },
  { to: "/play", emoji: "🗺️", key: "nav.play" },
  { to: "/tasks", emoji: "✅", key: "nav.tasks" },
  { to: "/rewards", emoji: "🎁", key: "nav.rewards" },
  { to: "/redemptions", emoji: "📬", key: "nav.requests" },
  { to: "/members", emoji: "👨‍👩‍👧", key: "nav.family" },
  { to: "/events", emoji: "📅", key: "nav.calendar" },
];

/** Game lobby first, then Play, then the family tools. */
const PLATFORM: NavItem[] = [
  { to: "/", emoji: "🎮", key: "nav.home" },
  { to: "/play", emoji: "🗺️", key: "nav.play" },
  { to: "/family", emoji: "🏡", key: "nav.family" },
  { to: "/tasks", emoji: "✅", key: "nav.tasks" },
  { to: "/rewards", emoji: "🎁", key: "nav.rewards" },
  { to: "/redemptions", emoji: "📬", key: "nav.requests" },
  { to: "/members", emoji: "👨‍👩‍👧", key: "nav.members", drawerOnly: true },
  { to: "/events", emoji: "📅", key: "nav.calendar" },
];

export const NAV_ITEMS: NavItem[] = flags.gameFirstHome && flags.platformNavigation ? PLATFORM : LEGACY;
