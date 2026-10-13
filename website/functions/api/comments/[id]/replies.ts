import { currentUser } from "../../../_lib/auth";
import type { CommentRow, Env } from "../../../_lib/db";
import { all } from "../../../_lib/db";
import { serializeComments } from "../../../_lib/comments";
import { error, json } from "../../../_lib/http";

export const onRequestGet = async (context: any): Promise<Response> => {
  const env = context.env as Env;
  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) return error("Invalid id");

  const user = await currentUser(context);

  const rows = await all<CommentRow>(
    env,
    `SELECT c.id, c.chapter, c.user_id, c.parent_id, c.body, c.is_legacy, c.created_at, c.updated_at, c.edited,
            u.login, u.display_name, u.avatar_url, u.provider, u.is_legacy AS user_is_legacy
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.parent_id = ? AND c.deleted = 0
     ORDER BY c.created_at ASC, c.id ASC`,
    [id]
  );

  if (rows.length === 0) return json({ comments: [], total: 0 });

  const reactions = await all(
    env,
    `SELECT r.comment_id, r.emoji, r.user_id, u.login, u.display_name
     FROM reactions r
     JOIN users u ON u.id = r.user_id
     JOIN comments c ON c.id = r.comment_id
     WHERE c.parent_id = ? AND c.deleted = 0`,
    [id]
  );

  const comments = serializeComments(rows, reactions, user?.id ?? null);
  return json({ comments, total: comments.length });
};
