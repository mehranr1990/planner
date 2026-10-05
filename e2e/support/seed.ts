// Seeds deterministic E2E fixtures with plain SQL (the generated Prisma client is ESM-only and
// is not loaded in Playwright's TS runtime). Idempotent: every run first removes all e2e data
// (`@e2e.local` fixtures and `@e2e.test` accounts created by flow specs), then recreates it.
//
// Local `prisma dev` (PGlite) serves ONE connection. This runs in Playwright's global setup,
// before any request can make the app open its own connection, and closes when done.

import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";
import { E2E_PASSWORD, FLOW_DOMAIN, PERSONAL_TASKS, PROJECT_TASKS, SEEDED_DOMAIN, SHOWCASES, TEAMMATES } from "./fixtures-data";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

/** Same format as src/server/auth/password.ts (that module is `server-only`, so it can't be imported here). */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", 16384, 8, 1, salt.toString("base64url"), key.toString("base64url")].join("$");
}

function localDate(tz: string, offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export async function seed(databaseUrl: string): Promise<void> {
  const db = new pg.Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    await db.query("BEGIN");
    await cleanup(db);

    const hash = await hashPassword(E2E_PASSWORD);
    const tz = "Asia/Tehran";
    const today = localDate(tz);
    const tomorrow = localDate(tz, 1);
    const due = (d: "today" | "tomorrow" | null) => (d === "today" ? today : d === "tomorrow" ? tomorrow : null);

    for (const m of TEAMMATES) {
      await db.query(
        `INSERT INTO users (id, email, name, avatar_url, password_hash, timezone, onboarded_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, now(), now(), now())`,
        [m.id, `${m.id}@${SEEDED_DOMAIN}`, m.name, m.avatarUrl, hash, tz],
      );
    }

    let order = 0;
    for (const s of Object.values(SHOWCASES)) {
      // Seeded fixtures are established accounts, not fresh sign-ups — onboarding is already done.
      await db.query(
        `INSERT INTO users (id, email, name, password_hash, timezone, locale, theme, onboarded_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now(), now())`,
        [s.userId, s.email, s.name, hash, tz, s.locale, s.theme],
      );
      await db.query(`INSERT INTO workspaces (id, name, slug, timezone, created_by_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, now(), now())`, [
        s.workspaceId,
        s.workspaceName,
        `e2e-${s.key}`,
        tz,
        s.userId,
      ]);
      await db.query(`UPDATE users SET active_workspace_id = $1 WHERE id = $2`, [s.workspaceId, s.userId]);
      await db.query(`INSERT INTO memberships (id, workspace_id, user_id, role, status, joined_at) VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', now() - interval '1 day')`, [
        `${s.workspaceId}_m_owner`,
        s.workspaceId,
        s.userId,
      ]);
      await db.query(
        `INSERT INTO projects (id, scope, workspace_id, owner_id, created_by_id, name, color, status, health, visibility, created_at, updated_at)
         VALUES ($1, 'WORKSPACE', $2, $3, $3, $4, 'blue', 'ACTIVE', 'ON_TRACK', 'WORKSPACE', now(), now())`,
        [s.projectId, s.workspaceId, s.userId, s.projectName],
      );
      await db.query(`INSERT INTO project_members (project_id, user_id, role, added_at) VALUES ($1, $2, 'LEAD', now() - interval '1 day')`, [s.projectId, s.userId]);
      // One board column (Batch 5) so the Board surface shows more than just the unsectioned
      // group — t3/t4 move into it below, after tasks are inserted.
      await db.query(`INSERT INTO project_sections (id, project_id, name, sort_order) VALUES ($1, $2, $3, 1024)`, [
        `${s.projectId}_doing`,
        s.projectId,
        s.locale === "fa" ? "در حال انجام" : "Doing",
      ]);

      for (const [i, m] of TEAMMATES.entries()) {
        await db.query(`INSERT INTO memberships (id, workspace_id, user_id, role, status, joined_at) VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE', now() + ($4 || ' seconds')::interval)`, [
          `${s.workspaceId}_m_${m.id}`,
          s.workspaceId,
          m.id,
          String(i),
        ]);
        // Stable member order (role, then added_at) keeps the PeopleCluster preview deterministic.
        await db.query(`INSERT INTO project_members (project_id, user_id, role, added_at) VALUES ($1, $2, 'EDITOR', now() + ($3 || ' seconds')::interval)`, [s.projectId, m.id, String(i)]);
      }

      for (const t of PROJECT_TASKS) {
        const id = `${s.projectId}_${t.key}`;
        const sectionId = t.key === "t3" || t.key === "t4" ? `${s.projectId}_doing` : null;
        await db.query(
          `INSERT INTO tasks (id, scope, workspace_id, owner_id, created_by_id, project_id, section_id, title, status, priority, is_all_day, due_on, sort_order, created_at, updated_at)
           VALUES ($1, 'WORKSPACE', $2, $3, $3, $4, $5, $6, 'TODO', $7, true, $8, $9, now(), now())`,
          [id, s.workspaceId, s.userId, s.projectId, sectionId, s.locale === "fa" ? t.fa : t.en, t.priority, due(t.due), order++],
        );
        for (const a of t.assignees) {
          const userId = a === -1 ? s.userId : TEAMMATES[a]!.id;
          await db.query(`INSERT INTO task_assignees (task_id, user_id, assigned_by_id, assigned_at) VALUES ($1, $2, $3, now())`, [id, userId, s.userId]);
        }
      }
      for (const t of PERSONAL_TASKS) {
        await db.query(
          `INSERT INTO tasks (id, scope, owner_id, created_by_id, title, status, priority, is_all_day, due_on, is_someday, sort_order, created_at, updated_at)
           VALUES ($1, 'PERSONAL', $2, $2, $3, 'TODO', 'NONE', true, $4, $5, $6, now(), now())`,
          [`${s.userId}_${t.key}`, s.userId, s.locale === "fa" ? t.fa : t.en, due(t.due), Boolean(t.someday), order++],
        );
      }
    }
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    await db.end();
  }
}

