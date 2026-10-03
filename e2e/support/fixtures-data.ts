// Deterministic fixture definitions shared by the seed (global setup) and the specs.
// Fixed ids keep avatar tones (hashed from the id) stable across runs, which the visual
// baselines depend on.

export const E2E_PASSWORD = "e2e-password-123";
export const SEEDED_DOMAIN = "e2e.local"; // seeded fixtures
export const FLOW_DOMAIN = "e2e.test"; // accounts created by flow specs (cleaned on every run)

export type ShowcaseKey = "en-light" | "en-dark" | "fa-light" | "fa-dark";

export interface Showcase {
  key: ShowcaseKey;
  userId: string;
  email: string;
  name: string;
  locale: "en" | "fa";
  theme: "LIGHT" | "DARK";
  workspaceId: string;
  workspaceName: string;
  projectId: string;
  projectName: string;
}

function showcase(key: ShowcaseKey, locale: "en" | "fa", theme: "LIGHT" | "DARK"): Showcase {
  const slug = key.replace("-", "_");
  return {
    key,
    userId: `e2e_owner_${slug}`,
    email: `owner-${key}@${SEEDED_DOMAIN}`,
    name: locale === "fa" ? "مینا رحیمی" : "Mina Rahimi",
    locale,
    theme,
    workspaceId: `e2e_ws_${slug}`,
    workspaceName: locale === "fa" ? "استودیو نوروز" : "Northwind Studio",
    projectId: `e2e_prj_${slug}`,
    projectName: locale === "fa" ? "بازطراحی وب‌سایت" : "Website relaunch",
  };
}

export const SHOWCASES: Record<ShowcaseKey, Showcase> = {
  "en-light": showcase("en-light", "en", "LIGHT"),
  "en-dark": showcase("en-dark", "en", "DARK"),
  "fa-light": showcase("fa-light", "fa", "LIGHT"),
  "fa-dark": showcase("fa-dark", "fa", "DARK"),
};

/** A tiny abstract "photo" (data URI) so the real-avatar path renders without network access. */
export const PHOTO_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#83A2DB'/><stop offset='1' stop-color='#FFCE87'/></linearGradient></defs><rect width='64' height='64' fill='url(#g)'/><circle cx='32' cy='26' r='12' fill='#fff' opacity='.85'/><rect x='14' y='42' width='36' height='22' rx='11' fill='#fff' opacity='.85'/></svg>",
  );

/** Teammates shared by every showcase workspace. Index 1 has a photo; index 3 a Persian name. */
export const TEAMMATES = [
  { id: "e2e_mate_1", name: "Arash Karimi", avatarUrl: null },
  { id: "e2e_mate_2", name: "Sara Novak", avatarUrl: PHOTO_AVATAR },
  { id: "e2e_mate_3", name: "Leo Martins", avatarUrl: null },
  { id: "e2e_mate_4", name: "نگار احمدی", avatarUrl: null },
  { id: "e2e_mate_5", name: "Kenji Ito", avatarUrl: null },
  { id: "e2e_mate_6", name: "Ava Chen", avatarUrl: null },
  { id: "e2e_mate_7", name: "Omar Haddad", avatarUrl: null },
] as const;

type Due = "today" | "tomorrow" | null;

/**
 * Project tasks with assignments (teammate indexes; -1 = the showcase owner).
 * Resulting open allocation: Arash 5 · Sara 3 · owner 3 · نگار 2 · Leo/Kenji/Ava/Omar 1.
 */
export const PROJECT_TASKS: { key: string; en: string; fa: string; due: Due; priority: "NONE" | "HIGH" | "URGENT"; assignees: number[] }[] = [
  { key: "t1", en: "Draft homepage copy", fa: "نوشتن متن صفحهٔ اصلی", due: "today", priority: "NONE", assignees: [-1, 0, 1] },
  { key: "t2", en: "Audit analytics tags", fa: "بازبینی برچسب‌های آمار", due: "today", priority: "URGENT", assignees: [-1, 0, 4, 5, 6] },
  { key: "t3", en: "Pick hosting provider", fa: "انتخاب میزبان", due: "tomorrow", priority: "HIGH", assignees: [-1, 0, 2, 3] },
  { key: "t4", en: "Design review", fa: "بازبینی طراحی", due: "tomorrow", priority: "NONE", assignees: [0, 1, 3] },
  { key: "t5", en: "Write launch post", fa: "نوشتن متن معرفی", due: null, priority: "NONE", assignees: [0, 1] },
];

export const PERSONAL_TASKS: { key: string; en: string; fa: string; due: Due; someday?: boolean }[] = [
  { key: "p1", en: "Renew passport", fa: "تمدید گذرنامه", due: "today" },
  { key: "p2", en: "Call the bank", fa: "تماس با بانک", due: null },
  { key: "p3", en: "Learn piano", fa: "یادگیری پیانو", due: null, someday: true },
];
