import type { Env } from "./db";

const API = "https://discord.com/api/v10";

export function authorizeUrl(env: Env, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
    state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCode(env: Env, code: string, redirectUri: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Discord token exchange failed (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Discord token exchange returned no access_token");
  return data.access_token;
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

export async function fetchUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Discord user fetch failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as DiscordUser;
}

export function avatarUrl(user: DiscordUser): string {
  if (!user.avatar) {
    const index = Number(BigInt(user.id) % 5n);
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

export function displayName(user: DiscordUser): string {
  return user.global_name || user.username;
}
