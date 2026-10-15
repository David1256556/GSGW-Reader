import { currentUser } from "../../../../_lib/auth";
import type { Env } from "../../../../_lib/db";
import { all, first, run } from "../../../../_lib/db";
import { error, json } from "../../../../_lib/http";
import { aggregateReactions, ALLOWED_REACTION_SET, decodeEmojiParam } from "../../../../_lib/reactions";

export const onRequestPost = async (context: any): Promise<Response> => {
  const env = context.env as Env;
  const user = await currentUser(context);
  if (!user) return error("Sign in required", 401);

  const id = Number(context.params.id);
  const emoji = decodeEmojiParam(String(context.params.emoji || ""));
  if (!Number.isInteger(id)) return error("Invalid id");
  if (!ALLOWED_REACTION_SET.has(emoji)) return error("Unsupported reaction");

  const comment = await first<{ id: number }>(
    env,
    "SELECT id FROM comments WHERE id = ? AND deleted = 0",
    [id]
  );
  if (!comment) return error("Comment not found", 404);

  const existing = await first<{ id: number }>(
    env,
    "SELECT id FROM reactions WHERE comment_id = ? AND user_id = ? AND emoji = ?",
    [id, user.id, emoji]
  );

  if (existing) {
    await run(env, "DELETE FROM reactions WHERE id = ?", [existing.id]);
  } else {
    await run(
      env,
      "INSERT INTO reactions (comment_id, user_id, emoji) VALUES (?, ?, ?) ON CONFLICT (comment_id, user_id, emoji) DO NOTHING",
      [id, user.id, emoji]
    );
  }

  const rows = await all<{ emoji: string; user_id: number; display_name: string | null; login: string }>(
    env,
    `SELECT r.emoji, r.user_id, u.display_name, u.login
     FROM reactions r JOIN users u ON u.id = r.user_id
     WHERE r.comment_id = ?`,
    [id]
  );

  return json({ reactions: aggregateReactions(rows, user.id) });
};
