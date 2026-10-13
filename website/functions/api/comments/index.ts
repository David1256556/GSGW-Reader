import { currentUser, publicUser } from "../../_lib/auth";
import type { CommentRow, Env } from "../../_lib/db";
import { all, first, run } from "../../_lib/db";
import { serializeComments } from "../../_lib/comments";
import { error, json, readJson } from "../../_lib/http";

export const MAX_BODY = 4000;
export const MAX_CHAPTER = 200;

const COMMENT_COLUMNS = `c.id, c.chapter, c.user_id, c.parent_id, c.body, c.is_legacy, c.created_at, c.updated_at, c.edited,
            u.login, u.display_name, u.avatar_url, u.provider, u.is_legacy AS user_is_legacy`;

const REACTION_COLUMNS = `r.comment_id, r.emoji, r.user_id, u.login, u.display_name`;

async function loadCounts(env: Env, chapter: string) {
  const row = await first<{ total: number; roots: number; replies: number }>(
    env,
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(parent_id IS NULL), 0) AS roots,
            COALESCE(SUM(parent_id IS NOT NULL), 0) AS replies
     FROM comments
     WHERE chapter = ? AND deleted = 0`,
    [chapter]
  );
  return {
    total: row?.total ?? 0,
    roots: row?.roots ?? 0,
    replies: row?.replies ?? 0,
  };
}

async function loadRoots(env: Env, chapter: string, currentUserId: number | null) {
  const rows = await all<CommentRow>(
    env,
    `SELECT ${COMMENT_COLUMNS}
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.chapter = ? AND c.deleted = 0 AND c.parent_id IS NULL
     ORDER BY c.created_at ASC, c.id ASC`,
    [chapter]
  );

  if (rows.length === 0) return [];

  const reactions = await all(
    env,
    `SELECT ${REACTION_COLUMNS}
     FROM reactions r
     JOIN users u ON u.id = r.user_id
     JOIN comments c ON c.id = r.comment_id
     WHERE c.chapter = ? AND c.deleted = 0 AND c.parent_id IS NULL`,
    [chapter]
  );

  return serializeComments(rows, reactions, currentUserId);
}

async function loadReplyCounts(env: Env, chapter: string): Promise<Record<string, number>> {
  const rows = await all<{ parent_id: number; count: number }>(
    env,
    `SELECT parent_id, COUNT(*) AS count
     FROM comments
     WHERE chapter = ? AND deleted = 0 AND parent_id IS NOT NULL
     GROUP BY parent_id`,
    [chapter]
  );
  const out: Record<string, number> = {};
  for (const row of rows) out[String(row.parent_id)] = row.count;
  return out;
}

async function loadChapter(env: Env, chapter: string, currentUserId: number | null) {
  const rows = await all<CommentRow>(
    env,
    `SELECT ${COMMENT_COLUMNS}
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.chapter = ? AND c.deleted = 0
     ORDER BY c.created_at ASC, c.id ASC`,
    [chapter]
  );

  if (rows.length === 0) return [];

  const reactions = await all(
    env,
    `SELECT ${REACTION_COLUMNS}
     FROM reactions r
     JOIN users u ON u.id = r.user_id
     JOIN comments c ON c.id = r.comment_id
     WHERE c.chapter = ? AND c.deleted = 0`,
    [chapter]
  );

  return serializeComments(rows, reactions, currentUserId);
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const env = context.env as Env;
  const url = new URL(context.request.url);
  const chapter = (url.searchParams.get("chapter") || "").trim();
  const scope = url.searchParams.get("scope") || "full";
  if (!chapter || chapter.length > MAX_CHAPTER) return error("Invalid chapter");

  // Lightweight: only counts, no comment bodies/reactions.
  if (scope === "count") {
    return json(await loadCounts(env, chapter));
  }

  const user = await currentUser(context);


  if (scope === "roots") {
    const [comments, replyCounts, counts] = await Promise.all([
      loadRoots(env, chapter, user?.id ?? null),
      loadReplyCounts(env, chapter),
      loadCounts(env, chapter),
    ]);
    return json({
      comments,
      replyCounts,
      total: counts.total,
      roots: counts.roots,
      replies: counts.replies,
    });
  }

  const comments = await loadChapter(env, chapter, user?.id ?? null);
  return json({ comments, total: comments.length });
};

export const onRequestPost = async (context: any): Promise<Response> => {
  const env = context.env as Env;
  const user = await currentUser(context);
  if (!user) return error("Sign in required", 401);

  const payload = await readJson<{ chapter?: string; body?: string; parentId?: number | null }>(
    context.request
  );
  if (!payload) return error("Invalid JSON");

  const chapter = (payload.chapter || "").trim();
  const body = (payload.body || "").trim();
  if (!chapter || chapter.length > MAX_CHAPTER) return error("Invalid chapter");
  if (!body || body.length > MAX_BODY) return error(`Comment must be 1-${MAX_BODY} characters`);

  let parentId: number | null = null;
  if (payload.parentId) {
    const parent = await first<{ id: number; parent_id: number | null; chapter: string }>(
      env,
      "SELECT id, parent_id, chapter FROM comments WHERE id = ? AND deleted = 0",
      [payload.parentId]
    );
    if (!parent || parent.chapter !== chapter) return error("Invalid parent comment");
    parentId = parent.parent_id ?? parent.id;
  }

  const result = await run(
    env,
    "INSERT INTO comments (chapter, user_id, parent_id, body) VALUES (?, ?, ?, ?)",
    [chapter, user.id, parentId, body]
  );
  const id = Number(result.meta?.last_row_id);
  const row = await first<CommentRow>(
    env,
    `SELECT ${COMMENT_COLUMNS}
     FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
    [id]
  );
  return json({ comment: row ? serializeComments([row], [], user.id)[0] : null }, { status: 201 });
};

export { publicUser };
