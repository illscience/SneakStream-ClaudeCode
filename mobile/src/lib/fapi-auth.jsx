/**
 * Custom auth provider that checks the Clerk FAPI directly.
 * Works around a bug in @clerk/clerk-js headless mode where
 * sessions are dropped during response parsing in React Native.
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
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

async function clerkFetch(path, options = {}) {
  const jwt = await SecureStore.getItemAsync(CLIENT_JWT_KEY, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });

  const url = new URL(`${CLERK_FRONTEND_API}${path}`);
  url.searchParams.append("_is_native", "1");
  url.searchParams.append("_clerk_js_version", "5");

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

  const newJwt = resp.headers.get("authorization");
  if (newJwt) {
    await SecureStore.setItemAsync(CLIENT_JWT_KEY, newJwt, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
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

  const getToken = useCallback(
    async () => {
      if (!sessionId) return null;
      try {
        const resp = await clerkFetch(`/v1/client/sessions/${sessionId}/tokens`, {
          method: "POST",
        });
        const data = await resp.json();
        return data?.jwt || null;
      } catch (e) {
        console.error("Failed to get session token:", e);
        return null;
      }
    },
    [sessionId]
  );

  return {
    isLoaded,
    isAuthenticated: isSignedIn,
    getToken,
  };
}
