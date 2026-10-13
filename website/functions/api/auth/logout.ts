import { isSecure, redirectWithCookies } from "../../_lib/http";
import { clearSessionCookie } from "../../_lib/session";

export const onRequestGet = async (context: any): Promise<Response> => {
  const url = new URL(context.request.url);
  const rawReturnTo = url.searchParams.get("returnTo") || "/";
  const returnTo = rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//") ? rawReturnTo : "/";
  return redirectWithCookies(returnTo, [clearSessionCookie(isSecure(context.request))]);
};
