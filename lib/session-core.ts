import type { SessionUser } from "@/lib/types";

const SESSION_COOKIE = "scp_session";
const STAFF_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const CUSTOMER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

type SessionPayload = SessionUser & {
  exp: number;
};

function base64UrlEncode(value: string) {
  return btoa(unescape(encodeURIComponent(value)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );

  return decodeURIComponent(escape(atob(padded)));
}

async function getSigningKey() {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }

  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signPayload(payload: string) {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  const bytes = Array.from(new Uint8Array(signature));
  const binary = bytes.map((byte) => String.fromCharCode(byte)).join("");

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function verifySignature(payload: string, signature: string) {
  const expected = await signPayload(payload);
  return expected === signature;
}

function getSessionMaxAgeSeconds(role: SessionUser["role"]) {
  return role === "customer"
    ? CUSTOMER_SESSION_MAX_AGE_SECONDS
    : STAFF_SESSION_MAX_AGE_SECONDS;
}

export async function encodeSession(user: SessionUser) {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + getSessionMaxAgeSeconds(user.role)
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function readSessionFromCookie(cookieValue?: string) {
  if (!cookieValue) {
    return null;
  }

  const [encodedPayload, signature] = cookieValue.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const isValid = await verifySignature(encodedPayload, signature);

  if (!isValid) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return {
    id: payload.id,
    role: payload.role,
    displayName: payload.displayName
  } satisfies SessionUser;
}

export {
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
  getSessionMaxAgeSeconds,
  SESSION_COOKIE,
  STAFF_SESSION_MAX_AGE_SECONDS
};
