import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useMemo, useRef } from "react";
// ClerkProvider removed — its SDK has a race condition with our FAPI JWT storage
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ConvexProviderWithAuth } from "convex/react";
import { convex } from "@/lib/convex";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FAPIAuthProvider, clerkFetch, useFAPIAuth } from "@/lib/fapi-auth";

SplashScreen.preventAutoHideAsync();

function useConvexFAPIAuth() {
  const { isLoaded, isSignedIn, sessionId } = useFAPIAuth();
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const fetchAccessToken = useCallback(
    async () => {
      const sid = sessionIdRef.current;
      if (!sid) return null;
      try {
        const path = `/v1/client/sessions/${sid}/tokens/convex`;
        const resp = await clerkFetch(path, { method: "POST" });
        const data = await resp.json();
        const token = typeof data?.jwt === "string" ? data.jwt.trim() : null;

        if (!resp.ok) {
          console.error("[ConvexAuth] fetchAccessToken failed:", resp.status);
          return null;
        }

        console.log("[ConvexAuth] fetchAccessToken OK, jwtLength:", token?.length ?? 0);
        return token;
      } catch (e) {
        console.error("[ConvexAuth] fetchAccessToken error:", e);
        return null;
      }
    },
    [],
  );

  return useMemo(
    () => ({
      isLoading: !isLoaded,
      isAuthenticated: Boolean(isSignedIn && sessionId),
      fetchAccessToken,
    }),
    [isLoaded, isSignedIn, sessionId, fetchAccessToken],
  );
}

function ConvexAuthProvider({ children }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useConvexFAPIAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}

function RootLayoutNav() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <FAPIAuthProvider>
          <ConvexAuthProvider>
            <RootLayoutNav />
          </ConvexAuthProvider>
        </FAPIAuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
