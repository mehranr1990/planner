import { FolderKanban, House, ListChecks, Users, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  /** Key in the `navigation` message namespace. */
  labelKey: "home" | "planner" | "projects" | "team";
  icon: LucideIcon;
  /** Path prefix that marks the item active. */
  match: string;
}

// Only modules that exist are listed. Planned modules (docs/PAGE_INVENTORY.md) join as they ship —
// the navigation never links to placeholder pages. Settings lives in the account menu, not here
// (it isn't a primary module).
export const PRIMARY_NAV: NavItem[] = [
  { href: "/home", labelKey: "home", icon: House, match: "/home" },
  { href: "/planner/today", labelKey: "planner", icon: ListChecks, match: "/planner" },
  { href: "/projects", labelKey: "projects", icon: FolderKanban, match: "/projects" },
  { href: "/team", labelKey: "team", icon: Users, match: "/team" },
];

export function isActive(pathname: string, item: NavItem) {
  return pathname === item.match || pathname.startsWith(`${item.match}/`);
}
