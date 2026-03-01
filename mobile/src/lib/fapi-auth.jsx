/**
 * Custom auth provider that checks the Clerk FAPI directly.
 * Works around a bug in @clerk/clerk-js headless mode where
 * sessions are dropped during response parsing in React Native.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";

const CLERK_FRONTEND_API = "https://clerk.sneakstream.xyz";
const CLIENT_JWT_KEY = "__clerk_client_jwt";

const AuthContext = createContext({
  isLoaded: false,
  isSignedIn: false,
  sessionId: null,
  userId: null,
  user: null,
  refresh: () => {},
});

export async function clerkFetch(path, options = {}) {
  const jwt = await SecureStore.getItemAsync(CLIENT_JWT_KEY, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });

  const url = new URL(`${CLERK_FRONTEND_API}${path}`);
  url.searchParams.append("_is_native", "1");
  url.searchParams.append("_clerk_js_version", "5");

  console.log("[clerkFetch]", options.method || "GET", path, "storedJwt:", jwt ? `${jwt.substring(0, 20)}...` : "NONE");

  const resp = await fetch(url.toString(), {
    credentials: "omit",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      authorization: jwt || "",
      "x-mobile": "1",
      ...options.headers,
    },
    ...options,
  });

  // Log all response headers to find where the JWT is
  const allHeaders = {};
  resp.headers.forEach((value, key) => {
    allHeaders[key] = value.length > 40 ? value.substring(0, 40) + "..." : value;
  });
  console.log("[clerkFetch]", path, "status:", resp.status, "headers:", JSON.stringify(allHeaders));

  const newJwt = resp.headers.get("authorization");
  if (newJwt) {
    await SecureStore.setItemAsync(CLIENT_JWT_KEY, newJwt, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
    console.log("[clerkFetch] stored new JWT from authorization header");
  }

  return resp;
}

async function checkSession() {
  try {
    const resp = await clerkFetch("/v1/client", { method: "GET" });
    const data = await resp.json();
    const sessions = data?.response?.sessions || [];
    const active = sessions.find((s) => s.status === "active");
    if (active) {
      // Verify the JWT is actually usable for token requests
      const tokenResp = await clerkFetch(
        `/v1/client/sessions/${active.id}/tokens/convex`,
        { method: "POST" },
      );
      if (!tokenResp.ok) {
        // JWT is stale — clear it so user can sign in fresh
        console.warn("[checkSession] JWT stale (token request returned", tokenResp.status, ") — clearing stored JWT");
        await SecureStore.deleteItemAsync(CLIENT_JWT_KEY);
        return { isSignedIn: false, sessionId: null, userId: null, user: null };
      }
      return {
        isSignedIn: true,
        sessionId: active.id,
        userId: active.user?.id,
        user: active.user,
      };
    }
  } catch (e) {
    console.error("FAPI auth check failed:", e);
  }
  return { isSignedIn: false, sessionId: null, userId: null, user: null };
}

export function FAPIAuthProvider({ children }) {
  const [state, setState] = useState({
    isLoaded: false,
    isSignedIn: false,
    sessionId: null,
    userId: null,
    user: null,
  });

  const refresh = useCallback(async () => {
    const result = await checkSession();
    setState({ ...result, isLoaded: true });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ ...state, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useFAPIAuth() {
  return useContext(AuthContext);
}

/**
 * Custom useAuth for ConvexProviderWithClerk.
 * Returns a getToken function that fetches session tokens from the FAPI.
 */
export function useFAPIConvexAuth() {
  const { isLoaded, isSignedIn, sessionId } = useFAPIAuth();

  // Use a ref so getToken always reads the latest sessionId,
  // even when captured in a stale closure by ConvexProviderWithClerk.
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  console.log("[ConvexAuth] hook called — isLoaded:", isLoaded, "isSignedIn:", isSignedIn, "sessionId:", sessionId);

  const getToken = useCallback(
    async ({ template } = {}) => {
      const sid = sessionIdRef.current;
      console.log("[ConvexAuth getToken] called — template:", template, "sessionId from ref:", sid);
      if (!sid) {
        console.log("[ConvexAuth getToken] no sessionId, returning null");
        return null;
      }
      try {
        const path = template
          ? `/v1/client/sessions/${sid}/tokens/${template}`
          : `/v1/client/sessions/${sid}/tokens`;
        console.log("[ConvexAuth getToken] fetching:", path);
        const resp = await clerkFetch(path, {
          method: "POST",
        });
        const data = await resp.json();
        const jwt = data?.jwt || null;
        console.log("[ConvexAuth getToken] status:", resp.status, "hasJwt:", !!jwt, "jwtLength:", jwt?.length);
        if (jwt) {
          // Decode JWT payload to check claims
          try {
            const payload = JSON.parse(atob(jwt.split('.')[1]));
            console.log("[ConvexAuth getToken] JWT claims — iss:", payload.iss, "sub:", payload.sub, "aud:", payload.aud, "exp:", payload.exp, "nbf:", payload.nbf);
          } catch (e) {
            console.log("[ConvexAuth getToken] could not decode JWT");
          }
        } else {
          console.log("[ConvexAuth getToken] NO JWT — full response:", JSON.stringify(data).substring(0, 500));
        }
        return jwt;
      } catch (e) {
        console.error("[ConvexAuth getToken] error:", e);
        return null;
      }
    },
    // Stable reference — reads sessionId from ref
    [],
  );

  return {
    isLoaded,
    isSignedIn,
    getToken,
    orgId: null,
    orgRole: null,
  };
}
