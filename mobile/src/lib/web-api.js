import { clerkFetch } from "@/lib/fapi-auth";

const DEFAULT_WEB_BASE_URL = "https://www.dreaminaudio.xyz";

export const getWebBaseUrl = () =>
  (
    process.env.EXPO_PUBLIC_WEB_BASE_URL ||
    process.env.EXPO_PUBLIC_APP_URL ||
    process.env.EXPO_PUBLIC_BASE_URL ||
    DEFAULT_WEB_BASE_URL
  ).replace(/\/+$/, "");

export const getWebUrl = (path = "/") => {
  const base = getWebBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

const getSessionJwt = async (sessionId) => {
  if (!sessionId) {
    const error = new Error("Missing active session");
    error.code = "MISSING_SESSION";
    throw error;
  }

  const response = await clerkFetch(`/v1/client/sessions/${sessionId}/tokens`, {
    method: "POST",
  });

  const data = await response.json().catch(() => ({}));
  const jwt = typeof data?.jwt === "string" ? data.jwt.trim() : "";

  if (!response.ok || !jwt) {
    const error = new Error(data?.errors?.[0]?.message || data?.message || "Unable to get session token");
    error.code = "TOKEN_UNAVAILABLE";
    error.status = response.status;
    throw error;
  }

  return jwt;
};

export const authorizedWebFetch = async ({ sessionId, path, init = {} }) => {
  const token = await getSessionJwt(sessionId);
  const headers = new Headers(init.headers || {});

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");

  return fetch(getWebUrl(path), {
    ...init,
    headers,
  });
};
