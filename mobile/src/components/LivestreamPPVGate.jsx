import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { useQuery, useConvexAuth } from "convex/react";
import { Lock, Zap, ExternalLink } from "lucide-react-native";

import { api } from "convex/_generated/api";
import { useFAPIAuth } from "@/lib/fapi-auth";
import { authorizedWebFetch, getWebUrl } from "@/lib/web-api";

const parseJsonResponse = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export default function LivestreamPPVGate({
  livestreamId,
  title,
  price = 999,
  videoHeight,
  children,
  onRequireSignIn,
}) {
  const { isSignedIn, userId, sessionId } = useFAPIAuth();
  const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showWebFallback, setShowWebFallback] = useState(false);

  const hasEntitlement = useQuery(
    api.entitlements.hasBundledEntitlement,
    isConvexAuthenticated && userId ? { userId, livestreamId } : "skip",
  );

  const isAdmin = useQuery(
    api.adminSettings.checkIsAdmin,
    isConvexAuthenticated ? {} : "skip",
  ) ?? false;

  const isVIP = useQuery(
    api.users.isCurrentUserVIP,
    isConvexAuthenticated ? {} : "skip",
  ) ?? false;

  const handlePurchase = useCallback(async () => {
    if (!isSignedIn) {
      onRequireSignIn?.();
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setShowWebFallback(false);

    try {
      console.log("[PPVGate] starting purchase — sessionId:", sessionId, "livestreamId:", livestreamId);

      const redirectUrl = AuthSession.makeRedirectUri({ path: "ppv-callback" });
      console.log("[PPVGate] mobile redirect URL:", redirectUrl);

      const fetchWithTimeout = Promise.race([
        authorizedWebFetch({
          sessionId,
          path: "/api/ppv/create-session",
          init: {
            method: "POST",
            body: JSON.stringify({
              livestreamId,
              successUrl: redirectUrl,
              cancelUrl: redirectUrl,
            }),
          },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request timed out. Please try again.")), 15000),
        ),
      ]);

      const response = await fetchWithTimeout;
      console.log("[PPVGate] API response status:", response.status);
      const data = await parseJsonResponse(response);
      console.log("[PPVGate] API response data:", JSON.stringify(data).substring(0, 200));

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setShowWebFallback(true);
        }
        throw new Error(data?.error || "Failed to create checkout session");
      }

      if (!data?.url) {
        throw new Error("Missing checkout URL");
      }

      await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    } catch (error) {
      console.error("[PPVGate] purchase flow failed:", error);
      setErrorMessage(error instanceof Error ? error.message : "Purchase failed");
      if (
        error?.status === 401 ||
        error?.status === 403 ||
        error?.code === "MISSING_SESSION" ||
        error?.code === "TOKEN_UNAVAILABLE"
      ) {
        setShowWebFallback(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, onRequireSignIn, sessionId, livestreamId]);

  const handleOpenWebFallback = useCallback(async () => {
    try {
      await WebBrowser.openBrowserAsync(getWebUrl("/"));
    } catch (error) {
      console.error("[PPVGate] failed to open web fallback:", error);
    }
  }, []);

  // Loading states
  if (!isSignedIn && isSignedIn === undefined) {
    return (
      <View style={{ height: videoHeight, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" }}>
        <ActivityIndicator size="large" color="#9ACD32" />
      </View>
    );
  }

  if (isSignedIn && isConvexAuthLoading) {
    return (
      <View style={{ height: videoHeight, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" }}>
        <ActivityIndicator size="large" color="#9ACD32" />
        <Text style={{ color: "#666", marginTop: 12, fontSize: 13 }}>Connecting...</Text>
      </View>
    );
  }

  // Queries still loading
  if (isSignedIn && isConvexAuthenticated && hasEntitlement === undefined) {
    return (
      <View style={{ height: videoHeight, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" }}>
        <ActivityIndicator size="large" color="#9ACD32" />
        <Text style={{ color: "#666", marginTop: 12, fontSize: 13 }}>Checking access...</Text>
      </View>
    );
  }

  // User has access — render the video player
  if (isSignedIn && (hasEntitlement || isAdmin || isVIP)) {
    return <>{children}</>;
  }

  // Paywall UI
  const priceDisplay = `$${(price / 100).toFixed(2)}`;
  const logoUrl = getWebUrl("/sneak-logo.png");

  return (
    <View
      style={{
        marginHorizontal: 20,
        marginBottom: 24,
        backgroundColor: "#0a0a0a",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#333",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          minHeight: videoHeight || 280,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingVertical: 32,
        }}
      >
        {/* LIVE Badge */}
        <View style={{ position: "absolute", top: 12, left: 12 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#DC2626",
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 8,
              gap: 5,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" }} />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 10, letterSpacing: 1 }}>LIVE</Text>
          </View>
        </View>

        {/* Logo */}
        <Image
          source={{ uri: logoUrl }}
          style={{ width: 160, height: 80, marginBottom: 16 }}
          contentFit="contain"
        />

        {/* Lock + Exclusive Access */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
          <Lock size={14} color="#666" />
          <Text style={{ color: "#666", fontSize: 12, marginLeft: 6, letterSpacing: 1, textTransform: "uppercase" }}>
            Exclusive Access
          </Text>
        </View>

        {/* Price */}
        <Text
          style={{
            fontSize: 40,
            fontWeight: "900",
            color: "#9ACD32",
            marginBottom: 8,
            letterSpacing: -1,
          }}
        >
          {priceDisplay}
        </Text>

        {/* Value prop */}
        <Text style={{ color: "#999", fontSize: 13, marginBottom: 24 }}>
          Access this live stream + recording
        </Text>

        {/* Action button */}
        {isSignedIn ? (
          <TouchableOpacity
            onPress={handlePurchase}
            disabled={isLoading}
            style={{
              backgroundColor: "#9ACD32",
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 32,
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Zap size={18} color="#000" />
                <Text style={{ color: "#000", fontWeight: "800", fontSize: 16, marginLeft: 8 }}>
                  Unlock Stream
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => onRequireSignIn?.()}
            style={{
              backgroundColor: "#1a1a1a",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#333",
              paddingVertical: 14,
              paddingHorizontal: 32,
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              Sign In to Purchase
            </Text>
          </TouchableOpacity>
        )}

        {/* Web fallback */}
        {showWebFallback ? (
          <TouchableOpacity
            onPress={handleOpenWebFallback}
            style={{
              marginTop: 12,
              backgroundColor: "#111827",
              borderRadius: 10,
              paddingVertical: 10,
              alignItems: "center",
              borderColor: "#374151",
              borderWidth: 1,
              width: "100%",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <ExternalLink size={14} color="#9ACD32" />
              <Text style={{ color: "#9ACD32", marginLeft: 6, fontWeight: "700" }}>
                Open on web
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Error */}
        {errorMessage ? (
          <Text style={{ color: "#f87171", marginTop: 12, fontSize: 12, textAlign: "center" }}>
            {errorMessage}
          </Text>
        ) : null}

        {/* Footer */}
        <Text style={{ color: "#444", fontSize: 11, marginTop: 16, textAlign: "center" }}>
          One-time purchase. Watch live and replay anytime.
        </Text>
      </View>
    </View>
  );
}
