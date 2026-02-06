import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { convex } from "@/lib/convex";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FAPIAuthProvider, useFAPIConvexAuth } from "@/lib/fapi-auth";

SplashScreen.preventAutoHideAsync();

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

function ConvexAuthProvider({ children }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useFAPIConvexAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

function RootLayoutNav() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
      <Stack.Screen name="index" />
      <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  if (!CLERK_PUBLISHABLE_KEY) {
    console.warn("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY");
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ClerkProvider
          publishableKey={CLERK_PUBLISHABLE_KEY || ""}
          tokenCache={tokenCache}
        >
          <ClerkLoaded>
            <FAPIAuthProvider>
              <ConvexAuthProvider>
                <RootLayoutNav />
              </ConvexAuthProvider>
            </FAPIAuthProvider>
          </ClerkLoaded>
        </ClerkProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
