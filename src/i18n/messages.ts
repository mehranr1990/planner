import enAuth from "../../messages/en/auth.json";
import enCommon from "../../messages/en/common.json";
import enErrors from "../../messages/en/errors.json";
import enHome from "../../messages/en/home.json";
import enInvitations from "../../messages/en/invitations.json";
import enNavigation from "../../messages/en/navigation.json";
import enNotifications from "../../messages/en/notifications.json";
import enOnboarding from "../../messages/en/onboarding.json";
import enPlanner from "../../messages/en/planner.json";
import enProjects from "../../messages/en/projects.json";
import enSecurity from "../../messages/en/security.json";
import enSettings from "../../messages/en/settings.json";
import enTasks from "../../messages/en/tasks.json";
import enWorkspace from "../../messages/en/workspace.json";
import faAuth from "../../messages/fa/auth.json";
import faCommon from "../../messages/fa/common.json";
import faErrors from "../../messages/fa/errors.json";
import faHome from "../../messages/fa/home.json";
import faInvitations from "../../messages/fa/invitations.json";
import faNavigation from "../../messages/fa/navigation.json";
import faNotifications from "../../messages/fa/notifications.json";
import faOnboarding from "../../messages/fa/onboarding.json";
import faPlanner from "../../messages/fa/planner.json";
import faProjects from "../../messages/fa/projects.json";
import faSecurity from "../../messages/fa/security.json";
import faSettings from "../../messages/fa/settings.json";
import faTasks from "../../messages/fa/tasks.json";
import faWorkspace from "../../messages/fa/workspace.json";
import type { AppLocale } from "./config";

// One namespace per file under messages/<locale>/. English is the source catalog; its shape
// is the type every other locale must satisfy (missing keys fail `tsc`).
const en = {
  common: enCommon,
  navigation: enNavigation,
  auth: enAuth,
  errors: enErrors,
  home: enHome,
  planner: enPlanner,
  tasks: enTasks,
  projects: enProjects,
  workspace: enWorkspace,
  settings: enSettings,
  invitations: enInvitations,
  onboarding: enOnboarding,
  security: enSecurity,
  notifications: enNotifications,
};

export type Messages = typeof en;
export type ErrorCode = keyof Messages["errors"];

const fa = {
  common: faCommon,
  navigation: faNavigation,
  auth: faAuth,
  errors: faErrors,
  home: faHome,
  planner: faPlanner,
  tasks: faTasks,
  projects: faProjects,
  workspace: faWorkspace,
  settings: faSettings,
  invitations: faInvitations,
  onboarding: faOnboarding,
  security: faSecurity,
  notifications: faNotifications,
} satisfies Messages;

const catalogs: Record<AppLocale, Messages> = { en, fa };

export function messagesFor(locale: AppLocale): Messages {
  return catalogs[locale];
}

export const NAMESPACES = Object.keys(en) as (keyof Messages)[];
