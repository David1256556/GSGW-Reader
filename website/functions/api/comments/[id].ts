import { currentUser } from "../../_lib/auth";
import type { CommentRow, Env } from "../../_lib/db";
import { first, run } from "../../_lib/db";
import { error, json, readJson } from "../../_lib/http";

async function loadOwned(env: Env, id: number, userId: number) {
  return await first<CommentRow>(
    env,
    "SELECT id, user_id FROM comments WHERE id = ? AND deleted = 0",
    [id]
  );
}

export const onRequestPatch = async (context: any): Promise<Response> => {
  const env = context.env as Env;
  const user = await currentUser(context);
  if (!user) return error("Sign in required", 401);

  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return error("Invalid id");

  const row = await loadOwned(env, id, user.id);
  if (!row) return error("Comment not found", 404);
  if (row.user_id !== user.id) return error("Not allowed", 403);

  const payload = await readJson<{ body?: string }>(context.request);
  const body = (payload?.body || "").trim();
  if (!body || body.length > 4000) return error("Comment must be 1-4000 characters");

  await run(
    env,
    "UPDATE comments SET body = ?, edited = 1, updated_at = datetime('now') WHERE id = ?",
    [body, id]
  );
  return json({ ok: true });
};

export const onRequestDelete = async (context: any): Promise<Response> => {
  const env = context.env as Env;
  const user = await currentUser(context);
  if (!user) return error("Sign in required", 401);

  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return error("Invalid id");

  const row = await loadOwned(env, id, user.id);
  if (!row) return error("Comment not found", 404);
  if (row.user_id !== user.id) return error("Not allowed", 403);

  await run(env, "UPDATE comments SET deleted = 1, body = '' WHERE id = ?", [id]);
  return json({ ok: true });
};
