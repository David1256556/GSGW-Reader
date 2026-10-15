import { cookie, parseCookies } from "./http";

const COOKIE_NAME = "gsgw_sid";
const TTL_SECONDS = 60 * 60 * 24 * 30;
const STATE_COOKIE = "gsgw_oauth_state";

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeString(value: string): string {
  return base64Url(encoder.encode(value));
}

function decodeString(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64Url(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface SessionPayload {
  uid: number;
  exp: number;
}

export async function createSessionCookie(secret: string, uid: number, secure: boolean): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = encodeString(JSON.stringify({ uid, exp }));
  const signature = await hmac(secret, payload);
  return cookie(COOKIE_NAME, `${payload}.${signature}`, {
    maxAge: TTL_SECONDS,
    secure,
  });
}

export function clearSessionCookie(secure: boolean): string {
  return cookie(COOKIE_NAME, "", { maxAge: 0, secure });
}

export async function readSession(request: Request, secret: string): Promise<SessionPayload | null> {
  const raw = parseCookies(request)[COOKIE_NAME];
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  const expected = await hmac(secret, payload);
  if (!timingSafeEqual(expected, signature)) return null;
  try {
    const data = JSON.parse(decodeString(payload)) as SessionPayload;
    if (!data || typeof data.uid !== "number") return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function makeOAuthState(): string {
  return crypto.randomUUID();
}

export function setOAuthState(state: string, returnTo: string, secure: boolean): string {
  return cookie(STATE_COOKIE, `${state}:${encodeString(returnTo)}`, {
    maxAge: 600,
    secure,
  });
}

export function readOAuthState(request: Request): { state: string; returnTo: string } | null {
  const raw = parseCookies(request)[STATE_COOKIE];
  if (!raw) return null;
  const sep = raw.indexOf(":");
  if (sep === -1) return null;
  const state = raw.slice(0, sep);
  const returnToEncoded = raw.slice(sep + 1);
  try {
    return { state, returnTo: decodeString(returnToEncoded) };
  } catch {
    return null;
  }
}

export function clearOAuthState(secure: boolean): string {
  return cookie(STATE_COOKIE, "", { maxAge: 0, secure });
}
