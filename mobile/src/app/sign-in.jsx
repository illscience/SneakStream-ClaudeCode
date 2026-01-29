import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useSSO } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

// Handle any pending authentication sessions
WebBrowser.maybeCompleteAuthSession();

const getErrorMessage = (error) => {
  if (!error) return "Sign in failed";
  if (typeof error === "string") return error;
  if (error?.errors?.[0]?.message) return error.errors[0].message;
  if (error?.message) return error.message;
  return "Sign in failed";
};

// Preloads the browser for Android devices
const useWarmUpBrowser = () => {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeProvider, setActiveProvider] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useWarmUpBrowser();

  const { startSSOFlow } = useSSO();

  const handleSSOPress = useCallback(
    async (strategy) => {
      if (isSubmitting) return;

      setIsSubmitting(true);
      setActiveProvider(strategy);
      setErrorMessage("");

      try {
        // Use Linking.createURL for the redirect - this is Expo's recommended approach
        const redirectUrl = Linking.createURL("/");
        console.log("Starting SSO with strategy:", strategy);
        console.log("Redirect URL (Linking.createURL):", redirectUrl);

        const { createdSessionId, setActive, signIn, signUp } = await startSSOFlow({
          strategy,
          redirectUrl,
        });

        console.log("SSO result:", { createdSessionId, signIn: !!signIn, signUp: !!signUp });

        if (createdSessionId) {
          await setActive?.({ session: createdSessionId });
          router.replace("/");
        } else if (signIn || signUp) {
          console.log("Additional auth requirements:", {
            signInStatus: signIn?.status,
            signUpStatus: signUp?.status,
          });
          setErrorMessage("Additional verification required");
        }
      } catch (error) {
        console.error("SSO Error:", error);
        console.error("SSO Error message:", error?.message);
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsSubmitting(false);
        setActiveProvider(null);
      }
    },
    [isSubmitting, startSSOFlow, router]
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#000",
        paddingTop: insets.top + 16,
        paddingHorizontal: 20,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700" }}>Sign in</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: "#9ACD32", fontSize: 16 }}>Close</Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 32, gap: 16 }}>
        <Text style={{ color: "#999", fontSize: 14 }}>
          Continue with your preferred provider to join the chat.
        </Text>

        <TouchableOpacity
          onPress={() => handleSSOPress("oauth_google")}
          disabled={isSubmitting}
          style={{
            height: 52,
            borderRadius: 12,
            backgroundColor: "#9ACD32",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {activeProvider === "oauth_google" ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={{ color: "#000", fontWeight: "700" }}>Continue with Google</Text>
          )}
        </TouchableOpacity>

        {Platform.OS === "ios" ? (
          <TouchableOpacity
            onPress={() => handleSSOPress("oauth_apple")}
            disabled={isSubmitting}
            style={{
              height: 52,
              borderRadius: 12,
              backgroundColor: "#1a1a1a",
              borderWidth: 1,
              borderColor: "#333",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {activeProvider === "oauth_apple" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700" }}>Continue with Apple</Text>
            )}
          </TouchableOpacity>
        ) : null}

        {errorMessage ? (
          <Text style={{ color: "#DC2626", fontSize: 13 }}>{errorMessage}</Text>
        ) : null}

        <Text style={{ color: "#666", fontSize: 12 }}>
          This will open a secure browser window to complete sign-in.
        </Text>
      </View>
    </View>
  );
}
