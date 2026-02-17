import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFAPIAuth } from "@/lib/fapi-auth";

WebBrowser.maybeCompleteAuthSession();

const CLERK_FRONTEND_API = "https://clerk.sneakstream.xyz";
const CLIENT_JWT_KEY = "__clerk_client_jwt";

const getErrorMessage = (error) => {
  if (!error) return "Sign in failed";
  if (typeof error === "string") return error;
  if (error?.errors?.[0]?.message) return error.errors[0].message;
  if (error?.message) return error.message;
  return "Sign in failed";
};

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const { refresh } = useFAPIAuth();

  useWarmUpBrowser();

  const handleEmailPasswordPress = useCallback(async () => {
    if (isEmailSubmitting || isSubmitting) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage("Please enter your email and password");
      return;
    }

    setIsEmailSubmitting(true);
    setErrorMessage("");

    try {
      // Step 1: Create sign-in with identifier
      const createResp = await clerkFetch("/v1/client/sign_ins", {
        method: "POST",
        body: `identifier=${encodeURIComponent(trimmedEmail)}`,
      });
      const createData = await createResp.json();

      if (createData?.errors?.[0]?.code === "session_exists") {
        await refresh();
        router.back();
        return;
      }

      if (createData?.errors?.length) {
        const code = createData.errors[0].code;
        if (code === "form_identifier_not_found") {
          setErrorMessage("No account found with that email");
        } else {
          setErrorMessage(getErrorMessage(createData));
        }
        return;
      }

      const signInId = createData?.response?.id;
      if (!signInId) {
        setErrorMessage("Failed to start sign-in");
        return;
      }

      // Step 2: Attempt first factor with password
      const attemptResp = await clerkFetch(
        `/v1/client/sign_ins/${signInId}/attempt_first_factor`,
        {
          method: "POST",
          body: `strategy=password&password=${encodeURIComponent(password)}`,
        }
      );
      const attemptData = await attemptResp.json();

      if (attemptData?.errors?.length) {
        const code = attemptData.errors[0].code;
        if (code === "form_password_incorrect") {
          setErrorMessage("Incorrect password");
        } else {
          setErrorMessage(getErrorMessage(attemptData));
        }
        return;
      }

      const sessionId = attemptData?.response?.created_session_id;
      if (sessionId) {
        await refresh();
        router.back();
      } else {
        setErrorMessage("Sign in incomplete - please try again");
      }
    } catch (error) {
      console.error("Email sign-in error:", error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsEmailSubmitting(false);
    }
  }, [email, password, isEmailSubmitting, isSubmitting, refresh, router]);

  const handleSSOPress = useCallback(
    async (strategy) => {
      if (isSubmitting) return;

      setIsSubmitting(true);
      setActiveProvider(strategy);
      setErrorMessage("");

      try {
        const redirectUrl = AuthSession.makeRedirectUri({ path: "sso-callback" });

        // Step 1: Create sign-in via FAPI
        let createResp = await clerkFetch("/v1/client/sign_ins", {
          method: "POST",
          body: `strategy=${strategy}&redirect_url=${encodeURIComponent(redirectUrl)}`,
        });
        let createData = await createResp.json();

        // If already signed in, just refresh auth state and dismiss
        if (createData?.errors?.[0]?.code === "session_exists") {
          await refresh();
          router.back();
          return;
        }

        const signInId = createData?.response?.id;
        const oauthUrl =
          createData?.response?.first_factor_verification
            ?.external_verification_redirect_url;

        if (!oauthUrl || !signInId) {
          console.error("Sign-in create failed:", JSON.stringify(createData).substring(0, 300));
          setErrorMessage("Failed to start sign-in flow");
          return;
        }

        // Step 2: Open browser for OAuth
        const authResult = await WebBrowser.openAuthSessionAsync(
          oauthUrl,
          redirectUrl
        );

        if (authResult.type !== "success" || !authResult.url) {
          return;
        }

        // Step 3: Extract rotating_token_nonce from callback
        const callbackParams = new URL(authResult.url).searchParams;
        const rotatingTokenNonce =
          callbackParams.get("rotating_token_nonce") || "";

        // Step 4: Reload sign-in to process OAuth result
        const reloadResp = await clerkFetch(
          `/v1/client/sign_ins/${signInId}?rotating_token_nonce=${encodeURIComponent(rotatingTokenNonce)}`,
          { method: "GET" }
        );
        const reloadData = await reloadResp.json();

        const verificationStatus =
          reloadData?.response?.first_factor_verification?.status;
        let sessionId = reloadData?.response?.created_session_id;

        // Step 5: Handle transferable (new user via sign-up)
        if (verificationStatus === "transferable" && !sessionId) {
          const transferResp = await clerkFetch("/v1/client/sign_ups", {
            method: "POST",
            body: "transfer=true",
          });
          const transferData = await transferResp.json();
          sessionId = transferData?.response?.created_session_id;
        }

        // Step 6: Refresh auth state and dismiss
        if (sessionId) {
          await refresh();
          router.back();
        } else {
          setErrorMessage("Sign in incomplete - please try again");
        }
      } catch (error) {
        console.error("SSO Error:", error);
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsSubmitting(false);
        setActiveProvider(null);
      }
    },
    [isSubmitting, refresh, router]
  );

  const isBusy = isSubmitting || isEmailSubmitting;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#000" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700" }}>
            Sign in
          </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: "#9ACD32", fontSize: 16 }}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 32, gap: 16 }}>
          <Text style={{ color: "#999", fontSize: 14 }}>
            Sign in with your email or continue with a provider.
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#666"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSubmitting}
            style={{
              height: 52,
              borderRadius: 12,
              backgroundColor: "#1a1a1a",
              borderWidth: 1,
              borderColor: "#333",
              paddingHorizontal: 16,
              color: "#fff",
              fontSize: 16,
            }}
          />

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#666"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSubmitting}
            returnKeyType="go"
            onSubmitEditing={handleEmailPasswordPress}
            style={{
              height: 52,
              borderRadius: 12,
              backgroundColor: "#1a1a1a",
              borderWidth: 1,
              borderColor: "#333",
              paddingHorizontal: 16,
              color: "#fff",
              fontSize: 16,
            }}
          />

          <TouchableOpacity
            onPress={handleEmailPasswordPress}
            disabled={isBusy}
            style={{
              height: 52,
              borderRadius: 12,
              backgroundColor: "#9ACD32",
              alignItems: "center",
              justifyContent: "center",
              opacity: isBusy ? 0.6 : 1,
            }}
          >
            {isEmailSubmitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={{ color: "#000", fontWeight: "700", fontSize: 16 }}>
                Sign In
              </Text>
            )}
          </TouchableOpacity>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: "#333" }} />
            <Text style={{ color: "#666", fontSize: 13 }}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "#333" }} />
          </View>

          <TouchableOpacity
            onPress={() => handleSSOPress("oauth_google")}
            disabled={isBusy}
            style={{
              height: 52,
              borderRadius: 12,
              backgroundColor: "#1a1a1a",
              borderWidth: 1,
              borderColor: "#333",
              alignItems: "center",
              justifyContent: "center",
              opacity: isBusy ? 0.6 : 1,
            }}
          >
            {activeProvider === "oauth_google" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                Continue with Google
              </Text>
            )}
          </TouchableOpacity>

          {Platform.OS === "ios" ? (
            <TouchableOpacity
              onPress={() => handleSSOPress("oauth_apple")}
              disabled={isBusy}
              style={{
                height: 52,
                borderRadius: 12,
                backgroundColor: "#1a1a1a",
                borderWidth: 1,
                borderColor: "#333",
                alignItems: "center",
                justifyContent: "center",
                opacity: isBusy ? 0.6 : 1,
              }}
            >
              {activeProvider === "oauth_apple" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  Continue with Apple
                </Text>
              )}
            </TouchableOpacity>
          ) : null}

          {errorMessage ? (
            <Text style={{ color: "#DC2626", fontSize: 13 }}>
              {errorMessage}
            </Text>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