/** Removes every e2e user and everything that hangs off them, respecting RESTRICT foreign keys. */
async function cleanup(db: pg.Client) {
  const users = `(SELECT id FROM users WHERE email LIKE '%@${SEEDED_DOMAIN}' OR email LIKE '%@${FLOW_DOMAIN}')`;
  const workspaces = `(SELECT id FROM workspaces WHERE created_by_id IN ${users})`;
  await db.query(`UPDATE users SET active_workspace_id = NULL WHERE id IN ${users}`);
  await db.query(`DELETE FROM tasks WHERE owner_id IN ${users} OR created_by_id IN ${users} OR workspace_id IN ${workspaces}`);
  await db.query(`DELETE FROM task_assignees WHERE user_id IN ${users} OR assigned_by_id IN ${users}`);
  await db.query(`DELETE FROM task_dependencies WHERE created_by_id IN ${users}`);
  await db.query(`DELETE FROM recurrence_series WHERE owner_id IN ${users}`);
  await db.query(`DELETE FROM labels WHERE owner_id IN ${users}`);
  await db.query(`DELETE FROM comments WHERE author_id IN ${users}`);
  await db.query(`DELETE FROM activities WHERE actor_id IN ${users} OR workspace_id IN ${workspaces}`);
  await db.query(`DELETE FROM audit_events WHERE workspace_id IN ${workspaces}`);
  await db.query(`DELETE FROM projects WHERE owner_id IN ${users} OR created_by_id IN ${users} OR workspace_id IN ${workspaces}`);
  await db.query(`DELETE FROM invitations WHERE invited_by_id IN ${users}`);
  await db.query(`DELETE FROM memberships WHERE user_id IN ${users} OR workspace_id IN ${workspaces}`);
  await db.query(`DELETE FROM areas WHERE owner_id IN ${users}`);
  await db.query(`DELETE FROM workspaces WHERE id IN ${workspaces}`);
  await db.query(`DELETE FROM users WHERE id IN ${users}`);
}
