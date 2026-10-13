import { currentUser, publicUser } from "../../_lib/auth";
import type { CommentRow, Env } from "../../_lib/db";
import { all, first, run } from "../../_lib/db";
import { error, json, readJson } from "../../_lib/http";

export const MAX_BODY = 4000;
export const MAX_CHAPTER = 200;

interface ReactionAgg {
  emoji: string;
  count: number;
  mine: boolean;
  users: string[];
}

function serializeComments(rows: CommentRow[], reactions: any[], currentUserId: number | null) {
  const byComment = new Map<number, ReactionAgg[]>();
  for (const r of reactions) {
    let list = byComment.get(r.comment_id);
    if (!list) {
      list = [];
      byComment.set(r.comment_id, list);
    }
    let agg = list.find((x) => x.emoji === r.emoji);
    if (!agg) {
      agg = { emoji: r.emoji, count: 0, mine: false, users: [] };
      list.push(agg);
    }
    agg.count += 1;
    if (r.user_id === currentUserId) agg.mine = true;
    const name = r.display_name || r.login;
    if (agg.users.length < 12) agg.users.push(name);
  }

  return rows.map((row) => ({
    id: row.id,
    chapter: row.chapter,
    parentId: row.parent_id,
    body: row.body,
    isLegacy: row.is_legacy === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    edited: row.edited === 1,
    author: {
      login: row.login,
      displayName: row.display_name || row.login,
      avatarUrl: row.avatar_url,
      provider: row.provider,
      isLegacy: row.user_is_legacy === 1,
    },
    reactions: byComment.get(row.id) ?? [],
  }));
}

async function loadChapter(env: Env, chapter: string, currentUserId: number | null) {
  const rows = await all<CommentRow>(
    env,
    `SELECT c.id, c.chapter, c.user_id, c.parent_id, c.body, c.is_legacy, c.created_at, c.updated_at, c.edited,
            u.login, u.display_name, u.avatar_url, u.provider, u.is_legacy AS user_is_legacy
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.chapter = ? AND c.deleted = 0
     ORDER BY c.created_at ASC, c.id ASC`,
    [chapter]
  );

  if (rows.length === 0) return [];

  const reactions = await all(
    env,
    `SELECT r.comment_id, r.emoji, r.user_id, u.login, u.display_name
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
  if (!chapter || chapter.length > MAX_CHAPTER) return error("Invalid chapter");
  const user = await currentUser(context);
  const comments = await loadChapter(env, chapter, user?.id ?? null);
  return json({ comments });
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
    `SELECT c.id, c.chapter, c.user_id, c.parent_id, c.body, c.is_legacy, c.created_at, c.updated_at, c.edited,
            u.login, u.display_name, u.avatar_url, u.provider, u.is_legacy AS user_is_legacy
     FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
    [id]
  );
  return json({ comment: row ? serializeComments([row], [], user.id)[0] : null }, { status: 201 });
};

export { publicUser };
