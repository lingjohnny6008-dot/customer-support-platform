import { cookies } from "next/headers";
import type { SessionUser } from "@/lib/types";
import {
  encodeSession,
  getSessionMaxAgeSeconds,
  readSessionFromCookie,
  SESSION_COOKIE
} from "@/lib/session-core";

export async function createSession(user: SessionUser) {
  const cookieValue = await encodeSession(user);

  cookies().set(SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionMaxAgeSeconds(user.role)
  });
}

export function clearSession() {
  cookies().delete(SESSION_COOKIE);
}

export async function getCurrentSession() {
  return readSessionFromCookie(cookies().get(SESSION_COOKIE)?.value);
}

export { readSessionFromCookie, SESSION_COOKIE };
